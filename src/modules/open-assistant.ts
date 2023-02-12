import axios from "axios";
import supabase from "./supabase.js";
var csrfToken = process.env.OPEN_ASSISTANT_CSRF;
var sessionToken = process.env.OPEN_ASSISTANT_TOKEN;

export async function getUserLang(userId: string) {
  var { data: user } = await supabase
    .from("open_assistant_users")
    .select("*")
    .eq("id", userId);
  if (user && user[0]) {
    return user[0].lang;
  } else {
    return null;
  }
}

export async function setUserLang(userId: string, lang: string) {
  var { data: user } = await supabase
    .from("open_assistant_users")
    .select("*")
    .eq("id", userId);
  if (user && user[0]) {
    await supabase
      .from("open_assistant_users")
      .update({ lang: lang })
      .eq("id", userId);
    return true;
  } else {
    await supabase.from("open_assistant_users").insert([
      {
        id: userId,
        lang: lang,
      },
    ]);
    return true;
  }
}

export async function getTask(lang: string) {
  var tasks = ["assistant_reply", "user_reply", "initial_prompt"];
  var res = await axios({
    method: "GET",
    url: `https://open-assistant.io/api/new_task/${tasks[getRndInteger(0, 2)]}`,
    headers: {
      cookie: `__Host-next-auth.csrf-token=${csrfToken}; __Secure-next-auth.callback-url=https%3A%2F%2Fopen-assistant.io%2Fdashboard; NEXT_LOCALE=${lang}; __Secure-next-auth.session-token=${sessionToken}`,
    },
  });
  console.log(res.data);
  return res.data.task;
}
export async function rejectTask(id: string, lang: string = "en") {
  var res = await axios({
    method: "POST",
    url: `https://open-assistant.io/api/reject_task`,
    headers: {
      cookie: `__Host-next-auth.csrf-token=${csrfToken}; __Secure-next-auth.callback-url=https%3A%2F%2Fopen-assistant.io%2Fdashboard; NEXT_LOCALE=${lang}; __Secure-next-auth.session-token=${sessionToken}`,
      "content-type": "application/json",
      origin: "https://open-assistant.io",
      referer: "https://open-assistant.io/label/label_assistant_reply",
    },
    data: JSON.stringify({
      id: id,
      reason: "",
    }),
  });
}

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export async function initPrompt(taskId: string, lang: string, prompt: string) {
  var res = await axios({
    method: "POST",
    url: `https://open-assistant.io/api/update_task`,
    headers: {
      cookie: `__Host-next-auth.csrf-token=${csrfToken}; __Secure-next-auth.callback-url=https%3A%2F%2Fopen-assistant.io%2Fdashboard; NEXT_LOCALE=${lang}; __Secure-next-auth.session-token=${sessionToken}`,
      "content-type": "application/json",
      origin: "https://open-assistant.io",
      referer: "https://open-assistant.io/create/initial_prompt",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    },
    data: JSON.stringify({
      id: taskId,
      content: {
        text: prompt,
      },
      update_type: "text_reply_to_message",
    }),
  });
}
export async function submitTask(taskId: string, userId: string) {}
