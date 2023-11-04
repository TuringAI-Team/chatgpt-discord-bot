import {
	BigString,
	Bot,
	ButtonComponent,
	ButtonStyles,
	Collection,
	CreateMessageOptions,
	Message,
	MessageComponentTypes,
	delay,
} from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { Environment } from "../../types/other.js";
import { env } from "../utils/db.js";
import { LOADING_INDICATORS } from "../../types/models/users.js";
import { CHAT_MODELS } from "../models/index.js";
import EventEmitter from "events";
import { addMessageToConversation, getConversation, newConversation } from "../utils/conversations.js";

export default createCommand({
	body: {
		name: "chat",
		description: "Chat with the bot",
		options: [
			{
				type: "String",
				name: "prompt",
				description: "The prompt that will be used for the text generation",
				max_length: 1000,
				required: true,
			},
		],
	},
	cooldown: {
		user: 30 * 1000,
		voter: 2 * 60 * 1000,
		subscription: 60 * 1000,
	},
	interaction: async ({ interaction, options, env }) => {
		const edit = async (message: CreateMessageOptions) => await interaction.edit(message).catch((...args) => ['chat interaction', interaction, ...args].forEach(x => interaction.bot.logger.warn(x)));
		await buildInfo(interaction.bot, interaction.user.id, edit, interaction.guildId, options);
	},
	message: async ({ message, bot, args, env }) => {
		const parser = { getString: () => args.join(" ") } as unknown as OptionResolver;
		let previousMsg: Message | undefined;
		const edit = async (msg: CreateMessageOptions) => {
			//	console.log(previousMsg ? previousMsg.id : "no previous message");
			if (previousMsg?.id) {
				previousMsg = await bot.helpers.editMessage(previousMsg.channelId, previousMsg.id, msg).catch((...args) => {
					['chat message', previousMsg, ...args].forEach(x => bot.logger.warn(x))
					return undefined;
				});
			} else {
				previousMsg = await bot.helpers.sendMessage(message.channelId, {
					...msg,
					messageReference: {
						failIfNotExists: false,
						messageId: message.id,
						guildId: message.guildId,
					},
				});
			}
		};
		await buildInfo(bot, message.author.id, edit, message.guildId, parser);
	},
});

async function buildInfo(
	bot: Bot,
	userId: bigint,
	edit: (message: CreateMessageOptions) => void,
	guildId?: BigString,
	options?: OptionResolver,
): Promise<void> {
	//const envrionment = await env(userId.toString(), guildId?.toString());

	const prompt: string = options?.getString("prompt") ?? "";
	const modelName = "openchat";
	const model = CHAT_MODELS.find((x) => x.id === modelName);
	if (!model) {
		return await edit({
			content: "Model not found",
		});
	}
	let conversation = await getConversation(userId.toString(), modelName);
	const history = conversation?.history ?? {
		messages: [],
	};
	const event = await model.run(bot.api, {
		max_tokens: 200,
		messages: [
			...history.messages,
			{
				role: "user",
				content: prompt,
			},
		],
	});
	if (conversation) {
		await addMessageToConversation(conversation, {
			role: "user",
			content: prompt,
		});
	} else {
		conversation = await newConversation(
			{
				role: "user",
				content: prompt,
			},
			userId.toString(),
			modelName,
		);
	}
	if (!event || !(event instanceof EventEmitter)) {
		return await edit({
			content: "An error occurred",
		});
	}
	const loadingIndicator = LOADING_INDICATORS[Math.floor(Math.random() * 5)];
	let lastUpdate = Date.now();
	let done = false;
	event.on("data", async (data) => {
		if (data.result == "") return;
		if (!data.done) {
			if (lastUpdate + 1000 < Date.now() && !done) {
				// if last update was more than 1 second ago
				lastUpdate = Date.now();
				await edit({
					content: `${data.result}<${loadingIndicator.emoji.animated ? "a" : ""}:${loadingIndicator.emoji.name}:${loadingIndicator.emoji.id
						}>`,
				});
			}
		} else {
			done = true;
			if (conversation) {
				await addMessageToConversation(conversation, {
					role: "assistant",
					content: data.result,
				});
			}
			// if last update was less than 1 second ago, wait 1 second
			if (lastUpdate + 1000 > Date.now()) await delay(1000);
			await edit({
				content: `${data.result}`,
				components: [
					{
						type: MessageComponentTypes.ActionRow,
						components: [
							{
								type: MessageComponentTypes.Button,
								label: model.name,
								customId: "settings_open_models",
								disabled: true,
								emoji: {
									name: model.emoji.name,
									id: BigInt(model.emoji.id),
								},
								style: ButtonStyles.Secondary,
							},
						],
					},
				],
			});
		}
	});

	/*return {
		embeds: [
			{
				title: "The bot is under maintenance",
				description: `The bot is currently under maintenance, please try again later. Join our support server for more information.\n\n**How can I help?**\n- Be patient.\n- You can donate to the project in order to be able to continue providing this service for free`,
				color: config.brand.color,
			},
		],
		components: [
			{
				type: MessageComponentTypes.ActionRow,
				components: [
					{
						type: MessageComponentTypes.Button,
						label: "Support Server",
						url: `https://discord.gg/${config.brand.invite}`,
						style: ButtonStyles.Link,
					},
					{
						// KO-FI
						type: MessageComponentTypes.Button,
						label: "Donate to the project",
						emoji: {
							id: 1162684912206360627n,
							name: "kofi",
						},
						url: "https://ko-fi.com/mrloldev",
						style: ButtonStyles.Link,
					},
				],
			},
		],
	};*/
}
