import { ActionRowBuilder, AutocompleteInteraction, ComponentType, ButtonStyle, ButtonBuilder, ChatInputCommandInteraction, Collection, InteractionResponse, Message, SlashCommandBuilder, MessageContextMenuCommandInteraction, CommandInteraction, ButtonInteraction } from "discord.js";
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from "discord-api-types/v10";
import { DiscordAPIError } from "@discordjs/rest";

import { Command, CommandOptionChoice, CommandSpecificCooldown } from "./command.js";
import { DatabaseInfo, DatabaseUserInfraction } from "../db/managers/user.js";
import { InteractionHandler, InteractionHandlerClassType } from "../interaction/handler.js";
import { Bot, BotStatus } from "../bot/bot.js";
import { CooldownData } from "./cooldown.js";
import { Response } from "./response.js";
import { Utils } from "../util/utils.js";

export class CommandManager {
	protected readonly bot: Bot;

	/* List of loaded & registered commands */
	public commands: Collection<string, Command>;

	constructor(bot: Bot) {
		this.bot = bot;

		/* Initialize the command list. */
		this.commands = new Collection();
	}

	/* Load all the commands. */
	public async loadAll(): Promise<void> {
		return new Promise((resolve, reject) => {
			Utils.search("./build/commands", "js")
				.then(async (files: string[]) => {
					await Promise.all(files.map(async path => {
						await import(path)
							.then((data: { [key: string]: any }) => {
								const list = Object.values(data)
									.filter(data => data.name && data.name.toLowerCase().includes("command"));

								for (const data of list) {
									const command: Command = new (data as any)(this.bot);
									this.commands.set(command.builder.name, command);
								}
							})
							.catch(reject);
					}));

					resolve();
				})
				.catch(reject);
		});
	}

	/**
     * Register all the loaded commands to Discord.
     * @returns Amount of registered commands
     */
	public async register(): Promise<number> {
        if (this.commands.size === 0) throw new Error("Commands have not been loaded yet");

		/* Information about each application command, as JSON */
		const commandList: RESTPostAPIApplicationCommandsJSONBody[] = this.commands.filter(
			cmd => cmd.premiumOnly() || cmd.planOnly() || cmd.subscriptionOnly() || cmd.options.restriction.length === 0
		).map(cmd =>
			(cmd.builder as SlashCommandBuilder).setDefaultPermission(true).toJSON()
		);

		return new Promise(async (resolve, reject) => {
			/* Register the serialized list of private commands to Discord. */
			await this.bot.client.rest.put(Routes.applicationGuildCommands(this.bot.app.config.discord.id, this.bot.app.config.channels.moderation.guild), {
				body: this.commands.filter(cmd => commandList.find(c => c.name === cmd.builder.name) === undefined).map(cmd =>
					(cmd.builder as SlashCommandBuilder).setDefaultPermission(true).toJSON()
				)
			});

			/* Register the serialized list of application commands to Discord. */
			await this.bot.client.rest.put(Routes.applicationCommands(this.bot.app.config.discord.id), {
				body: commandList
			})
				.then(() => resolve(commandList.length))
				.catch(reject);
		});
	}

	public get<T extends Command = Command>(name: string): T {
		/* Search for the specified command. */
		const found: T | null = this.bot.command.commands.get(name) as T ?? null;
		if (found === null) throw new Error("EEK!");

		return found;
	}

	public commandName(interaction: CommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler): string {
		if (command instanceof InteractionHandler) return `${interaction.user.id}-${command.builder.data.name}-${command.builder.data.type}`;
		else return `${interaction.user.id}-${interaction instanceof ChatInputCommandInteraction && interaction.options.getSubcommand(false) ? `${command.builder.name}-${interaction.options.getSubcommand(true)}` : command.builder.name}`;
	}

	/**
	 * Get the current cool-down for the specific command, for the user who executed this interaction.
	 * 
	 * @param interaction Interaction user to check
	 * @param command Command to check
	 */
	public async cooldown(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler): Promise<CooldownData | null> {
		/* If the command doesn't have a cool-down time set, abort. */
		if (command.options.cooldown === null) return null;
		const name: string = this.commandName(interaction, command);

		/* Cached cool-down entry */
		const cached: CooldownData | null = await this.bot.db.cache.get("cooldown", name) ?? null;
		if (cached === null || (cached.createdAt + cached.duration) < Date.now()) return null;

		return cached;
	}

	public cooldownDuration(command: Command | InteractionHandler, db: DatabaseInfo): number | null {
		/* If the specific command doesn't have a cool-down set, return a default one. */
		if (!command.options.cooldown) return 3000;

		/* Subscription type of the user */
		const type = this.bot.db.users.type(db);

		return typeof command.options.cooldown === "object"
			? type.type !== "plan"
				? command.options.cooldown[type.type]
				: null
			: command.options.cooldown;
	}

