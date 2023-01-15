//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import chalk from "chalk";
import {
  useToken,
  addMessage,
  getToken,
  removeMessage,
  rateLimitAcc,
} from "./loadbalancer.js";
import { Configuration, OpenAIApi } from "openai";

var abled = false;

async function getStatus() {
  return abled;
}

async function chat(message) {
  var token = await useToken(0);

  if (!token) {
    return {
      error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
  if (token.error) {
    return { error: token.error };
  }
  try {
    var response;
    var type;
    if (token.type == "unofficial") {
      type = "gpt-3.5";
      response = await token.client.ask(message);
    } else {
      type = "gpt-3";
      response = await token.client.createCompletion({
        model: "text-davinci-003",
        prompt: `The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: Hello, who are you?\nAI: I am an AI created by OpenAI. How can I help you today?\nHuman: ${message}\nAI:`,
        temperature: 0.9,
        max_tokens: 150,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
        stop: [" Human:", " AI:"],
      });
      response = response.data.choices[0].text;
    }
    await removeMessage(token.id);
    return { text: response, type: type };
  } catch (err) {
    console.log(err);

    await removeMessage(token.id);
    if (err == "Too many requests in 1 hour. Try again later.") {
      await rateLimitAcc(token.id);
    }
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}
export async function conversation(message, conversationId, accId) {
  var token = await getToken(accId);

  if (!token) {
    return {
      error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
  if (token.error) {
    return { error: token.error };
  }
  try {
    var response;
    var type;
    if (token.type == "unofficial") {
      type = "gpt-3.5";
      response = await token.client.ask(message, conversationId);
    } else {
      type = "gpt-3";
      response = await token.client.createCompletion({
        model: "text-davinci-003",
        prompt: `The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: Hello, who are you?\nAI: I am an AI created by OpenAI. How can I help you today?\nHuman: ${message}\nAI:`,
        temperature: 0.9,
        max_tokens: 150,
        top_p: 1,
        frequency_penalty: 0.0,
        presence_penalty: 0.6,
        stop: [" Human:", " AI:"],
      });
      response = response.data.choices[0].text;
    }
    return { text: response, type: type };
  } catch (err) {
    console.log(err);

    if (err == "Too many requests in 1 hour. Try again later.") {
      await rateLimitAcc(token.id);
    }
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}

export { chat, getStatus };
