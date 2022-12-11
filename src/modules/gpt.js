import { ChatGPTAPI } from "chatgpt";
import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();

var api;

async function initChat() {
  var username = process.env.USER;
  var password = process.env.PASSWORD;
  const token = await chatgptToken(username, password);
  if (!token) {
    console.log("error");
  } else {
    api = new ChatGPTAPI({
      sessionToken: token,
    });
    // ensure the API is properly authenticated
    await api.ensureAuth();
  }
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
