import ms from "ms";
import supabase from "./supabase.js";

async function getTokens() {
  let { data: sessiontokens, error } = await supabase
    .from("sessiontokens")
    .select("*");
  if (error) return error;

  return sessiontokens;
}

async function reloadTokens() {
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
    }
  }
}
