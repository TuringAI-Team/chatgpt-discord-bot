import { ActionRowBuilder, AttachmentBuilder, BaseGuildTextChannel, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ComponentEmojiResolvable, ComponentType, DiscordAPIError, DMChannel, EmbedBuilder, Guild, InteractionReplyOptions, Message, MessageCreateOptions, MessageEditOptions, MessageReplyOptions, PermissionsString, Role, TextChannel, User, WebhookMessageCreateOptions } from "discord.js";

import { DatabaseInfo, DatabaseUserInfraction, UserSubscriptionType } from "../db/managers/user.js";
import { ChatNoticeMessage, MessageType, ResponseMessage } from "../chat/types/message.js";
import { LoadingIndicator, LoadingIndicatorManager } from "../db/types/indicator.js";
import { check as moderate, ModerationResult } from "./moderation/moderation.js";
import { PlanCreditViewers, PlanCreditVisility } from "../db/managers/plan.js";
import { ChatSettingsModel, ChatSettingsModels } from "./settings/model.js";
import { ChatGeneratedInteraction, Conversation } from "./conversation.js";
import { ChatModel, ModelCapability } from "../chat/types/model.js";
import { buildBanNotice } from "../util/moderation/moderation.js";
import { addReaction, removeReaction } from "./utils/reaction.js";
import { buildIntroductionPage } from "../util/introduction.js";
import { ChatGuildData } from "../chat/types/options.js";
import { ChatSettingsTones } from "./settings/tone.js";
import ImagineCommand from "../commands/imagine.js";
import { format } from "../chat/utils/formatter.js";
import { Response } from "../command/response.js";
import { OtherPrompts } from "../chat/client.js";
import { Bot, BotStatus } from "../bot/bot.js";
import { Utils } from "../util/utils.js";
import { Emoji } from "../util/emoji.js";

import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { handleError } from "../util/moderation/error.js";
import { GPTAPIError } from "../error/gpt/api.js";

/* Permissions required by the bot to function correctly */
const BOT_REQUIRED_PERMISSIONS: { [key: string]: PermissionsString } = {
	"Add Reactions": "AddReactions",
	"Use External Emojis": "UseExternalEmojis",
	"Read Message History": "ReadMessageHistory",
	"Manage Webhooks": "ManageWebhooks"
}

export type MentionType = "interactionReply" | "reply" | "inMessage" | "user" | "role" | "dm"

enum GeneratorButtonType {
	Continue
}

export interface GeneratorOptions {
	/* Discord message, which triggered the generation */
	message: Message;

	/* Content of the message */
	content: string;

	/* Author of the message */
	author: User;

	/* Whether the user used the Continue button */
	button?: GeneratorButtonType;
}

export enum GeneratorSendType {
	/* A partial reply */
	Partial,

	/* The final version of the message */
	Final
}

export type GeneratorSendOptions = Pick<GeneratorOptions, "message"> & {
	response: Response;
	reply: Message | null;
	db: DatabaseInfo;
	type: GeneratorSendType;
}

export class Generator {
    /* Base class for everything */
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

	/**
	 * Process a partial or completed message into a readable & formatted Discord embed.
	 * @param data Response data
	 * 
	 * @returns Formatted Discord message
	 */
	public async process(conversation: Conversation, data: ResponseMessage, options: GeneratorOptions, db: DatabaseInfo, moderations: (ModerationResult | null)[], interaction: ChatGeneratedInteraction | null, pending: boolean): Promise<Response> {
		/* Embeds to display in the message */
		const embeds: EmbedBuilder[] = [];
		const response: Response = new Response();

		/* User's configured chat model */
		const model = conversation.model(db);
		const tone = conversation.tone(db);

		/* Formatted generated response */
		let content: string = format(data.display ?? data.text).trim();

		/* Which loading emoji to use */
		const loadingEmoji: string = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(conversation.manager.bot, db.user)
		);

		/* Subscription type of the user */
		const type: UserSubscriptionType = this.bot.db.users.type(db);

		/* Whether the remaining credit should be shown in the toolbar */
		const creditVisibility: PlanCreditVisility = type.type === "plan"
			? this.bot.db.settings.get<PlanCreditVisility>(type.location === "user" ? db.user : db.guild!, "premium:toolbar")
			: "hide";

