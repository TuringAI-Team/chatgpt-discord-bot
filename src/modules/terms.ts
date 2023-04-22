import supabase from "./supabase.js";

export async function checkTerms(userId, platform) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId);

  if (error) {
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
    let hasvoted = false;
    try {
      hasvoted = await hasVoted(userId);
    } catch (e) {
      hasvoted = false;
    }
    return { model: data[0].defaultChatModel, hasVoted: hasvoted };
  }
}
export async function hasVoted(userId) {
  try {
    let res = await fetch(`https://api.turingai.tech/other/topgg/${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.TURING_KEY,
        "x-captcha-token": process.env.CAPTCHA_TOKEN,
      },
    });

    let data = await res.json();
    return data.hasVoted;
  } catch (e) {
    return false;
  }
}
