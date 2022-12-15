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
      `${process.env.API_URL}/connect?sessionToken=${process.env.SESSION_TOKEN}`
    );
    var json = await response.json();
    id = json.id;
  } catch (err) {
    id = "down";
  }
  console.log(id);
}

async function checkId() {
  var response = await fetch(`${process.env.API_URL}/status?id=${id}`);
  var json = await response.json();
  console.log(json);
  if (json.status == "ready") {
    abled = true;
  }
  return abled;
}

async function createConversation() {
  if (!abled) {
    var check = await checkId();
    if (!check) {
      return `ChatGPT is down now.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
  }
  var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: "Hello.",
    }),
  });
  var json = await response.json();
  var conversationId = json.conversationId;
  return {
    id: conversationId,
    sendMessage: async (message) => {
      console.log(message);
      var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: message,
          conversationId: conversationId,
        }),
      });
      var json = await response.json();
      console.log(json);
      return json.reply[0];
    },
    stopConversation: async () => {
      var response = await fetch(
        `${process.env.API_URL}/chat/${id}/reset?conversationId=${conversationId}`
      );
      var json = await response.json();
      return true;
    },
  };
}
async function chat(message) {
  if (!abled) {
    var check = await checkId();
    if (!check) {
      return `ChatGPT is down now.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
    }
  }
  var response = await fetch(`${process.env.API_URL}/chat/${id}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      message: message,
    }),
  });
  var json = await response.json();
  console.log(json);
  return json.reply[0];
}

export { initChat, createConversation, chat };