	/**
	 * Apply the command-specific cooldown to the interaction user.
	 * 
	 * @param interaction Interaction user to set cool-down for 
	 * @param command Command to set cool-down for
	 */
	public async applyCooldown(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, db: DatabaseInfo, command: Command | InteractionHandler): Promise<void> {
		/* If the command doesn't have a cool-down time set, abort. */
		if (!command.options.cooldown || this.bot.app.config.discord.owner.includes(interaction.user.id)) return;
		const name: string = this.commandName(interaction, command);
		
		/* How long the cool-down should last */
		const duration: number | null = this.cooldownDuration(command, db);
		if (duration === null) return;

		/* Update the database entry for the user & the executed command. */
		await this.bot.db.cache.set("cooldown", name, {
			createdAt: Date.now(), duration
		});

		await this.bot.db.metrics.changeCooldownMetric({ [name]: "+1" });
		await this.bot.db.users.incrementInteractions(db, "cooldown_messages");

		/* Delete the user's cooldown from the database, once it expires. */
		setTimeout(async () => {
			await this.bot.db.cache.delete("cooldown", name);
		}, duration);
	}

	public async removeCooldown(interaction: CommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler): Promise<void> {
		const name: string = this.commandName(interaction, command);
		await this.bot.db.cache.delete("cooldown", name);
	}

	public hasCooldownExpired(cooldown: CooldownData): boolean {
		return cooldown.createdAt + cooldown.duration < Date.now();
	}

