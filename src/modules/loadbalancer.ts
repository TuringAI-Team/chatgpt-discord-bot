import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { Configuration, OpenAIApi } from "openai";
// @ts-ignore
import ChatGPTClient from "@waylaidwanderer/chatgpt-api";
import Keyv from "keyv";

async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    return null;
  }

  return accounts;
}
/*
async function initChat(token, id, key) {
  try {
    let bot = new ChatGPT(token, {
      name: id,
      reconnection: false,
      forceNew: false,
      logLevel: LogLevel.Info,
      bypassNode: "https://gpt.pawan.krd",
      proAccount: false,
    });
    await bot.waitForReady();
    const configuration = new Configuration({
      apiKey: key,
    });
    if (key) {
      console.log(`loaded ${id} with official`);
      const openai = new OpenAIApi(configuration);
      clients.push({ client: bot, id, type: "unofficial", official: openai });
    } else {
      clients.push({ client: bot, id, type: "unofficial" });
    }
    console.log(`loaded ${id} with unofficial`);
  } catch (err) {
    console.log(`error with ${id}:\n${err}`);
  }
}*/

async function useToken(options): Promise<null | {
  id: string;
  type: string;
  client: any;
}> {
  var tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
    return;
  }
  var t = tokens.filter((x) => x.messages <= 1 && x.abled != false);
  var i = getRndInteger(0, t.length - 1);
  if (t.length <= 0) return;
  var token = t[i];
  if (token) {
    await addMessage(token.id);
    const configuration = new Configuration({
      apiKey: token.key,
    });
    const openai = new OpenAIApi(configuration);
    const keyv = new Keyv(process.env.SUPABSE_DB, {
      table: "conversations",
    });
    const chatGptClient = new ChatGPTClient(
      token.key,
      {
        modelOptions: options,
        // (Optional) Set a custom prompt prefix. As per my testing it should work with two newlines
        // promptPrefix: 'You are not ChatGPT...\n\n',
        // (Optional) Set to true to enable `console.debug()` logging
        debug: false,
      },
      keyv
    );

    var client = {
      id: token.id,
      client: chatGptClient,
      type: "official",
    };
    return client;
  } else {
    return;
  }
}
function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function addMessage(id) {
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id);
  var tokenObj = accounts[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        messages: 1,
        totalMessages: tokenObj.totalMessages + 1,
      })
      .eq("id", id);

    /*
    if (tokenObj.totalMessages >= 50) {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: 1,
          totalMessages: tokenObj.totalMessages + 1,
        })
        .eq("id", id);
      var client = clients.find((x) => x.id == id);
      await client.client.disconnect();
      var index = clients.findIndex((x) => x.id == id);
      clients.splice(index, 1); // 2nd parameter means remove one item only
    } else {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: 1,
          totalMessages: tokenObj.totalMessages + 1,
        })
        .eq("id", id);
    }*/
  }
}

export async function disableAcc(id) {
  const { data, error } = await supabase
    .from("accounts")
    .update({
      messages: 0,
      abled: false,
    })
    .eq("id", id);
  /*
  var client = clients.find((x) => x.id == id);
  await client.client.disconnect();
  var index = clients.findIndex((x) => x.id == id);
  clients.splice(index, 1); // 2nd parameter means remove one item only
  */
}

async function removeMessage(id) {
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id);
  var tokenObj = accounts[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("accounts")
      .update({ messages: 0 })
      .eq("id", id);
  }
}

export async function resetto0() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    console.log(error);
    return;
  }
  for (var i = 0; i < accounts.length; i++) {
    var tokenObj = accounts[i];
    const { data, error } = await supabase
      .from("accounts")
      .update({ messages: 0 })
      .eq("id", tokenObj.id);
  }
}

export { addMessage, removeMessage, useToken };
