import api from "api";
import supabase from "./supabase.js";

const sdk = api("@writesonic/v2.2#4enbxztlcbti48j");

export default async function chatSonic(msg: string) {
  let { data: accounts, error } = await supabase
    .from("chatsonic")
    .select("*")
    .neq("key", null);

  if (!accounts) {
    return {
      error: `We are running out of credits, please wait until we solve the issue.`,
    };
  }
  var firstOne = await accounts[0];
  console.log(firstOne.id);
  if (!firstOne) {
    return {
      error: `We are running out of credits, please wait until we solve the issue.`,
    };
  }

  sdk.auth(firstOne.key);
  try {
    var { data } = await sdk.chatsonic_V2BusinessContentChatsonic_post(
      {
        enable_google_results: "true",
        enable_memory: false,
        input_text: msg,
      },
      { engine: "premium" }
    );
    return { text: data.message, type: "chatsonic" };
  } catch (err) {
    const { data, error } = await supabase
      .from("accounts")
      .update({
        key: null,
      })
      .eq("id", firstOne.id);

    return { error: err };
  }
}
