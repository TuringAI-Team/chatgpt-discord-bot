import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { Configuration, OpenAIApi } from "openai";
import chatGPT from "chatgpt-io";

async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    console.log(error);
    return null;
  }

  return accounts;
}
async function initChat(token, id, key) {
  try {
    console.log(id);
    let bot = new chatGPT(token);
    await bot.waitForReady();
    clients.push({ client: bot, id, type: "unofficial" });
    console.log(`loaded ${id} with unofficial`);
  } catch (err) {
    if (key) {
      const configuration = new Configuration({
        apiKey: key,
      });
      const openai = new OpenAIApi(configuration);
      clients.push({ client: openai, id, type: "official" });
      console.log(`loaded ${id} with official`);
    }

    console.log(`error with ${id}:\n${err}`);
  }
}

export async function getActiveTokens() {
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
  return `${t.length}/${clients.length}`;
}

async function useToken(retry) {
  var tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
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
    console.log(clients.length, t.length);
    var i = getRndInteger(0, t.length - 1);

    if (clients.length <= 2) {
      return {
        error:
          "Wait 1-2 mins the bot is starting or we are reaching our capacity limits.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)",
      };
    }
    if (t.length <= 0) {
      console.log(t.length);
      return {
        error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
      };
    }
    var token = t[i];

    if (token) {
      var client = clients.find((x) => x.id == token.id);
      var nr = retry + 1;
      if (!client && retry < 2) {
        return useToken(nr);
      }
      if (client) {
        await addMessage(token.id);
      }
      console.log(token.id);
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

    if (tokenObj.totalMessages >= 30) {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: tokenObj.messages + 1,
          totalMessages: tokenObj.totalMessages + 1,
          lastUse: Date.now(),
        })
        .eq("id", id);
      var index = clients.findIndex((x) => x.id == id);
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
      .update({ messages: 0 })
      .eq("id", id);
  }
}

async function initTokens() {
  var tokens = await getTokens();
  var max = tokens.length;
  if (max > 15) max = 15;
  for (var i = 0; i < max; i++) {
    var token = tokens[i];
    await delay(30000);
    await initChat(token.session, token.id, token.key);
  }
}

async function reloadTokens() {
  var tokens = await getTokens();
  var t = tokens.filter((x) => x.lastUse != null);
  for (var i = 0; i < t.length; i++) {
    var token = t[i];
    var now = Date.now();
    var diff = now - token.lastUse;
    if (diff >= ms("20min")) {
      const { data, error } = await supabase
        .from("accounts")
        .update({ lastUse: null, messages: 0, totalMessages: 0 })
        .eq("id", token.id);
      await initChat(token.session, token.id, token.key);
    }
  }
}

export { initTokens, addMessage, removeMessage, useToken, reloadTokens };
