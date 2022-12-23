//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import Client from "justbrowse.io";
import delay from "delay";
dotenv.config();
import chalk from "chalk";

var client = "loading";
var abled = false;

async function initChat() {
  try {
    client = new Client(process.env.SESSION_TOKEN, process.env.API_TOKEN);
    await client.init();
    abled = false;
  } catch (err) {
    console.error(err);
    client = "loading";
  }
  console.log("loaded");
}
async function getStatus() {
  return abled;
}
async function checkId() {
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

async function createConversation(initialMessage) {
  if (!abled) {
    var check = await checkId();
    if (!check) {
      return `Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
  }
  var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.API_TOKEN}`,
    },
    body: JSON.stringify({
      message: initialMessage,
    }),
  });
  if (response.status != 200) {
    if (response.status == 429) {
      return `The bot have exceed the rate limit please wait some seconds. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    console.log(response);
    return `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`;
  }
  var json = await response.json();
  var conversationId = json.conversationId;
  return {
    id: conversationId,
    stopConversation: async () => {
      var response = await fetch(
        `${process.env.API_URL}/chat/${id}/reset?conversationId=${conversationId}`
      );
      var json = await response.json();
      return true;
    },
  };
}
async function conversationSendMessage(conversationId, message) {
  console.log(message);
  var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",

      authorization: `Bearer ${process.env.API_TOKEN}`,
    },
    body: JSON.stringify({
      message: message,
      conversationId: conversationId,
    }),
  });
  if (response.status != 200) {
    if (response.status == 429) {
      return `The bot have exceed the rate limit please wait some seconds. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    return `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`;
  }
  var json = await response.json();
  if (!json || !json.reply || json.reply.length < 0) {
    console.log(json);
    if (json.reason == "wrong id") {
      await initChat();
      return `Something wrong happened, please wait we are reloading the bot [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    return `Something wrong happened, please report this issue using /feedback or joining [dsc.gg/turing](https://dsc.gg/turing)`;
  }

  return json.reply[0];
}

async function chat(message) {
  if (!abled) {
    var check = await checkId();
    if (!check) {
      return `Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    await delay(1000);
  }
  try {
    var response = await client.chat(message);

    return response;
  } catch (err) {
    console.log(err);
    return `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`;
  }
}

export {
  initChat,
  createConversation,
  chat,
  getStatus,
  conversationSendMessage,
};
