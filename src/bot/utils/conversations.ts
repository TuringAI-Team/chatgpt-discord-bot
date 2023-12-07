import {
  Conversation,
  ConversationHistory,
  ConversationMessage,
} from "../../types/models/conversations.js";
import { get, insert, update } from "./db.js";

export async function getConversation(userId: string, modelName: string) {
  const conversation = (await get({
    collection: "conversations",
    filter: {
      id: `${userId}-${modelName}`,
      user: userId,
      model: modelName,
    },
  })) as Conversation[];
  if (conversation.length === 0) return null;
  return conversation[0];
}

export async function addMessageToConversation(
  conversation: Conversation,
  message: ConversationMessage
) {
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

export async function newConversation(
  message: ConversationMessage,
  userId: string,
  modelName: string
) {
  await insert(
    "conversations",
    {
      history: {
        datasetId: "",
        messages: [message],
      },
      last_update: Date.now(),
      model: modelName,
      user: userId,
    },
    `${userId}-${modelName}`
  );
  const conversation = await getConversation(userId, modelName);
  return conversation;
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
