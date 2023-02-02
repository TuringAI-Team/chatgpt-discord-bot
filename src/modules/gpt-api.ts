//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import chalk from "chalk";
import { useToken, removeMessage, disableAcc } from "./loadbalancer.js";
import { Configuration, OpenAIApi } from "openai";
import supabase from "./supabase.js";

async function chat(message, userName, ispremium, m, id) {
  var token = await useToken({
    stop: stop,
    model: model,
  });
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
    var conversation = await getConversation(id, m);

    if (m == "gpt-3") {
      var basePrompt = `The following is a conversation with an AI assistant called Turing, the user is called ${userName}. The assistant is helpful, creative, clever, and very friendly.\n`;
      model = "text-davinci-003";
      prompt = `Human: ${message}\n AI:`;
    }
    if (m == "chatgpt") {
      stop = ["<|im_end|>", "<|im_sep|>"];
      model = "text-chat-davinci-002-20230126";

      prompt = `${basePrompt}${conversation}User: ${message}\n ChatGPT:`;
    }
    var maxtokens = 300;
    if (ispremium) maxtokens = 600;

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
        .replaceAll("<@", "pingSecurity")
        .replace(/<|im_end|>/g, "")
        .trim();
    }
    await removeMessage(token.id);
    await saveMsg(m, message, response, id, ispremium);
    return { text: response, type: m };
  } catch (err) {
    console.log(err);
    await removeMessage(token.id);
    await disableAcc(token.id);
    //await rateLimitAcc(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}
async function getConversation(id, model) {
  var { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("model", model);
  if (data && data[0]) {
    return data[0].conversation.replaceAll("<split>", "");
  }
  return;
}

async function saveMsg(model, userMsg, aiMsg, id, ispremium) {
  var conversation;
  if (model == "gpt-3") {
    conversation = `\n<split>Human: ${userMsg}\nAI: ${aiMsg}`;
  }
  if (model == "chatgpt") {
    conversation = `\n<split>User: ${userMsg}\nChatGPT: ${aiMsg}`;
  }
  var { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("model", model);
  if (!data || !data[0]) {
    await supabase.from("conversations").insert({
      id: id,
      model: model,
      conversation: conversation,
      lastMessage: Date.now(),
    });
  } else {
    var previous = data[0].conversation;

    previous = previous.split("\n<split>");
    previous = previous.filter((x) => x != "");
    var length = previous.length;
    var max = 3;
    if (ispremium == true) max = 6;
    if (length > max) {
      previous.shift();
    }
    previous = previous.join("\n<split>");
    conversation = `${previous}${conversation}`;

    await supabase
      .from("conversations")
      .update({
        conversation: conversation,
        lastMessage: Date.now(),
      })
      .eq("id", id)
      .eq("model", model);
  }
}
function getToday() {
  let today = new Date();
  let dd = String(today.getDate()).padStart(2, "0");
  let mm = String(today.getMonth() + 1).padStart(2, "0");
  let yyyy = today.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export { chat };
