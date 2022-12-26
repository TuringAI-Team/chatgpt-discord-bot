import ms from "ms";
import supabase from "./supabase.js";
import Client from "justbrowse.io";
import delay from "delay";
var clients = [];

async function getTokens() {
  let { data: sessiontokens, error } = await supabase
    .from("sessiontokens")
    .select("*");
  if (error) return error;

  return sessiontokens;
}
async function initChat(token) {
  try {
    var client = new Client(token);
    await client.init();
    clients.push({ client, token });
  } catch (err) {
    console.error(err);
  }
  console.log("loaded");
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
    var client = clients.find((x) => x.token == token.sessionToken);
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
  let { data: sessiontokens, error } = await supabase
    .from("sessiontokens")
    .select("*")
    .eq("sessionToken", token);
  var tokenObj = sessiontokens[0];
  if (tokenObj) {
    if (tokenObj.totalMessages >= 30) {
      const { data, error } = await supabase
        .from("sessiontokens")
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
        .from("sessiontokens")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
        })
        .eq("sessionToken", token);
    }
  }
}
async function removeMessage(token) {
  let { data: sessiontokens, error } = await supabase
    .from("sessiontokens")
    .select("*")
    .eq("sessionToken", token);
  var tokenObj = sessiontokens[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("sessiontokens")
      .update({ messages: tokenObj.messages - 1 })
      .eq("sessionToken", token);
  }
}

async function initTokens() {
  var tokens = await getTokens();
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    await initChat(token.sessionToken);
    await delay(90000);
  }
}
async function addToken(sessionToken) {
  const { data, error } = await supabase.from("sessiontokens").insert([
    {
      sessionToken: sessionToken,
      messages: 0,
      totalMessages: 0,
      lastUse: null,
    },
  ]);
  if (error) {
    return error.message;
  }
  await initChat(sessionToken);
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
        .from("sessiontokens")
        .update({ lastUse: null, messages: 0, totalMessages: 0 })
        .eq("id", t.id);
      await initChat(sessionToken);
    }
  }
}

export {
  addToken,
  initTokens,
  addMessage,
  removeMessage,
  useToken,
  reloadTokens,
};
