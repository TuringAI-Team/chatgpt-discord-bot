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
    return `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`;
  }
  if (token.error) {
    return token.error;
  }
  await addMessage(token.token);
  try {
    var response = await token.client.sendMessage(message);
    await removeMessage(token.token);
    return response;
  } catch (err) {
    console.log(err);
    await removeMessage(token.token);
    return `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`;
  }
}

export { chat, getStatus };