		/* If the received data includes generated images, display them. */
		if (data.images && data.images.length > 0) {
			for (const [ index, image ] of data.images.entries()) {
				response.addAttachment(new AttachmentBuilder(image.data.buffer)
					.setName(`image-${index}.png`)
				);

				const builder = new EmbedBuilder()
					.setImage(`attachment://image-${index}.png`)
					.setColor(this.bot.branding.color);

				if (image.prompt) builder.setTitle(Utils.truncate(image.prompt, 100));
				if (image.duration) builder.setFooter({ text: `${(image.duration / 1000).toFixed(1)}s${image.notice ? ` • ${image.notice}` : ""}` });
				if (!image.duration && image.notice) builder.setFooter({ text: image.notice });

				embeds.push(builder);
			}
		}

		/* If the received message type is a notice message, display it accordingly. */
		if (data.type === "Notice") {
			response
				.setContent(null)
				.addEmbed(builder => builder
					.setDescription(`${data.text} ${pending ? `**...** ${loadingEmoji}` : ""}`)
					.setColor("Orange")
				);

			embeds.forEach(embed => response.addEmbed(embed));
			return response;
		}

		/* If the received data is a chat notice request, simply add the notice to the formatted message. */
		if (data.type === "ChatNotice") {
			embeds.push(new EmbedBuilder()
				.setDescription(`${(data as ChatNoticeMessage).notice} ${pending ? `**...** ${loadingEmoji}` : ""}`)
				.setColor("Orange")
			);

			pending = false;
		}

		for (const moderation of moderations) {
			/* Add a moderation notice, if applicable. */
			if (moderation !== null && (moderation.flagged || moderation.blocked)) embeds.push(new EmbedBuilder()
				.setDescription(
					!moderation.blocked
						? `${moderation.source === "user" ? "Your message" : `**${this.bot.client.user.username}**'s response`} may violate our **usage policies**. *If you use the bot as intended, you can ignore this notice.*`
						: `${moderation.source === "user" ? "Your message" : `**${this.bot.client.user.username}**'s response`} violates our **usage policies**. *If you continue to abuse the bot, we may have to take moderative actions*.`
				)
				.setColor(moderation.blocked ? "Red" : "Orange")
			);
		}

		/* Only show the daily limit, if the generation request is already finished. */
		if (!pending) {
			const buttons: ButtonBuilder[] = [];

			/* If the message got cut off, add a Continue button. */
			if (data.raw && data.raw.finishReason === "maxLength" && model.options.name !== "GPT-4") buttons.push(
				new ButtonBuilder()
					.setCustomId(`continue:${conversation.id}`)
					.setStyle(ButtonStyle.Success)
					.setLabel("Continue")
					.setEmoji("📜")
			);

			if (interaction !== null && creditVisibility && creditVisibility !== "hide") {
				/* Final formatted string */
				const final: string | null = PlanCreditViewers[creditVisibility](type.location === "user" ? db.user.plan! : db.guild!.plan!, interaction);

				if (final !== null) buttons.push(
					new ButtonBuilder()
						.setCustomId("premium:overview")
						.setLabel(final).setEmoji("💸")
						.setStyle(ButtonStyle.Secondary)
				);
			}

			buttons.push(
				new ButtonBuilder()
					.setCustomId("settings:menu:user:chat:model")
					.setLabel(model.options.name)
					.setEmoji(Emoji.display(model.options.emoji, true) as ComponentEmojiResolvable)
					.setStyle(ButtonStyle.Secondary)
			);

			if (tone.id !== ChatSettingsTones[0].id) buttons.push(
				new ButtonBuilder()
					.setCustomId("settings:menu:user:chat:tone")
					.setLabel(tone.options.name)
					.setEmoji(Emoji.display(tone.options.emoji, true) as ComponentEmojiResolvable)
					.setStyle(ButtonStyle.Secondary)
			);

			buttons.push(
				new ButtonBuilder()
					.setCustomId(`user:${conversation.id}`)
					.setDisabled(true)
					.setEmoji(this.bot.db.users.userIcon(db))
					.setLabel(conversation.user.tag)
					.setStyle(ButtonStyle.Secondary)
			);

			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(buttons);

			response.addComponent(ActionRowBuilder<ButtonBuilder>, row);
		}

