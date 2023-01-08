//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import delay from "delay";
dotenv.config();
import chalk from "chalk";
import fetch from "node-fetch";
import { useToken, addMessage, removeMessage } from "./loadbalancer.js";

var abled = false;

async function getStatus() {
  return abled;
}
async function checkId(client) {
  try {
    if (client != "loading") {
      var status = await client.status();
      console.log(status);
      if (status == "ready") {
        abled = true;
      }
    }

    return abled;
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function chat(message) {
  var token = await useToken();
  if (!token) {
    return {
      error: `Wait 1-2 mins the bot is reloading or we are reaching our capacity limits.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
  if (token.error) {
    return token.error;
  }
  await addMessage(token.id);
  try {
    var response = await token.client.sendMessage(message);
    console.log(message, response);
    await removeMessage(token.id);
    return response.response;
  } catch (err) {
    console.log(err);
    await removeMessage(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}
async function createConversation(initMessage) {
  var conversationId;
  var token = await useToken();
  if (!token) {
    return `Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
  }
  if (token.error) {
    return token.error;
  }
  await addMessage(token.id);
  try {
    var response = await token.client.sendMessage(initMessage);
    await removeMessage(token.id);
    conversationId = response.conversationId;
    return {
      response: response.response,
      conversationId: conversationId,
      send: async (msg) => {
        var response = await token.client.sendMessage(msg, {
          conversationId: conversationId,
        });
        return response.response;
      },
    };
  } catch (err) {
    console.log(err);
    await removeMessage(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}

export { chat, getStatus, createConversation };
