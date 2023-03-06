import supabase from "./supabase.js";
import fs from "fs";
export async function checkTerms(userId, platform) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId);

  if (error) {
    console.log(error);
    return false;
  }
  if (!data || data.length == 0 || !data[0]) {
    await supabase.from("users").insert([
      {
        id: userId,
        platform: platform,
        acceptterms: true,
        defaultChatModel: "chatgpt",
      },
    ]);
    return `By using this service you accept the following terms of service:\n\nhttps://turingai.tech/botterms\n\nThis message is going to be deleted in 8s in order to continue with your request.`;
  } else {
    return null;
  }
}
