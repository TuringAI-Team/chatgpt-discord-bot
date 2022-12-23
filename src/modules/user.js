import supabase from "./supabase.js";

async function getUser(discordUser) {
  let { data: users, error } = await supabase
    .from("users")
    .select("*")

    // Filters
    .eq("id", discordUser.id);
  if (error) {
    return { error: error.message };
  }
  if (users[0]) {
    return users[0];
  } else {
    const { data, error } = await supabase.from("users").insert([
      {
        id: discordUser.id,
        credits: 5,
        created_at: new Date(),
      },
    ]);
    if (error) {
      return { error: error.message };
    }
    return {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      credits: 5,
      created_at: new Date(),
    };
  }
}
async function updateCredits(id, credits) {
  const { data, error } = await supabase
    .from("users")
    .update({ credits: credits })
    .eq("id", id);
  if (error) {
    return { error: error.message };
  }
}
export { getUser, updateCredits };
