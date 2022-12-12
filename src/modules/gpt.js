import { ChatGPTAPI } from "chatgpt";
import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import chalk from "chalk";

var api = "loading";

async function initChat() {
  console.log(chalk.grey("Starting ChatGPT API"));

  var username = process.env.CHATGPT_USER;
  var password = process.env.CHATGPT_PASSWORD;
  var token;
  /* try {
    token = await chatgptToken(username, password);
  } catch (e) {
    if (!token) {
      token = process.env.SESSION_TOKEN;
    }
  }*/
  token = process.env.SESSION_TOKEN;

  api = new ChatGPTAPI({
    sessionToken: token,
  });
  console.log(chalk.green("ChatGPT API init successfully"));
  // ensure the API is properly authenticated
  await api.ensureAuth();
}
async function chat(msg) {
  if (api == "loading") {
    return `Wait 1-2 mins the bot is reloading .`;
  }
  const response = await api.sendMessage(msg);
  return response;
}
async function createConversation() {
  if (api == "loading") {
    return `Wait 1-2 mins the bot is reloading .`;
  }
  var conversation = api.getConversation();
  return conversation;
}

export { chat, initChat, createConversation };
