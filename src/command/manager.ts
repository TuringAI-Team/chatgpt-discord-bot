import { ActionRowBuilder, AutocompleteInteraction, ComponentType, ButtonStyle, ButtonBuilder, ChatInputCommandInteraction, Collection, InteractionResponse, Message, SlashCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from "discord-api-types/v10";
import { DiscordAPIError, REST } from "@discordjs/rest";

import { Command, CommandOptionChoice, CommandPrivateType, CommandSpecificCooldown } from "./command.js";
import { DatabaseInfo, DatabaseUserInfraction } from "../db/managers/user.js";
import { handleError } from "../util/moderation/error.js";
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
		const commandList: RESTPostAPIApplicationCommandsJSONBody[] = this.commands.filter(cmd => cmd.options.private == undefined).map(cmd =>
			(cmd.builder as SlashCommandBuilder).setDefaultPermission(true).toJSON()
		);

		/* REST API client */
		const client: REST = new REST().setToken(this.bot.app.config.discord.token);

		return new Promise(async (resolve, reject) => {
			/* Register the serialized list of moderation-specific commands to Discord. */
			await client.put(Routes.applicationGuildCommands(this.bot.app.config.discord.id, this.bot.app.config.channels.moderation.guild), {
				body: this.commands.filter(cmd => cmd.options.private != undefined).map(cmd =>
					(cmd.builder as SlashCommandBuilder).setDefaultPermission(true).toJSON()
				)
			});

			/* Register the serialized list of application commands to Discord. */
			await client.put(Routes.applicationCommands(this.bot.app.config.discord.id), {
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

	private commandName(interaction: ChatInputCommandInteraction, command: Command): string {
		return `${interaction.user.id}-${interaction.options.getSubcommand(false) ? `${command.builder.name}-${interaction.options.getSubcommand(true)}` : command.builder.name}`;
	}

	/**
	 * Get the current cool-down for the specific command, for the user who executed this interaction.
	 * 
	 * @param interaction Interaction user to check
	 * @param command Command to check
	 */
	public async cooldown(interaction: ChatInputCommandInteraction, command: Command): Promise<CooldownData | null> {
		/* If the command doesn't have a cool-down time set, abort. */
		if (command.options.cooldown === null) return null;
		const name: string = this.commandName(interaction, command);

		/* If the cool-down entry doesn't exist yet, return nothing. */
		if ((await this.bot.db.cache.get("cooldown", name)) == undefined) return null;
		return (await this.bot.db.cache.get("cooldown", name))!;
	}

	private cooldownDuration(command: Command, db: DatabaseInfo): number {
		/* If the specific command doesn't have a cool-down set, return a default one. */
		if (!command.options.cooldown) return 3000;

		/* Subscription type of the user */
		const type = this.bot.db.users.subscriptionType(db);

		return typeof command.options.cooldown === "object"
			? command.options.cooldown[type]
			: command.options.cooldown;
	}

	/**
	 * Apply the command-specific cooldown to the interaction user.
	 * 
	 * @param interaction Interaction user to set cool-down for 
	 * @param command Command to set cool-down for
	 */
	public async applyCooldown(interaction: ChatInputCommandInteraction, db: DatabaseInfo, command: Command): Promise<void> {
		/* If the command doesn't have a cool-down time set, abort. */
		if (!command.options.cooldown || this.bot.app.config.discord.owner.includes(interaction.user.id)) return;

		const name: string = this.commandName(interaction, command);
		
		/* How long the cool-down should last */
		const duration: number = this.cooldownDuration(command, db);

		/* Update the database entry for the user & the executed command. */
		await this.bot.db.cache.set("cooldown", name, {
			createdAt: Date.now(), duration
		});

		/* Delete the user's cooldown from the database, once it expires. */
		setTimeout(async () => {
			await this.bot.db.cache.delete("cooldown", name);
		}, duration);
	}

	/**
     * Handle an auto-complete interaction.
     * @param interaction Auto-completion interaction to handle 
     */
	public async handleCompletion(interaction: AutocompleteInteraction): Promise<void> {
		/* Get the command, by its name. */
		const command: Command = this.commands.get(interaction.commandName)!;
		if (!command) return;

		/* Try to complete the options. */
		try {
			const data: CommandOptionChoice[] = await command.complete(interaction);
			await interaction.respond(data);

		} catch (error: any) {
			/* Respond to the interaction with an error message. */
			await interaction.respond([
				{ name: "An error occured during auto-completion - report this to the developers.", value: "" }
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

		if (command.options.waitForStart && !this.bot.started) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently reloading**...** ⏳")
				.setColor("Orange")
			).send(interaction);

		/* Current status of the bot */
		const status: BotStatus = await this.bot.status();

		if (status.type === "maintenance" && !command.options.private) return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently under maintenance 🛠️")
				.setDescription(status.notice !== undefined ? `*${status.notice}*` : null)
				.setTimestamp(status.since)
				.setColor("Orange")
			).send(interaction);

		/* Get the current cool-down of the command. */
		const cooldown: CooldownData | null = await this.cooldown(interaction, command);

		/* Get the database entry of the user. */
		let db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);
		const subscription = this.bot.db.users.subscriptionType(db);

		/* If the user is currently on cool-down for this command, ... */
		if (command.options.cooldown !== null && cooldown !== null) {
			/* Send an informative message about the cool-down. */
			const response: Response = new Response()
				.addEmbed(builder => builder
					.setTitle("Whoa-whoa... slow down ⌛")
					.setDescription(`This ${interaction instanceof MessageContextMenuCommandInteraction ? "context menu action" : "command"} is currently on cool-down. You can use it again <t:${Math.floor((cooldown.createdAt + cooldown.duration) / 1000)}:R>.`)
					.setColor("Yellow")
				)
				.setEphemeral(true);

			if (typeof command.options.cooldown === "object" && (subscription === "Free" || subscription === "Voter")) {
				/* How long the cool-down will be, if the user has Premium */
				const duration: number = (command.options.cooldown as CommandSpecificCooldown).UserPremium;

				response.addEmbed(builder => builder
					.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})**, the cool-down will be lowered to **${Math.floor(duration / 1000)} seconds** only.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
					.setColor("Orange")
				);
			}

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
		if (command.options.private != undefined) {
			/* If the command was executed on the wrong guild, silently ignore it. */
			if (interaction.guildId === null || interaction.guildId !== this.bot.app.config.channels.moderation.guild) return;

			/* Check whether the user has the correct permissions to execute this command. */
			if (
				(command.options.private === CommandPrivateType.OwnerOnly && !this.bot.app.config.discord.owner.includes(interaction.user.id)) ||
				(command.options.private === CommandPrivateType.ModeratorOnly && !db.user.moderator)
			) {
				return void await new Response()
					.addEmbed(builder => builder
						.setDescription(`You are not ${command.options.private === CommandPrivateType.OwnerOnly ? "the owner" : "a moderator"} of the bot 🤨`)
						.setColor("Red")
					).setEphemeral(true)
				.send(interaction);
			}
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
		if (banned !== null && !command.options.always && command.options.private == undefined) return void await new Response()
			.addEmbed(builder => builder
				.setTitle(`You have been banned **permanently** from the bot 😔`)
				.addFields({
					name: "Reason",
					value: banned.reason ?? "Inappropriate use of the bot"
				})
				.setFooter({ text: "View /support on how to appeal this ban" })
				.setTimestamp(banned.when)
				.setColor("Red")
			).setEphemeral(true).send(interaction);

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

		/* Reply to the original interaction */
		let response: Response | undefined;

		/* Try to execute the command handler. */
		try {
			response = await command.run(interaction as any, db);

		} catch (error) {
			if (error instanceof DiscordAPIError && error.code === 10062) return;

			response = new Response()
				.addEmbed(builder =>
					builder.setTitle("An error occurred ⚠️")
					    .setDescription(`It seems like something went wrong while trying to run this command.\nIf you continue to experience issues, join our **[support server](${Utils.supportInvite(this.bot)})**.`)
						.setColor("Red")
				);

			await handleError(this.bot, {
				title: `Error while executing command \`/${command.builder.name}\``,
				error: error as Error,
				reply: false
			});
		}

		/* If the user doesn't have a cool-down set for the command yet, ... */
		if (command.options.cooldown !== null && cooldown === null) {
			await this.applyCooldown(interaction, db, command);
		
		/* If the user's cooldown already expired, ... */
		} else if (command.options.cooldown !== null && cooldown !== null && cooldown.duration < Date.now()) {
			await this.applyCooldown(interaction, db, command);
		}

		/* Reply with the response, if one was given. */
		if (response) await response.send(interaction);

		/* Increment the user's interaction count. */
		await this.bot.db.users.incrementInteractions(db.user, "commands");
	}
}