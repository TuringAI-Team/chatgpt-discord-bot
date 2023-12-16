import { delay } from "@discordeno/utils";
import { Conversation, ConversationHistory, ConversationMessage } from "../../types/models/conversations.js";
import { get, insert, update } from "./db.js";

export async function getConversation(userId: string, modelName: string) {
	const conversation = (await get({
		collection: "conversations",
		id: `${userId}-${modelName}`,
	})) as Conversation;
	if (!conversation) return null;
	const numberOfUserMessages = conversation.history.messages.filter((x) => x.role === "user").length;
	const numberOfBotMessages = conversation.history.messages.filter((x) => x.role !== "user").length;
	// for each 2 messages, there would be 1 bot message
	if (numberOfUserMessages > numberOfBotMessages * 2) {
		const updatedConversation = {
			history: {
				datasetId: conversation.history.datasetId,
				messages: [],
			},
			last_update: Date.now(),
		};
		await update("conversations", conversation.id, updatedConversation);
		conversation.history.messages = [];
	}
	return conversation;
}

export async function addMessageToConversation(conversation: Conversation, message: ConversationMessage) {
	const updatedConversation = {
		history: {
			datasetId: conversation.history.datasetId,
			messages: [
				...conversation.history.messages,
				{
					role: message.role,
					content: message.content,
				},
			],
		},
		last_update: Date.now(),
	};
	await update("conversations", conversation.id, updatedConversation);
}
export async function addMessagesToConversation(conversation: Conversation, messages: ConversationMessage[]) {
	const updatedConversation = {
		history: {
			datasetId: conversation.history.datasetId,
			messages: [
				...conversation.history.messages,
				...messages.map((x) => ({
					role: x.role,
					content: x.content,
				})),
			],
		},
		last_update: Date.now(),
	};
	await update("conversations", conversation.id, updatedConversation);
}
export async function newConversation(messages: ConversationMessage[], userId: string, modelName: string) {
	const newConversation = {
		history: {
			datasetId: "",
			messages: messages,
		},
		last_update: Date.now(),
		model: modelName,
		user: userId,
		id: `${userId}-${modelName}`,
	} as Conversation;
	await insert(
		"conversations",
		{
			...newConversation,
		},
		`${userId}-${modelName}`,
	);
	return newConversation;
}

export async function resetConversation(userId: string, modelName: string) {
	const conversation = await getConversation(userId, modelName);
	if (!conversation) return;
	const updatedConversation = {
		history: {
			datasetId: conversation.history.datasetId,
			messages: [],
		},
		last_update: Date.now(),
	};
	await update("conversations", conversation.id, updatedConversation);
	return true;
}
