import { DiscordAPIError } from "@discordjs/rest";
import { Collection } from "discord.js";

import { AnyInteractionHandlerValues, InteractionHandler, InteractionHandlerClassType, InteractionHandlerRunOptions, InteractionValidationError } from "./handler.js";
import { CommandPrepareData } from "../command/manager.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

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
		if (found === null) throw new Error(`Couldn't find interaction "${name}"`);

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

		/* Execute some checks & get all needed data. */
		const prepared: CommandPrepareData | void = await this.bot.command.prepare(interaction, handler);
		if (!prepared) return;

		const { db } = prepared;

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