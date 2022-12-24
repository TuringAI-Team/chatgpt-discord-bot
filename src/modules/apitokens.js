import supabase from "./supabase.js";
import { initTokens } from "./loadbalancer.js";
var currentApiToken;

async function useApiToken() {
  let { data: apitokens } = await supabase
    .from("apitokens")
    .select("*")
    .eq("id", currentApiToken.id);
  const { data, error } = await supabase
    .from("apitokens")
    .update({ requests: apitokens[0].requests + 1 })
    .eq("id", currentApiToken.id);
  if (apitokens[0].requests >= 120) {
    const { data, error } = await supabase
      .from("apitokens")
      .delete()
      .eq("id", currentApiToken.id);
    await newApiToken();
    await initTokens();
  }
}

async function newApiToken() {
  let { data: apitokens, error } = await supabase.from("apitokens").select("*");
  currentApiToken = apitokens[0];
}

async function getApiToken() {
  if (!currentApiToken) {
    await newApiToken();
  }
  return currentApiToken.token;
}

export { getApiToken, useApiToken };
