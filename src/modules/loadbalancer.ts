import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
var clients = [];
import { Configuration, OpenAIApi } from "openai";
import ChatGPT, { LogLevel } from "chatgpt-io";

async function getTokens() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    return null;
  }

  return accounts;
}
async function initChat(token, id, key) {
  try {
    let bot = new ChatGPT(token, {
      reconnection: false,
      forceNew: false,
      logLevel: LogLevel.Info,
      bypassNode: "https://gpt.pawan.krd",
    });
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
  return `${clients.length}`;
}

export async function getAbleTokens() {
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
  return tokens.length;
}

export async function reloadConversations() {
  let { data: conversations, error } = await supabase
    .from("conversations")
    .select("*");

  for (var i = 0; i < conversations.length; i++) {
    var conversation = conversations[i];
    var diff = Date.now() - conversation.lastMessage;
    if (diff >= ms("5m")) {
      await removeMessage(conversation.account);
      const { data, error } = await supabase
        .from("conversations")
        .delete()
        .eq("id", conversation.id);
    }
  }
}

export async function getToken(id) {
  var client = clients.find((x) => x.id == id);
  return client;
}

async function useToken(retry, shard) {
  var tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
    return {
      error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
    };
  } else {
    var t = tokens
      .filter((x) => x.lastUse == null && x.messages <= 1 && x.shard == shard)
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

    if (clients.length <= 2) {
      return {
        error:
          "Wait 1-2 mins the bot is starting or we are reaching our capacity limits.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)",
      };
    }
    if (t.length <= 0) {
      return {
        error: `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
      };
    }
    var token = t[i];

    if (token) {
      var client = clients.find((x) => x.id == token.id);
      var nr = retry + 1;
      if (!client && retry < 2) {
        return useToken(nr, shard);
      }
      if (client) {
        await addMessage(token.id);
      }
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
    if (tokenObj.totalMessages >= 50) {
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: 1,
          totalMessages: tokenObj.totalMessages + 1,
          lastUse: Date.now(),
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
    }
  }
}

export async function rateLimitAcc(id) {
  const { data, error } = await supabase
    .from("accounts")
    .update({
      messages: 0,
      lastUse: Date.now(),
    })
    .eq("id", id);
  var client = clients.find((x) => x.id == id);
  await client.client.disconnect();
  var index = clients.findIndex((x) => x.id == id);
  clients.splice(index, 1); // 2nd parameter means remove one item only
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

async function initTokens(shard) {
  console.log((shard - 1) * 6, shard * 6, shard);
  let { data: tokens, error } = await supabase
    .from("accounts")
    .select("*")
    .range((shard - 1) * 6, shard * 6);
  var max = tokens.length;
  for (var i = 0; i < max; i++) {
    var token = tokens[i];
    await initChat(token.session, token.id, token.key);
    const { data, error } = await supabase
      .from("accounts")
      .update({ shard: shard })
      .eq("id", token.id);
    await delay(30000);
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
