import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { Configuration, OpenAIApi } from "openai";
// @ts-ignore
import chatGPT from "chatgpt-io";

async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    return null;
  }

  return accounts;
}

async function useToken(model): Promise<null | {
  id: string;
  type: string;
  client: any;
  key: string;
}> {
  var tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
    return;
  }
  var t = tokens.filter((x) => x.messages <= 1 && x.abled != false);
  if (model == "chatgpt") {
    t = tokens.filter((x) => x.messages <= 2 && x.key != null);
  }
  var i = getRndInteger(0, t.length - 1);
  if (t.length <= 0) return;
  var token = t[i];
  if (token) {
    await addMessage(token.id);
    const configuration = new Configuration({
      apiKey: token.key,
    });
    var c: any = new OpenAIApi(configuration);
    /* if (model == "chatgpt") {
      c = new chatGPT(token.key);
      await c.waitForReady();
    }*/
    var client = {
      id: token.id,
      client: c,
      type: "official",
      key: token.key,
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
