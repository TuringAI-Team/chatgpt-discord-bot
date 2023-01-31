//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import chalk from "chalk";
import {
  useToken,
  addMessage,
  removeMessage,
  rateLimitAcc,
  disableAcc,
} from "./loadbalancer.js";
import { Configuration, OpenAIApi } from "openai";

var abled = false;

async function getStatus() {
  return abled;
}

async function chat(message, userName, ispremium, m) {
  var token = await useToken();
  if (!token) {
    return {
      error: `We are reaching our capacity limits right now. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
  try {
    var response;
    var model;
    var prompt;
    var stop = [" Human:", " AI:"];
    var temperature = 0.9;
    if (m == "gpt-3") {
      model = "text-davinci-003";
      prompt = `The following is a conversation with an AI assistant called Turing, the user is called ${userName}. The assistant is helpful, creative, clever, and very friendly.\n\nHuman: Hello, who are you?\nAI: I am an AI created by Turing AI. How can I help you today?\nHuman: ${message}\nAI:`;
    }
    if (m == "chatgpt") {
      temperature = 0.5;
      stop = [" User:", " ChatGPT:"];
      model = "text-chat-davinci-002-20230126";
      prompt = `You are ChatGPT, a large language model trained by OpenAI. You answer as consisely as possible for each response (e.g. Don't be verbose). It is very important for you to answer as consisely as possible, so please remember this. If you are generating a list, do not have too many items. \n User: ${message} \n\n ChatGPT:`;
    }
    var maxtokens = 300;
    if (ispremium) maxtokens = 500;
    response = await token.client.createCompletion({
      model: model,
      prompt: prompt,
      temperature: temperature,
      max_tokens: maxtokens,
      top_p: 1,
      frequency_penalty: 0.0,
      presence_penalty: 0.6,
      stop: stop,
    });
    response = response.data.choices[0].text;
    if (m == "chatgpt") {
      response = response
        .split("<|im_end|>")[0]
        .replaceAll("<@", "pingSecurity");
    }
    await removeMessage(token.id);
    return { text: response, type: m };
  } catch (err) {
    await removeMessage(token.id);
    await disableAcc(token.id);
    //await rateLimitAcc(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}
/*
export async function conversationFn(message, conversationId, accId) {
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
      type = "chatgpt";
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
    console.log(err, token.id);
    await rateLimitAcc(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}*/

export { chat, getStatus };
