import { ActionRowBuilder, ComponentType, ButtonStyle, ButtonBuilder, ChatInputCommandInteraction, Collection, InteractionResponse, Message, SlashCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";
import { DiscordAPIError } from "@discordjs/rest";

import { DatabaseInfo, DatabaseUserInfraction } from "../db/managers/user.js";
import { CooldownData } from "../command/types/cooldown.js";
import { Response } from "../command/response.js";
import { AnyInteractionHandlerValues, InteractionHandler, InteractionHandlerClassType, InteractionHandlerRunOptions, InteractionValidationError } from "./handler.js";
import { Bot, BotStatus } from "../bot/bot.js";
import { Utils } from "../util/utils.js";
import { RunningData } from "../command/types/running.js";

export class InteractionManager {
	protected readonly bot: Bot;

	/* List of loaded & registered interaction handlers */
	public handlers: Collection<string, InteractionHandler>;

	constructor(bot: Bot) {
		this.bot = bot;

		/* Initialize the handler list. */
		this.handlers = new Collection();
	}

	/* Load all the commands. */
	public async loadAll(): Promise<void> {
		return new Promise((resolve, reject) => {
			Utils.search("./build/interactions", "js")
				.then(async (files: string[]) => {
					await Promise.all(files.map(async path => {
						await import(path)
							.then((data: { [key: string]: any }) => {
								const list = Object.values(data)
									.filter(data => data.name && data.name.toLowerCase().includes("handler"));

								for (const data of list) {
									const handler: InteractionHandler = new (data as any)(this.bot);
									this.handlers.set(handler.builder.data.name, handler);
								}
							})
							.catch(reject);
					}));

					resolve();
				})
				.catch(reject);
		});
	}

	public get<T extends InteractionHandler = InteractionHandler>(name: string): T {
		/* Search for the specified command. */
		const found: T | null = this.handlers.get(name) as T ?? null;
		if (found === null) throw new Error("EEK!");

		return found;
	}

	private rawData(interaction: InteractionHandlerClassType): string[] {
		return interaction.customId.split(":");
	}

	private hasInteractionData(interaction: InteractionHandlerClassType): boolean {
		return interaction.customId.split(":").length > 1;
	}

	private parseData(handler: InteractionHandler, raw: string[]): AnyInteractionHandlerValues {
		if (handler.template === null) return {};

		/* Final & parsed data */
		const final: Partial<AnyInteractionHandlerValues> = {};

		Object.entries(handler.template).forEach(([ key, type ], index) => {
			const entry: string = raw[index];

			/* Whether this option is optional */
			const optional: boolean = type.endsWith("?");
			if (optional) type = type.replaceAll("?", "") as any;

			if (!entry && !optional) throw new InteractionValidationError({
				handler, key, error: "Not found"
			});

			if (!entry && optional) {
				final[key] = null;
				return;
			}

			/* Try to parse the value below. */
			let parsed: string | number | boolean | null = null;

			if (type === "string" || type === "any") parsed = entry ?? null;
			else if (type === "boolean") parsed = entry === "true";
			else if (type === "number") parsed = !isNaN(parseFloat(entry)) ? parseFloat(entry) : null;

			if ((parsed === null && type !== "any")) throw new InteractionValidationError({
				handler, key, error: "Invalid type"
			});

			final[key] = parsed;
		});

		return final as AnyInteractionHandlerValues;
	}

	private interactionData(interaction: InteractionHandlerClassType): Pick<InteractionHandlerRunOptions, "data" | "raw"> & { handler: InteractionHandler } | null {
		/* If the component has no data, just throw an error. */
		if (!this.hasInteractionData(interaction)) return null;

		/* First off, get the raw data. */
		const raw: string[] = this.rawData(interaction);

		/* Name of the interaction handler, if available */
		const name: string = raw.shift()!;

		const handler: InteractionHandler | null = this.handlers.get(name) ?? null;
		if (handler === null) return null;

		/* Then, try to parse that data :*/
		const parsed = this.parseData(handler, raw);

		return {
			raw, data: parsed, handler
		};
	}

	/**
     * Handle a generic Discord interaction.
     * @param interaction Interaction to handle
     */
	public async handleInteraction(interaction: InteractionHandlerClassType): Promise<void> {
		/* Try to get all the information about the interaction & data. */
		const data = this.interactionData(interaction);
		if (data === null) return;

		/* The interaction handler */
		const handler = data.handler;

		if (handler.options.waitForStart && (!this.bot.started || this.bot.statistics.memoryUsage === 0)) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently reloading**...** ⏳")
				.setColor("Orange")
			).setEphemeral(true).send(interaction);

		/* Get the current cool-down of the handler. */
		const cooldown: CooldownData | null = await this.bot.command.cooldown(interaction, handler);

		/* Check whether the user already has an instance of this handler running. */
		const running: RunningData | null = await this.bot.command.running(interaction, handler);

		/* Get the database entry of the user. */
		let db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);
		const subscription = this.bot.db.users.type(db);

		/* Current status of the bot */
		const status: BotStatus = await this.bot.status();

		if (status.type === "maintenance" && !this.bot.db.role.canExecuteCommand(db.user, handler, status)) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently under maintenance 🛠️")
				.setDescription(status.notice !== undefined ? `*${status.notice}*` : null)
				.setTimestamp(status.since)
				.setColor("Orange")
			).setEphemeral(true).send(interaction);

		/* If this command is Premium-only and the user doesn't have a subscription, ... */
		if ((handler.planOnly() || handler.premiumOnly()) && !subscription.premium) {
			/* Which Premium type this command is restricted to */
			const type = handler.planOnly() && handler.premiumOnly()
				? null : handler.planOnly() ? "plan" : "subscription";

			const response = new Response()
				.addEmbed(builder => builder
					.setDescription(`This action is only available to ${type === null ? "**Premium**" : type === "plan" ? "**pay-as-you-go Premium 📊**" : "**fixed Premium 💸**"} users. **Premium 🌟** also includes many additional benefits; view \`/premium\` for more.`)
					.setColor("Orange")
				)
				.setEphemeral(true);

			return void await response.send(interaction);
		}

		/* If the user already has an instance of this handler running, ... */
		if (running !== null) {
			const response = this.bot.command.runningMessage(interaction, handler, running);
			return void await response.send(interaction);
		}

		/* If the user is currently on cool-down for this handler, ... */
		if (handler.options.cooldown !== null && cooldown !== null && cooldown.createdAt) {
			/* Build the cool-down message. */
			const response: Response = this.bot.command.cooldownMessage(interaction, handler, db, cooldown);

			/* How long until the cool-down expires */
			const delay: number = (cooldown.createdAt + cooldown.duration) - Date.now() - 1000;

			/* Send the notice message. */
			return await response.send(interaction)
				.then(message => {
					if (message instanceof InteractionResponse) {
						/* Delete the cool-down message again, after it has expired. */
						setTimeout(async () => {
							await interaction.deleteReply().catch(() => {});
						}, delay);
					}
				});
		}

		/* If the handler is marked as private, do some checks to make sure only privileged users are able to execute this handler. */
		if (!handler.premiumOnly) {
			/* Whether the user can execute this command */
			const canExecute: boolean = this.bot.db.role.canExecuteCommand(db.user, handler);

			if (!canExecute) return void await new Response()
				.addEmbed(builder => builder
					.setDescription(`You are not allowed to perform this action 🤨`)
					.setColor("Red")
				).setEphemeral(true)
			.send(interaction);
		}

		const banned: DatabaseUserInfraction | null = this.bot.db.users.banned(db.user);

		/* If the user is banned from the bot, send a notice message. */
		if (banned !== null && !handler.options.always) return void await 
			this.bot.moderation.buildBanMessage(banned)
		.send(interaction);

		/* Show a warning modal to the user, if needed. */
		db.user = await this.bot.moderation.warningModal({ interaction, db });

		/* If the user doesn't have a cool-down set for the handler yet, ... */
		if (handler.options.cooldown !== null && cooldown === null) {
			await this.bot.command.applyCooldown(interaction, db, handler);
		
		/* If the user's cooldown already expired, ... */
		} else if (handler.options.cooldown !== null && cooldown !== null && cooldown.duration < Date.now()) {
			await this.bot.command.applyCooldown(interaction, db, handler);
		}

		/* Reply to the original interaction */
		let response: Response | undefined | void;

		/* Try to execute the interaction handler. */
		try {
			await this.bot.command.setRunning(interaction, handler, true);

			response = await handler.run({
				interaction, db, data: data.data, raw: data.raw
			});

		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === 10062) return;

			response = await this.bot.error.handle({
				title: `Error while performing action \`${handler.builder.data.name}\``,
				notice: "It seems like something went wrong while trying to perform this action.", error
			});
		}

		/* Increment the user's interaction count. */
		await this.bot.db.users.incrementInteractions(db, "interactions");

		await this.bot.db.metrics.changeCommandsMetric({
			[handler.builder.data.name]: "+1"
		});

		await this.bot.command.setRunning(interaction, handler, false);

		/* Reply with the response, if one was given. */
		if (response) await response.send(interaction);
	}
}