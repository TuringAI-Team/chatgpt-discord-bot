import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { ChatGPTAPIBrowser } from "chatgpt";
import { executablePath } from "puppeteer";
async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    console.log(error);
    return null;
  }

  return accounts;
}
async function initChat(email, password, id) {
  try {
    var Capi = new ChatGPTAPIBrowser({
      email: email,
      password: password,
      executablePath: executablePath(),
      nopechaKey: process.env.NOPECHA_KEY,
    });
    await Capi.initSession();
    clients.push({ client: Capi, id });
    console.log(`loaded ${id}`);
  } catch (err) {
    console.log(`error with ${email}:\n${err}`);
  }
}

async function useToken(retry = 0) {
  var tokens = await getTokens();
  if (!tokens) {
    return {
      error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  } else {
    var t = tokens
      .filter((x) => x.lastUse == null && x.messages <= 1)
      .sort((a, b) => {
        if (a.messages > b.messages) {
          return 1;
        }
        if (a.messages < b.messages) {
          return -1;
        }
        if (a.messages == b.messages) {
          return 0;
        }
      });
    var i = getRndInteger(0, t.length - 1);
    var token = t[i];
    if (token) {
      var client = clients.find((x) => x.id == token.id);
      console.log(token.id, retry, retry++);
      if (!client && retry < 2) {
        return useToken(retry++);
      }
      console.log("client found");
      return client;
    } else {
      return {
        error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
      };
    }
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
        messages: tokenObj.messages + 1,
        totalMessages: tokenObj.totalMessages + 1,
      })
      .eq("id", id);

    if (tokenObj.totalMessages >= 25) {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
          lastUse: Date.now(),
        })
        .eq("id", id);
      console.log(error);
      var index = clients.findIndex((x) => x.id == tokenObj.id);
      clients.splice(index, 1); // 2nd parameter means remove one item only
    } else {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
        })
        .eq("id", id);
    }
  }
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
      .update({ messages: tokenObj.messages - 1 })
      .eq("id", id);
  }
}

async function initTokens() {
  var tokens = await getTokens();
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    await delay(5000);
    await initChat(token.email, token.password, token.id);
  }
}

async function reloadTokens() {
  var tokens = await getTokens();
  var t = tokens.filter((x) => x.lastUse != null);
  for (var i = 0; i < t.length; i++) {
    var token = t[i];
    var now = Date.now();
    var diff = now - token.lastUse;
    console.log(diff);
    if (diff >= ms("20min")) {
      const { data, error } = await supabase
        .from("accounts")
        .update({ lastUse: null, messages: 0, totalMessages: 0 })
        .eq("id", token.id);
      await initChat(token.email, token.password, token.id);
    }
  }
}

export { initTokens, addMessage, removeMessage, useToken, reloadTokens };