	public cooldownMessage(interaction: CommandInteraction | MessageContextMenuCommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler, db: DatabaseInfo, cooldown: CooldownData): Response {
		/* Subscription type of the user & guild */
		const subscription = this.bot.db.users.type(db);

		/* Send an informative message about the cool-down. */
		const response: Response = new Response()
			.addEmbed(builder => builder
				.setTitle("Whoa-whoa... slow down ⌛")
				.setDescription(`This ${command instanceof InteractionHandler ? "action" : interaction instanceof MessageContextMenuCommandInteraction ? "context menu action" : "command"} is currently on cool-down. You can use it again <t:${Math.floor((cooldown.createdAt + cooldown.duration) / 1000)}:R>.`)
				.setColor("Yellow")
			)
			.setEphemeral(true);

		if (typeof command.options.cooldown === "object" && !subscription.premium) {
			/* How long the cool-down will be, if the user has Premium */
			const duration: number = (command.options.cooldown as CommandSpecificCooldown).subscription;

			response.addEmbed(builder => builder
				.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})**, the cool-down will be lowered to **${Math.floor(duration / 1000)} seconds** only.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
				.setColor("Orange")
			);
		}

		return response;
	}

	/**
     * Handle an auto-complete interaction.
     * @param interaction Auto-completion interaction to handle 
     */
	public async handleCompletion(interaction: AutocompleteInteraction): Promise<void> {
		/* Get the command, by its name. */
		const command: Command = this.commands.get(interaction.commandName)!;
		if (!command) return;
		
		if (command.options.waitForStart && !this.bot.started) return void await interaction.respond([
			{ name: "The bot is currently reloading... ⏳", value: "" }
		]).catch(() => {});

		/* Get the database entry of the user. */
		let db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);
		const subscription = this.bot.db.users.type(db);

		/* If this command is Premium-only and the user doesn't have a subscription, ... */
		if ((command.options.restriction.includes("subscription") || command.options.restriction.includes("plan")) && !subscription.premium) {
			return await interaction.respond([
				{ name: `The command /${command.builder.name} is only available to Premium users.`, value: "" },
				{ name: `Premium 🌟 also includes many additional benefits; view /premium for more.`, value: "" }
			]).catch(() => {});
		}

		/* Try to complete the options. */
		try {
			const data: CommandOptionChoice[] = await command.complete(interaction, db);
			await interaction.respond(data);

		} catch (error) {
			await this.bot.moderation.error({
				error: error as Error, title: "Failed to auto-complete interaction"
			});

			/* Respond to the interaction with an error message. */
			await interaction.respond([
				{ name: "An error occured during auto-completion; the developers have been notified.", value: "" }
			]).catch(() => {});
		}
	}

	/**
     * Handle a command interaction.
     * @param interaction Command interaction to handle
     */
	public async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
		/* Get the command, by its name. */
		const command: Command | null = this.commands.get(interaction.commandName) ?? null;
		if (command === null) return;

		if (command.options.waitForStart && (!this.bot.started || this.bot.statistics.memoryUsage === 0)) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently reloading**...** ⏳")
				.setColor("Orange")
			).setEphemeral(true).send(interaction);

		/* Get the current cool-down of the command. */
		const cooldown: CooldownData | null = await this.cooldown(interaction, command);

		/* Get the database entry of the user. */
		let db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);
		const subscription = this.bot.db.users.type(db);

		/* Current status of the bot */
		const status: BotStatus = await this.bot.status();

		if (status.type === "maintenance" && !this.bot.db.role.canExecuteCommand(db.user, command, status)) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently under maintenance 🛠️")
				.setDescription(status.notice !== undefined ? `*${status.notice}*` : null)
				.setTimestamp(status.since)
				.setColor("Orange")
			).setEphemeral(true).send(interaction);

		/* If this command is Premium-only and the user doesn't have a subscription, ... */
		if ((command.planOnly() || command.premiumOnly()) && !subscription.premium) {
			/* Which Premium type this command is restricted to */
			const type = command.planOnly() && command.premiumOnly()
				? null : command.planOnly() ? "plan" : "subscription";

			const response = new Response()
				.addEmbed(builder => builder
					.setDescription(`The ${interaction instanceof MessageContextMenuCommandInteraction ? `context menu action \`${command.builder.name}\`` : `command \`/${command.builder.name}\``} is only available to ${type === null ? "**Premium**" : type === "plan" ? "**pay-as-you-go Premium 📊**" : "**fixed Premium 💸**"} users. **Premium 🌟** also includes many additional benefits; view \`/premium\` for more.`)
					.setColor("Orange")
				)
				.setEphemeral(true);

			return void await response.send(interaction);
		}

		/* If the user is currently on cool-down for this command, ... */
		if (command.options.cooldown !== null && cooldown !== null && cooldown.createdAt) {
			/* Build the cool-down message. */
			const response: Response = this.cooldownMessage(interaction, command, db, cooldown);

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

		/* If the command is marked as private, do some checks to make sure only privileged users are able to execute this command. */
		if (!(command.planOnly() || command.subscriptionOnly())) {
			/* Whether the user can execute this command */
			const canExecute: boolean = this.bot.db.role.canExecuteCommand(db.user, command);

			if (!canExecute) return void await new Response()
				.addEmbed(builder => builder
					.setDescription(`You are not allowed to run this command 🤨`)
					.setColor("Red")
				).setEphemeral(true)
			.send(interaction);
		}

		/* Defer the message, in case the command may execute for more than 3 seconds. */
		if (command.options.long) try {
			await interaction.deferReply();
		} catch (_) {
			return;
		}

		const banned: DatabaseUserInfraction | null = this.bot.db.users.banned(db.user);
		const unread: DatabaseUserInfraction[] = this.bot.db.users.unread(db.user);

		/* If the user is banned from the bot, send a notice message. */
		if (banned !== null && !command.options.always) return void await 
			this.bot.moderation.buildBanNotice(banned).setEphemeral(true)
		.send(interaction);

		if (unread.length > 0) {
			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setCustomId("acknowledge-warning")
						.setLabel("Acknowledge")
						.setStyle(ButtonStyle.Danger)
				);

			const reply: Message = (await new Response()
				.addComponent(ActionRowBuilder<ButtonBuilder>, row)
				.addEmbed(builder => builder
					.setTitle(`Before you continue ...`)
					.setDescription(`You received **${unread.length > 1 ? "several warnings" : "a warning"}**, as a consequence of your messages with the bot.`)
					
					.addFields(unread.map(i => ({
						name: `${i.reason} ⚠️`,
						value: `*<t:${Math.floor(i.when / 1000)}:F>*`
					})))

					.setFooter({ text: "This is only a warning; you can continue to use the bot. If you however keep breaking the rules, we may have to take further administrative actions." })
					.setColor("Red")
				).send(interaction)) as Message;

			/* Wait for the `Acknowledge` button to be pressed, or for the collector to expire. */
			const collector = reply.createMessageComponentCollector<ComponentType.Button>({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id && i.customId === "acknowledge-warning",
				time: 60 * 1000,
				max: 1
			});

			/* When the collector is done, delete the reply message & continue the execution. */
			await new Promise<void>(resolve => collector.on("end", async collected => {
				await Promise.all(collected.map(entry => entry.deferUpdate()))
					.catch(() => {});

				resolve();
			}));

			/* Mark the unread messages as read. */
			await this.bot.db.users.read(db.user, unread);
			db.user = await this.bot.db.users.fetchUser(interaction.user);
		}

		/* If the user doesn't have a cool-down set for the command yet, ... */
		if (command.options.cooldown !== null && cooldown === null) {
			await this.applyCooldown(interaction, db, command);
		
		/* If the user's cooldown already expired, ... */
		} else if (command.options.cooldown !== null && cooldown !== null && cooldown.duration < Date.now()) {
			await this.applyCooldown(interaction, db, command);
		}

		/* Reply to the original interaction */
		let response: Response | undefined | void;

		/* Try to execute the command handler. */
		try {
			response = await command.run(interaction as any, db);

		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === 10062) return;

			response = new Response()
				.addEmbed(builder =>
					builder.setTitle("An error occurred ⚠️")
					    .setDescription(`It seems like something went wrong while trying to run this command.\n_If you continue to experience issues, join our **[support server](${Utils.supportInvite(this.bot)})**_.`)
						.setColor("Red")
				)
				.setEphemeral(true);

			await this.bot.moderation.error({
				title: `Error while executing command \`${command.builder instanceof SlashCommandBuilder ? "/" : ""}${command.builder.name}\``, error
			});
		}

		/* Reply with the response, if one was given. */
		if (response) await response.send(interaction);

		/* Increment the user's interaction count. */
		await this.bot.db.users.incrementInteractions(db, "commands");

		await this.bot.db.metrics.changeCommandsMetric({
			[command.builder.name]: "+1"
		});
	}
}