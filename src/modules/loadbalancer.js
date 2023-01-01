import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { ChatGPTAPIBrowser } from "chatgpt";
import { executablePath } from "puppeteer";
async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) return error;

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
    console.log("loaded");
  } catch (err) {
    console.log(`error with ${email}:\n${err}`);
  }
}

async function useToken() {
  var tokens = await getTokens();
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
  console.log(i);
  var token = t[i];
  if (token) {
    var client = clients.find((x) => x.id == token.id);
    console.log(client);
    return client;
  } else {
    return {
      error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  }
}
function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
async function addMessage(token) {
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("sessionToken", token);
  var tokenObj = accounts[0];
  if (tokenObj) {
    if (tokenObj.totalMessages >= 30) {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
          lastUse: Date.now(),
        })
        .eq("sessionToken", token);
      var index = clients.findIndex((x) => x.token == tokenObj.sessionToken);
      clients.splice(index, 1); // 2nd parameter means remove one item only
    } else {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
        })
        .eq("sessionToken", token);
    }
  }
}
async function removeMessage(token) {
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("sessionToken", token);
  var tokenObj = accounts[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("accounts")
      .update({ messages: tokenObj.messages - 1 })
      .eq("sessionToken", token);
  }
}

async function initTokens() {
  var tokens = await getTokens();
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    await initChat(token.email, token.password, token.id);
  }
}

async function reloadTokens() {
  clients = [];
  var tokens = await getTokens();
  var t = tokens.filter((x) => x.lastUse != null);
  for (var i = 0; i < t.length; i++) {
    var token = t[i];
    var now = Date.now();
    var diff = token.lastUse - now;
    if (diff >= ms("20min")) {
      const { data, error } = await supabase
        .from("accounts")
        .update({ lastUse: null, messages: 0, totalMessages: 0 })
        .eq("id", t.id);
      await initChat(sessionToken);
    }
  }
}

export { initTokens, addMessage, removeMessage, useToken, reloadTokens };
