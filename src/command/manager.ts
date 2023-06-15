import { ChatInputCommandInteraction, Collection, InteractionResponse, SlashCommandBuilder, MessageContextMenuCommandInteraction, CommandInteraction } from "discord.js";
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from "discord-api-types/v10";
import { DiscordAPIError } from "@discordjs/rest";

import { InteractionHandler, InteractionHandlerClassType } from "../interaction/handler.js";
import { DatabaseInfo, DatabaseUserInfraction } from "../db/managers/user.js";
import { Command, CommandSpecificCooldown } from "./command.js";
import { CooldownData } from "./types/cooldown.js";
import { RunningData } from "./types/running.js";
import { Bot, BotStatus } from "../bot/bot.js";
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
	 * Check whether an instance of this command is already running.
	 * 
	 * @param interaction Interaction user to check
	 * @param command Command to check
	 * 
	 * @returns Whether an instance of this command is already running
	 */
	public async running(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler): Promise<RunningData | null> {
		if (!command.options.synchronous) return null;
		const name: string = this.commandName(interaction, command);

		const existing: RunningData | null = await this.bot.db.cache.get("commands", name);
		if (existing === null || !existing.since || !existing.channel || (existing.since + 60 * 1000) < Date.now()) return null;

		return existing;
	}

	public async setRunning(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler, status: boolean): Promise<void> {
		if (!command.options.synchronous) return;
		const name: string = this.commandName(interaction, command);
		
		if (status) {
			await this.bot.db.cache.set("commands", name, {
				since: Date.now(),
				channel: interaction.channelId
			});
		} else {
			await this.bot.db.cache.delete("commands", name);
		} 
	}

	public runningMessage(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, command: Command | InteractionHandler, running: RunningData): Response {
		return new Response()
			.addEmbed(builder => builder
				.setTitle("Whoa-whoa... slow down ⌛")
				.setDescription(`You already have this ${command instanceof InteractionHandler ? "action" : interaction instanceof MessageContextMenuCommandInteraction ? "context menu action" : "command"} running in ${running.channel !== null ? `<#${running.channel}>` : "**DMs**"}, since <t:${Math.floor(running.since / 1000)}:R>. *Wait for that to finish first, before running this again*.`)
				.setColor("Yellow")
			)
			.setEphemeral(true);
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
	public async applyCooldown(interaction: ChatInputCommandInteraction | InteractionHandlerClassType, db: DatabaseInfo, command: Command | InteractionHandler, time?: number): Promise<void> {
		/* If the command doesn't have a cool-down time set, abort. */
		if (!command.options.cooldown || this.bot.db.role.owner(db.user)) return;
		const name: string = this.commandName(interaction, command);
		
		/* How long the cool-down should last */
		const duration: number | null = time ?? this.cooldownDuration(command, db);
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

		/* Check whether the user already has an instance of this command running. */
		const running: RunningData | null = await this.running(interaction, command);

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

		/* If the user already has an instance of this command running, ... */
		if (running !== null) {
			const response = this.runningMessage(interaction, command, running);
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

		/* If the user is banned from the bot, send a notice message. */
		if (banned !== null && !command.options.always) return void await 
			this.bot.moderation.buildBanMessage(banned)
		.send(interaction);

		/* Show a warning modal to the user, if needed. */
		db.user = await this.bot.moderation.warningModal({ interaction, db });

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
			await this.setRunning(interaction, command, true);
			response = await command.run(interaction as any, db);

		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === 10062) return;

			response = await this.bot.error.handle({
				title: `Error while executing command \`${command.builder instanceof SlashCommandBuilder ? "/" : ""}${command.builder.name}\``,
				notice: "It seems like something went wrong while trying to run this command.", error
			});
		}

		/* Reply with the response, if one was given. */
		if (response) await response.send(interaction);

		/* Increment the user's interaction count. */
		await this.bot.db.users.incrementInteractions(db, "commands");

		await this.bot.db.metrics.changeCommandsMetric({
			[command.builder.name]: "+1"
		});

		await this.setRunning(interaction, command, false);
	}
}