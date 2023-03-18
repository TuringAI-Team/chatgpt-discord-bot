import supabase from "./supabase.js";
import fs from "fs";
import { VoteClient } from "topgg-votes";

const votesClient = new VoteClient()
  .setToken(process.env.TOPGG_TOKEN)
  .setPort(randomPort());
votesClient.postWebhook();
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
    let hasVoted = false;
    try {
      let voted = await votesClient.hasVoted(userId);
      if (voted) hasVoted = true;
    } catch (e) {
      hasVoted = false;
    }
    return { model: data[0].defaultChatModel, hasVoted: hasVoted };
  }
}
export async function hasVoted(userId) {
  try {
    let voted = await votesClient.hasVoted(userId);
    return voted;
  } catch (e) {
    return false;
  }
}

function randomPort() {
  let port = Math.floor(Math.random() * (65535 - 1024) + 1024);
  // check if port is in use
  try {
    fs.accessSync(`http://localhost:${port}`);
    return randomPort();
  } catch (e) {
    return port;
  }
}