		/* If the generated message finished due to reaching the token limit, show a notice. */
		if (!pending && data.raw && data.raw.finishReason === "maxLength") {
			embeds.push(new EmbedBuilder()
				.setDescription(`This message reached the length limit, and was not fully generated.${!this.bot.db.users.canUsePremiumFeatures(db) ? "\n✨ _**Premium** heavily increases the length limit, and grants you exclusive features - view \`/premium\` for more_." : ""}`)
				.setColor("Yellow")
			);

			content = `${content} **...**`;
		}

		/* If the previous message got cut off, add an indicator. */
		if (options.button === GeneratorButtonType.Continue) {
			content = `**...** ${content}`;
		}

		/* Generated response, with the pending indicator */
		const formatted: string = `${content} **...** ${loadingEmoji}`;

		/* If the message would be too long, send it as an attachment. */
		if (formatted.length > 2000) {
			response.addAttachment(new AttachmentBuilder(Buffer.from(content))
				.setName("output.txt")
			);

			response.setContent(pending ? loadingEmoji : "_ _");
		} else {
			/* Finally, set the actual content of the message. */
			response.setContent(pending ? formatted : content);
		}
		
		embeds.forEach(embed => response.addEmbed(embed));
		return response;
	}

	/**
	 * Handle interactions with the suggested response buttons on messages.
	 * @param button Button interaction to handle
	 */
	public async handleButtonInteraction(button: ButtonInteraction): Promise<void> {
		if (button.message.author.id !== this.bot.client.user.id) return;

		if (button.customId === "acknowledge-warning" || button.customId === "ignore" || button.customId === "send" || button.customId.startsWith("introduction-page-selector")) return;
		if (button.channelId === this.bot.app.config.channels.error.channel || button.channelId === this.bot.app.config.channels.moderation.channel) return;

		const parts: string[] = button.customId.split(":");
		if (parts.length === 1) return;

		/* Get the user identifier and action this button is meant for. */
		const action: string = parts[0];
		const id: string = parts[1];

		if (id !== "-1" && id !== button.user.id && !action.startsWith("image:view")) return void await button.deferUpdate();
		if (action !== "delete" && action !== "check-vote" && action !== "continue" && !action.startsWith("image:")) return;

		/* Get the user's conversation. */
		const conversation: Conversation = await this.bot.conversation.create(button.user);

		/* Get the user's database entry. */
		const db: DatabaseInfo = await this.bot.db.users.fetchData(button.user, button.guild);

		/* If the user interacted generated image, ... */
		if (action.startsWith("image:")) {
			return await (this.bot.command.get<ImagineCommand>("imagine")).handleButtonInteraction(button, conversation, action.replace("image:", ""), parts);

		/* If the user requsted to delete this interaction response, ... */
		} else if (action === "delete") {
			return void await button.message.delete().catch(() => {});

		/* Check if the user has voted for the bot, ... */
		} else if (action === "check-vote") {
			/* When the user already voted for the bot, if applicable */
			const when: number | null = this.bot.db.users.voted(db.user);

			if (when !== null) return void await button.reply(
				new Response()
					.addEmbed(builder => builder
						.setDescription(`You have already voted for the bot <t:${Math.round(when / 1000)}:R>, thank you for your support! 🎉`)
						.setColor(this.bot.branding.color)
					)
					.setEphemeral(true)
				.get() as InteractionReplyOptions
			);

			await button.deferReply({
				ephemeral: true
			});

			try {
				/* Try to check whether the user voted for the bot using the top.gg API. */
				const voted: boolean = await this.bot.vote.voted(button.user, db.user);

				if (!voted) return void new ErrorResponse({
					interaction: button, message: "You haven't voted for the bot yet", emoji: "😕"
				}).send(button);
				

				return void await new Response()
					.addEmbed(builder => builder
						.setDescription(`Thank you for voting for the bot! 🎉`)
						.setColor(this.bot.branding.color)
					)
					.setEphemeral(true)
				.send(button);

			} catch (error) {
				await handleError(this.bot, {
					error: error as Error, reply: false, title: "Failed to check whether the user has voted"
				});

				return void new ErrorResponse({
					interaction: button, type: ErrorType.Error, message: "It seems like something went wrong while trying to check whether you've voted for the bot."
				}).send(button);
			}
		}

		/* Remaining cool-down time */
		const remaining: number = (conversation.cooldown.state.startedAt! + conversation.cooldown.state.expiresIn!) - Date.now();

		/* If the command is on cool-down, don't run the request. */
		if (conversation.cooldown.active && remaining > Math.min(conversation.cooldown.state.expiresIn! / 2, 10 * 1000)) {
			const reply = await button.reply({
				embeds: conversation.cooldownMessage(db),
				ephemeral: true
			}).catch(() => null);

			if (reply === null) return;

			/* Once the cool-down is over, delete the invocation and reply message. */
			setTimeout(async () => {
				await button.deleteReply().catch(() => {});
			}, remaining);

			return;
		}
		
		if (conversation.generating) return void await new Response()
			.addEmbed(builder => builder
				.setDescription("You already have a request running in your conversation, *wait for it to finish* 😔")
				.setColor("Red")
			)
			.setEphemeral(true)
		.send(button);

		/* Continue generating the cut-off message. */
		if (action === "continue") {
			await button.deferUpdate();

			await this.handle({
				button: GeneratorButtonType.Continue,
				content: OtherPrompts.Continue,
				message: button.message,
				author: button.user
			});
		}
	}

	public async guildData(message: Message, author: User, mentions: MentionType | null): Promise<ChatGuildData | null> {
		/* If the invocation message was sent in DMs, don't try to get data about the guild. */
		if (mentions === "dm" || message.member === null || message.guild === null) return null;
		if (!(message.channel instanceof TextChannel)) return null;

		return {
			guild: message.guild,
			member: message.member,
			channel: message.channel,
			owner: await message.guild.fetchOwner()
		};
	}

	private mentions(message: Message): MentionType | null {
		if (message.mentions.everyone) return null;
		if (message.channel.type === ChannelType.DM) return "dm";

		if (message.reference && message.reference.messageId && message.channel.messages.cache.get(message.reference.messageId) && message.channel.messages.cache.get(message.reference.messageId)!.interaction) return "interactionReply";
		if (message.mentions.repliedUser !== null && message.mentions.repliedUser.id === this.bot.client.user.id && message.mentions.users.get(this.bot.client.user.id)) return "reply";

		if (message.content.startsWith(`<@${this.bot.client.user.id}>`) || message.content.startsWith(`<@!${this.bot.client.user.id}>`) || message.content.endsWith(`<@${this.bot.client.user.id}>`) || message.content.endsWith(`<@!${this.bot.client.user.id}>`)) return "user";
		else if (message.content.includes(`<@${this.bot.client.user.id}>`)) return "inMessage";
		
		const roles: Role[] = Array.from(message.mentions.roles.values());
		const mentionedRole: boolean = roles.find(r => !r.editable && ([ "ChatGPT", "Turing" ].includes(r.name))) != undefined;

		if (mentionedRole) return "role";
		return null;
	}

    /**
     * Process the specified Discord message, and if it is valid, send a request to
     * the chat handler to generate a response for the message content.
     * 
     * @param message Message to process
     * @param existing Message to edit, instead of sending a new reply
     */
    public async handle(options: GeneratorOptions): Promise<void> {
		const messageContent: string = options.content;
		const { message, author } = options;

		/* Check whether the bot was mentioned in the message, directly or indirectly. */
		const mentions = this.mentions(message);

		/* If the message was sent by a bot, or the bot wasn't mentioned in the message, return. */
		if (options.button == undefined && (author.bot || mentions === null)) return;

		/* If the message was sent in the error or moderation channel, ignore it entirely. */
		if (message.channelId === this.bot.app.config.channels.error.channel || message.channelId === this.bot.app.config.channels.moderation.channel) return;

		/* If the message is a reply to an interaction, ignore it. */
		if (mentions === "interactionReply") return;
		const guild: Guild | null = message.guild;

		/* Current status of the bot */
		const status: BotStatus = await this.bot.status();

		if (status.type === "maintenance") return void await new Response()
			.addEmbed(builder => builder
				.setTitle("The bot is currently under maintenance 🛠️")
				.setDescription(status.notice !== undefined ? `*${status.notice}*` : null)
				.setTimestamp(status.since)
				.setColor("Orange")
			).send(options.message);

		/* Clean up the message's content. */
		let content: string = Utils.cleanContent(this.bot, messageContent);

		/* If the user mentioned the role instead of the user, and the message doesn't have any content,
		   show the user a small notice message telling them to ping the bot instead. */
		if (mentions === "role" && content.length === 0) {
			return void await new Response()
				.addEmbed(builder => builder
					.setTitle("Hey there... 👋")
					.setColor("Yellow")
					.setDescription("To chat with me, you need to ping the **user** instead of the role. *Then, I'll be able to chat with you normally*.")
				)
			.send(options.message).catch(() => {});
		}

		/* If the user mentioned the bot somewhere in the message (and not at the beginning), react with a nice emoji. */
		if (mentions === "inMessage") return void await addReaction(this.bot, message, "👋").catch(() => {});

		/* Get the user & guild data from the database, if available. */
		const db = await this.bot.db.users.fetchData(author, guild);

		const banned: DatabaseUserInfraction | null = this.bot.db.users.banned(db.user);
		const unread: DatabaseUserInfraction[] = this.bot.db.users.unread(db.user);

		/* If the user is banned from the bot, send a notice message. */
		if (banned !== null) return void buildBanNotice(this.bot, db.user, banned).send(message);

		if (unread.length > 0) {
			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setCustomId("acknowledge-warning")
						.setLabel("Acknowledge")
						.setStyle(ButtonStyle.Danger)
				);

			const reply: Message = await new Response()
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
				).send(message) as Message;

			/* Wait for the `Acknowledge` button to be pressed, or for the collector to expire. */
			const collector = reply.createMessageComponentCollector<ComponentType.Button>({
				componentType: ComponentType.Button,
				filter: i => i.user.id === author.id && i.customId === "acknowledge-warning",
				time: 60 * 1000,
				max: 1
			});

			/* When the collector is done, delete the reply message & continue the execution. */
			await new Promise<void>(resolve => collector.on("end", async () => {
				await reply.delete().catch(() => {});
				resolve();
			}));

			/* Mark the unread messages as read. */
			await this.bot.db.users.read(db.user, unread);
			db.user = await this.bot.db.users.fetchUser(author);
		}

		/* Whether the user can access Premium features */
		const premium: boolean = this.bot.db.users.canUsePremiumFeatures(db);

		/* Conversation of the author */
		let conversation: Conversation = null!;

		try {
			/* Get the author's active conversation. */
			conversation = this.bot.conversation.get(author)!;

			/* If the conversation is still `null`, try to create a conversation from the database for this user. */
			if (conversation === null) conversation = await this.bot.conversation.create(author);
		
			/* If the conversation's session is locked at this point - meaning that is either initializing or refreshing - notify the user. */
			if (conversation.manager.session.locked) return void await new Response()
				.addEmbed(builder => builder
					.setDescription("Your assigned session is currently starting up ⏳")
					.setColor("Yellow")
			).send(message).catch(() => {});

			/* Initialize the user's conversation, if not done already. */
			if (!conversation.active) await conversation.init();

		} catch (error) {
			if (error instanceof Error && error.message == "Session is busy") return void await new Response()
				.addEmbed(builder => builder
					.setDescription("Your assigned session is currently starting up ⏳")
					.setColor("Yellow")
			).send(message);

			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.NoFreeSessions) return void await new Response()
				.addEmbed(builder => builder
					.setTitle("Uh-oh... 😬")
					.setDescription("We are currently dealing with *a lot* of traffic & are **not** able to process your message at this time.")
					.setFooter({ text: "Please try again later." })
					.setColor("Red")
				).send(message);

			await handleError(this.bot, {
				message,
				reply: false,
				error: error as Error
			});

			return void await new Response()
				.addEmbed(builder => builder
					.setTitle("Uh-oh... 😬")
					.setDescription("It seems like we experienced an issue while trying to resume your conversation.\n*The developers have been notified*.")
					.setColor("Red")
				).send(message).catch(() => {});
		}

		const attachedImages: boolean = (await conversation.manager.session.client.findMessageImageAttachments(message)).length > 0;
		const attachedDocuments: boolean = conversation.manager.session.client.hasMessageDocuments(message);

		/* If the user sen't an empty message, respond with the introduction message. */
		if (content.length === 0 && !attachedImages && !attachedDocuments) {
			const page: Response = await buildIntroductionPage(this.bot, author);
			return void await page.send(options.message);
		}

		if (conversation.generating) return void await new Response()
			.addEmbed(builder => builder
				.setDescription("You already have a request running in your conversation, *wait for it to finish* 😔")
				.setColor("Red")
			).send(message).catch(() => {});

		/* Remaining cool-down time */
		const remaining: number = conversation.cooldown.remaining;
		if (conversation.cooldown.active) await this.bot.db.users.incrementInteractions(db.user, "cooldown_messages");

		/* If the command is on cool-down, don't run the request. */
		if (conversation.cooldown.active && remaining > Math.min(conversation.cooldown.state.expiresIn! / 2, 10 * 1000)) {
			const reply = await message.reply({
				embeds: conversation.cooldownMessage(db)
			}).catch(() => null);

			if (reply === null) return;

			/* Once the cool-down is over, delete the invocation and reply message. */
			setTimeout(async () => {
				await reply.delete().catch(() => {});
			}, remaining);

			await addReaction(this.bot, message, "🐢");
			return;

		/* If the remaining time is negligible, wait for the cool-down to expire. */
		} else if (conversation.cooldown.active) {
			conversation.generating = true;

			await addReaction(this.bot, message, "⌛");
			await new Promise<void>(resolve => setTimeout(resolve, remaining));
			await removeReaction(this.bot, message, "⌛");

			conversation.generating = false;
		}

		/* User's configured chat model */
		const settingsModel: ChatSettingsModel = conversation.model(db);

		/* Model to use for chat generation, as specified by the user's configured model */
		const model: ChatModel = conversation.manager.session.client.modelForSetting(settingsModel);
		
		/* If the user is trying to use a Premium-only model, while not having access to one anymore, simply set it back to the default. */
		if (settingsModel.premiumOnly && !this.bot.db.users.canUsePremiumFeatures(db)) {
			db.user = await this.bot.db.settings.apply(db.user, {
				"chat:model": ChatSettingsModels[0].id
			});
		}

		/* If the user attached images to their messages, but doesn't have Premium access, ignore their request. */
		if (attachedImages && !premium) return void await new Response()
			.addEmbed(builder => builder
				.setDescription(`🖼️ **${this.bot.client.user.username}** will be able to view your images with **Premium**.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
				.setColor("Orange")
			).send(message);

		/* If the user attached images to their message, and is currently on a model that doesn't support image attachments, show them a notice. */
		if (!model.hasCapability(ModelCapability.ImageViewing) && attachedImages) return void await new Response()
			.addEmbed(builder => builder
				.setDescription(`The selected model **${settingsModel.options.name}** ${Emoji.display(settingsModel.options.emoji, true)} cannot view images 😔`)
				.setColor("Red")
			).send(message);

		if (model.hasCapability(ModelCapability.GuildOnly) && !message.guild) return void await new Response()
			.addEmbed(builder => builder
				.setDescription(`The selected model **${settingsModel.options.name}** ${Emoji.display(settingsModel.options.emoji, true)} only works on servers, not in DMs 😔`)
				.setColor("Red")
			).send(message);

		conversation.generating = true;

		/* If the message content was not provided by another source, check it for profanity & ask the user if they want to execute the request anyways. */
		const moderation: ModerationResult | null = content.length > 0 && !options.button ? await moderate({
			conversation, db, content, message,
			source: "user"
		}) : null;

		conversation.generating = false;

		/* If the message was flagged, stop this request. */
		if (moderation !== null && moderation.blocked) return;

		/* Reply message placeholder */
		let reply: Message | null = null;

		/* Response data */
		let final: ChatGeneratedInteraction = null!;
		let data: ResponseMessage | null = null!;
		let queued: boolean = false;

		/* Whether partial results should be shown, and how often they should be updated */
		const partial: boolean = this.bot.db.settings.get<boolean>(db.user, "chat:partialMessages") && premium;
		const updateTime: number = this.bot.db.users.canUsePremiumFeatures(db) ? 2500 : 5500;

		let typingTimer: NodeJS.Timer | null = setInterval(async () => {
			try {
				await message.channel.sendTyping();
			} catch (_) {}
		}, 7500);

		const updateTimer = setInterval(async () => {
			/* If no data has been generated yet, skip it this time. */
			if (data === null || (!partial && (data.type === "Chat" || data.type === "ChatNotice"))) return;

			/* Generate a nicely formatted embed. */
			const response: Response | null = await this.process(
				conversation, data, options, db, [ moderation ], null, true
			);

			/* Send an initial reply placeholder. */
			if (reply === null && final === null && !queued && (partial || (!partial && (data.type !== "Chat" && data.type !== "ChatNotice")))) {
				queued = true;

				if (response === null) {
					queued = false;
					return;
				}

				if (typingTimer !== null) {
					clearInterval(typingTimer);
					typingTimer = null;
				}

				reply = await this.send({
					message, reply, response, db, type: GeneratorSendType.Partial
				});

				queued = false;

			} else if (reply !== null && !queued && (partial || (!partial && (data.type !== "Chat" && data.type !== "ChatNotice")))) {	
				try {
					/* Edit the sent message. */
					if (reply !== null && response !== null) reply = await this.send({
						message, reply, response, db, type: GeneratorSendType.Partial
					});

				} catch (error) {
					reply = null!;
					queued = false;
				}
			}
		}, updateTime);

		const onProgress = async (raw: ResponseMessage): Promise<void> => {
			/* Update the current response data. */
			data = raw;
		};

		/* Remove all components from the previous reply, if applicable. */
		if (conversation.previous !== null && conversation.previous.reply !== null) {
			if (conversation.previous.reply.webhookId) {
				/* Fetch the corresponding webhook. */
				const webhook = await this.bot.webhook.fetch(conversation.previous.reply.channel as BaseGuildTextChannel);

				await this.bot.webhook.edit(conversation.previous.reply.channel as BaseGuildTextChannel, conversation.previous.reply, webhook, {
					components: []
				}).catch(() => {});
			} else {
				await conversation.previous.reply.edit({
					components: []
				}).catch(() => {});
			}
		}

		/**
		 * Update the existing reply or send a new reply, to show the error message.
		 * @param response Response to send
		 */
		const sendError = async (response: Response, notice: boolean = true): Promise<void> => {
			/* Wait for the queued message to be sent. */
			while (queued) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			try {
				clearInterval(updateTimer);
				if (notice) response.embeds[0].setDescription(`${response.embeds[0].data.description}\n_If you continue to experience issues, join the **[support server](${Utils.supportInvite(this.bot)})**_.`);

				if (reply === null) await response.send(message);
				else await reply.edit(response.get() as MessageEditOptions);

			} catch (_) {}
		}

		/* Information about the guild the user invoked the bot on, if applicable */
		const guildData: ChatGuildData | null = model.hasCapability(ModelCapability.GuildOnly)
			? await this.guildData(message, author, mentions) : null;

		/* Which loading emoji to use */
		const loadingIndicator: LoadingIndicator = LoadingIndicatorManager.getFromUser(conversation.manager.bot, db.user);
		const loadingEmoji: string = `${loadingIndicator.emoji.name}:${loadingIndicator.emoji.id}`;

		/* Start the generation process. */
		try {
			if (mentions !== "dm") await addReaction(this.bot, message, loadingEmoji);
			await message.channel.sendTyping();

			/* Send the request to the selected chat model. */
			final = await conversation.generate({
				...options,
				conversation, db, partial,

				guild: guildData,
				prompt: content,
				trigger: message,
				onProgress: onProgress,
				moderation: moderation
			});

		} catch (err) {
			/* Figure out the generation error, that actually occurred */
			const error: GPTGenerationError | GPTAPIError | DiscordAPIError | Error = err as Error;
			if (error instanceof DiscordAPIError) return;

			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.NoFreeSessions) return await sendError(new Response()
				.addEmbed(builder => builder
					.setTitle("Uh-oh... 😬")
					.setDescription("We are currently dealing with *a lot* of traffic & are **not** able to process your message at this time 😔")
					.setFooter({ text: "Please try again later." })
					.setColor("Red")
				), false);

			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Empty) return await sendError(new Response()
				.addEmbed(builder => builder
					.setDescription(`**${this.bot.client.user.username}**'s response was empty for this prompt, *please try again* 😔`)
					.setColor("Red")
				), false);

			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Length) return await sendError(new Response()
				.addEmbed(builder => builder
					.setDescription(`Your message is too long for **${settingsModel.options.name}**. ${Emoji.display(settingsModel.options.emoji, true)}\n\n*Try resetting your conversation, and sending shorter messages to the bot, in order to avoid reaching the limit*.`)
					.setColor("Red")
				), false);

			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Busy) return await sendError(new Response()
				.addEmbed(builder => builder
					.setDescription("You already have a request running in your conversation, *wait for it to finish* 😔")
					.setColor("Red")
				), false);

			if (error instanceof GPTAPIError && error.isServerSide()) {
				await handleError(this.bot, {
					message, error, reply: false,
					title: "Server-side error"
				});

				return await sendError(new Response()
					.addEmbed(builder => builder
						.setTitle("Uh-oh... 😬")
						.setDescription(`**${settingsModel.options.name}** ${Emoji.display(settingsModel.options.emoji, true)} is currently experiencing *server-side* issues.`)
						.setColor("Red")
					)
				);
			}

			/* Try to handle the error & log the error message. */
			await handleError(this.bot, {
				message, error, reply: false
			});

			return await sendError(new Response()
				.addEmbed(builder => builder
					.setTitle("Uh-oh... 😬")
					.setDescription("It seems like we had trouble generating a response for your message.")
					.setColor("Red")
				));

		} finally {
			/* Clean up the timers. */
			if (typingTimer !== null) clearInterval(typingTimer);
			clearInterval(updateTimer);

			if (mentions !== "dm") await removeReaction(this.bot, message, loadingEmoji);
		}

		/* Try to send the response & generate a nice embed for the message. */
		try {
			/* If everything went well, increase the usage for the user too. */
			await this.bot.db.users.incrementInteractions(db.user, "messages");

			/* If the output is empty for some reason, set a placeholder message. */
			if (final.output.text.length === 0) {
				final.output.text = `**${this.bot.client.user.username}**'s response was empty for this prompt, *please try again* 😔`;
				final.output.type = MessageType.Notice;
			}

			/* Gemerate a nicely formatted embed. */
			const response: Response | null = final !== null ? await this.process(
				conversation, final.output, options, db, [ moderation, final.moderation ], final, false
			) : null;

			/* If the embed failed to generate, send an error message. */
			if (response === null) return await sendError(new Response()
				.addEmbed(builder => builder
					.setTitle("Uh-oh... 😬")
					.setDescription(`It seems like we had trouble generating the reply for your request.`)
					.setColor("Red")
				));

			/* Wait for the queued message to be sent. */
			while (queued) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			/* Edit & send the final message. */
			reply = await this.send({
				message, reply, response, db, type: GeneratorSendType.Final
			});

			/* Update the reply message in the history entry, if the conversation wasn't reset. */
			if (conversation.history.length > 0) conversation.history[conversation.history.length - 1].reply = reply;

			if (mentions !== null) await this.bot.db.metrics.changeChatMetric({
				sources: {
					[mentions]: "+1"
				}
			});

		} catch (error) {
			/* Don't try to handle Discord API errors, just send the user a notice message in DMs. */
			if (error instanceof DiscordAPIError) {
				try {
					/* Create the DM channel, if it doesn't already exist. */
					const channel: DMChannel = await this.bot.client.users.createDM(author.id);
			
					await new Response()
						.addEmbed(builder => builder
							.setTitle("Uh-oh... 😬")
							.setDescription(`It seems like the permissions in <#${message.channel.id}> aren't set up correctly for me. Please contact a server administrator and tell them to check all of these permissions:\n\n${Object.keys(BOT_REQUIRED_PERMISSIONS).map(key => `• \`${key}\``).join("\n")}\n\n_If you're repeatedly having issues, join our **[support server](${Utils.supportInvite(this.bot)})**_.`)
							.setColor("Red")
						)
					.send(channel);
				} catch (_) {}
			}

			await handleError(this.bot, {
				error: error as Error, title: "Failed to send reply", reply: false, message				
			});
		}
    }

	private async send({ message, reply, response, db }: GeneratorSendOptions): Promise<Message | null> {
		/* If the message was sent on a guild, ... */
		if (db.guild && message.channel instanceof BaseGuildTextChannel) {
			/* Custom character mode */
			const mode = this.bot.webhook.mode(db.guild);

			if (mode !== "off") {
				/* Get the webhook to use for this channel. */
				const webhook = await this.bot.webhook.fetch(message.channel);
				const raw = response.get() as WebhookMessageCreateOptions;

				const data: WebhookMessageCreateOptions = {
					...this.bot.webhook.base(db.guild),
					...raw as WebhookMessageCreateOptions
				};

				if (reply !== null) return await this.bot.webhook.edit(message.channel as BaseGuildTextChannel, reply, webhook, data);
				else return await this.bot.webhook.send(message.channel as BaseGuildTextChannel, webhook, data);
			}
		}

		try {
			if (reply !== null) return await reply.edit(response.get() as MessageEditOptions);
			else return await message.reply(response.get() as MessageReplyOptions);

		} catch (_) {
			try {
				if (reply !== null) return await message.reply(response.get() as MessageCreateOptions);
				return await message.channel.send(response.get() as MessageCreateOptions);
			} catch (_) {
				return null;
			}
		}
	}
}