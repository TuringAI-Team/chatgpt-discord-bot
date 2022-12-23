//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import fetch from "node-fetch";
dotenv.config();
import chalk from "chalk";

var id = "loading";
var abled = false;

async function initChat() {
  try {
    var response = await fetch(
      `${process.env.API_URL}/connect?sessionToken=${process.env.SESSION_TOKEN}`,
      {
        headers: {
          authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      }
    );
    if (response.status != 200) {
      if (response.status == 429) {
        return `The bot have exceed the rate limit please wait some seconds. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
      }
      abled = false;
      return;
    }
    var json = await response.json();
    console.log(json);
    id = json.sessionId;
    abled = false;
  } catch (err) {
    console.error(err);
    id = "loading";
  }
  console.log(id);
}
async function getStatus() {
  return abled;
}
async function checkId() {
  try {
    var response = await fetch(
      `${process.env.API_URL}/status?sessionId=${id}`,
      {
        headers: {
          authorization: `Bearer ${process.env.API_TOKEN}`,
        },
      }
    );
    var json = await response.json();
    if (json.status == "ready") {
      abled = true;
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
    if (response.status == 400) {
      await initChat();
      return `Something wrong happened, please wait we are reloading the bot [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    if (response.status == 429) {
      return `The bot have exceed the rate limit please wait some seconds. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    console.log(response);
    return `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`;
  }
  var json = await response.json();
  var conversationId = json.conversationId;
  return { id: conversationId };
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
    if (response.status == 400) {
      await initChat();
      return `Something wrong happened, please wait we are reloading the bot [dsc.gg/turing](https://dsc.gg/turing)`;
    }
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
  }
  var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.API_TOKEN}`,
    },
    body: JSON.stringify({
      message: message,
    }),
  });
  if (response.status != 200) {
    if (response.status == 400) {
      await initChat();
      return `Something wrong happened, please wait we are reloading the bot [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    if (response.status == 429) {
      return `The bot have exceed the rate limit please wait some seconds. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
    console.log(response);
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

export {
  initChat,
  createConversation,
  chat,
  getStatus,
  conversationSendMessage,
};
