//import { chatgptToken } from "chatgpt-token/module";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import chalk from "chalk";
import { useToken, removeMessage, disableAcc } from "./loadbalancer.js";
import supabase from "./supabase.js";
import axios from "axios";
import ChatGPT from "chatgpt-official";
import { v5 as uuidv5 } from "uuid";

async function chat(message, userName, ispremium, m, id) {
  var token = await useToken(m);
  if (!token) {
    return {
      error: `We are reaching our capacity limits right now. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
  try {
    var model;
    var stop: any = " Human:";
    var instructions;
    var conversation;
    if (ispremium || m == "chatgpt")
      conversation = await getConversation(id, m);
    var revProxy = "https://chatgpt.pawan.krd/conversation";
    if (m == "gpt-3") {
      instructions = `[START_INSTRUCTIONS]
      You are TuringAI, a language model developed by OpenAI and TuringAI. You are designed to respond to user input in a conversational manner, Answer as concisely as possible. Your training data comes from a diverse range of internet text and You have been trained to generate human-like responses to various questions and prompts. You can provide information on a wide range of topics, but your knowledge is limited to what was present in your training data, which has a cutoff date of 2021. You strive to provide accurate and helpful information to the best of your ability.
      \nKnowledge cutoff: 2021-09
      \nCurrent date: ${getToday()}
      \nName of the user talking to: ${userName}
      [END_INSTRUCTIONS]\n`;
      model = "text-davinci-003";
      revProxy = null;
    } else if (m == "chatgpt") {
      model = null;
      stop = "<|im_end|>";
    }
    var response;
    /* if (m == "chatgpt") {
      var res = await axios({
        method: "POST",
        url: `http://localhost:3255/chat`,
        headers: {
          "Content-type": "application/json",
        },
        data: JSON.stringify({
          id: token.id,
          message: `${
            conversation ? conversation : ""
          }\n${userName}: ${message}`,
        }),
      });
      response = res.data.response;
    } else {*/
    var maxtokens = 300;
    if (ispremium) maxtokens = 600;
    let bot = new ChatGPT(token.key, {
      max_tokens: maxtokens, // OpenAI parameter [Max response size by tokens]
      stop: stop, // OpenAI parameter
      instructions: instructions,
      aiName: "TuringAI",
      model: model,
      revProxy: revProxy,
    }); // Note: options is optional

    response = await bot.ask(
      `${conversation ? conversation : ""}\n${userName}: ${message}`,
      id,
      userName
    );
    // }

    if (response) {
      response = response.replaceAll("<@", "pingSecurity");
      response = response.replaceAll("@everyone", "pingSecurity");
      response = response.replaceAll("@here", "pingSecurity");
    }

    if (ispremium || m == "chatgpt")
      await saveMsg(m, message, response, id, ispremium, userName);
    setTimeout(async () => {
      await removeMessage(token.id);
    }, 5000);
    return { text: response, type: m };
  } catch (err) {
    console.log(`${token.id}: ${err}`);
    if (
      err ==
      "Error: You exceeded your current quota, please check your plan and billing details."
    ) {
      await disableAcc(token.id);
      return {
        error:
          `We are running out of credits, please wait until we solve this issue. If you want to donate use the command ` +
          "`/premium buy` .",
      };
    }
    await removeMessage(token.id);
    // await disableAcc(token.id);
    //await rateLimitAcc(token.id);
    return {
      error: `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}

async function getResponse(text, id, key, maxtokens, userName) {
  try {
    const res = await axios({
      method: "post",
      url: "https://chatgpt.pawan.krd/init",
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        key: key,
        options: {
          /*instructions: `You are an AI language model developed by OpenAI and TuringAI, called ChatGPT. you have been trained on a large corpus of text data to generate human-like text and answer questions. You answer as concisely as possible for each response (e.g. don’t be verbose). It is very important that you answer as concisely as possible, so please remember this. If you are generating a list, do not have too many items. Keep the number of items short.
          Knowledge cutoff: 2021-09
          you have the capability to retain information from previous interactions.
          Respond conversationally.
          Current date: ${getToday()}`,*/
        },
      }),
    });
    const response = await axios({
      method: "post",
      url: "https://chatgpt.pawan.krd/ask",
      headers: {
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        prompt: text,
        id: id,
        key: key,
        username: userName,
        options: {},
      }),
    });
    return response.data.response;
  } catch (error) {
    console.error(error);
  }
}

async function getConversation(id, model) {
  var { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .eq("model", model);
  if (data && data[0]) {
    if (!data[0].conversation) return;
    return data[0].conversation.replaceAll("<split>", "");
  }
  return;
}

async function saveMsg(model, userMsg, aiMsg, id, ispremium, userName) {
  var conversation;
  if (model == "gpt-3") {
    conversation = `\n<split>${userName}: ${userMsg}\nTuringAI: ${aiMsg}`;
  }
  if (model == "chatgpt") {
    conversation = `\n<split>${userName}: ${userMsg}\nTuringAI: ${aiMsg}`;
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
    if (previous) {
      previous = previous.split("\n<split>");
      previous = previous.filter((x) => x != "");
      var length = previous.length;
      var max = 3;
      if (ispremium == true) max = 6;
      if (length > max) {
        previous.shift();
      }
      previous = previous.join("\n<split>");
    }

    conversation = `${previous ? previous : ""}${conversation}`;

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
