import ms from "ms";
import supabase from "./supabase.js";
import delay from "delay";
let clients = [];
import { Configuration, OpenAIApi } from "openai";
// @ts-ignore
import chatGPT from "chatgpt-io";
import { ChatGPTAuthTokenService } from "chat-gpt-authenticator";

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
  key: string;
  session: string;
}> {
  let tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
    return;
  }
  let t = tokens.filter((x) => x.messages <= 2 && x.abled != false);
  if (model == "chatgpt" || model == "dan") {
    t = tokens.filter(
      (x) =>
        x.messages <= 1 &&
        x.access != null &&
        x.access.includes("ey") &&
        x.limited == null
    );
  }
  let i = getRndInteger(0, t.length - 1);
  if (t.length <= 0) return;
  let token = t[i];
  if (token) {
    await addMessage(token.id);
    let client = {
      id: token.id,
      type: "official",
      key: token.key,
      session: token.access,
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
  let tokenObj = accounts[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        messages: tokenObj.messages + 1,
        totalMessages: tokenObj.totalMessages + 1,
      })
      .eq("id", id);
  }
}

export async function disableAcc(id, bool) {
  let update = {};
  if (bool) {
    update = {
      messages: 0,
      abled: false,
    };
  } else {
    update = {
      messages: 0,
      limited: Date.now(),
    };
  }
  const { data, error } = await supabase
    .from("accounts")
    .update(update)
    .eq("id", id);
}

export async function checkLimited() {
  let tokens = await getTokens();
  if (!tokens || tokens.length <= 0) {
    return;
  }
  let t = tokens.filter(
    (x) => x.access != null && x.access.includes("ey") && x.limited !== null
  );
  console.log(`checking ${t.length} tokens`);
  let enabled = 0;
  for (let i = 0; i < t.length; i++) {
    let diff = Date.now() - t[i].limited;
    if (diff >= ms("30m")) {
      enabled++;
      const { data, error } = await supabase
        .from("accounts")
        .update({
          messages: 0,
          limited: null,
        })
        .eq("id", t[i].id);
    }
  }
  console.log(`enabled ${enabled} tokens`);
}

async function removeMessage(id) {
  let { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id);
  let tokenObj = accounts[0];
  if (tokenObj) {
    const { data, error } = await supabase
      .from("accounts")
      .update({ messages: tokenObj.messages - 1 })
      .eq("id", id);
  }
}

export async function resetto0() {
  let { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) {
    console.log(error);
    return;
  }
  for (let i = 0; i < accounts.length; i++) {
    let tokenObj = accounts[i];
    const { data, error } = await supabase
      .from("accounts")
      .update({ messages: 0 })
      .eq("id", tokenObj.id);
  }
}

export { addMessage, removeMessage, useToken };
