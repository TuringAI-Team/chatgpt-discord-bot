import { ChatGPTAPI } from "chatgpt";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

const api = new ChatGPTAPI({
  sessionToken: process.env.SESSION_TOKEN,
});

async function initChat() {
  // ensure the API is properly authenticated
  await api.ensureAuth();
}
async function chat(msg) {
  const response = await api.sendMessage(msg);
  return response;
}
async function createConversation() {
  var conversation = api.getConversation();
  return conversation;
}

export { chat, initChat, createConversation };
