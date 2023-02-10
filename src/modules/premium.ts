import supabase from "./supabase.js";
import ms from "ms";

export async function isPremium(userId: string, serverId: string) {
  let { data: premium, error } = await supabase
    .from("premium")
    .select("*")

    // Filters
    .eq("id", userId);
  if (premium && premium[0]) {
    var now = Date.now();
    if (now >= premium[0].expires_at) {
      const { data, error } = await supabase
        .from("premium")
        .delete()
        .eq("id", userId);

      return false;
    }
    return true;
  }
  let { data: premiumServer } = await supabase
    .from("premium")
    .select("*")

    // Filters
    .eq("id", serverId);
  if (premiumServer && premiumServer[0]) {
    var now = Date.now();
    if (now >= premiumServer[0].expires_at) {
      const { data, error } = await supabase
        .from("premium")
        .delete()
        .eq("id", serverId);

      return false;
    }
    return true;
  }
  return false;
}

export async function activateKey(key: string, id: string, type: string) {
  let { data: keyD, error } = await supabase
    .from("keys")
    .select("*")

    // Filters
    .eq("key", key)
    .eq("claimed", false);
  if (keyD && keyD[0]) {
    var duration = keyD[0].duration;
    if (duration == "1m") duration = "30d";
    if (type == "user" && keyD[0].type == "server") {
      return {
        error: `This key is for servers not for users.`,
      };
    }
    if (type == "server" && keyD[0].type == "user") {
      return {
        error: `This key is for users not for servers.`,
      };
    }
    var r = await makeItPremium(id, "key", duration, type);
    await supabase
      .from("keys")
      .update({
        claimed: true,
        claimedAt: Date.now(),
        claimedBy: id,
        duration: duration,
      })
      // Filters
      .eq("key", key);

    return {
      message: `Turing AI Premium ${r} successfully`,
    };
  } else {
    return {
      error: "Invalid key",
    };
  }
}

export async function makeItPremium(
  id: string,
  method: string,
  duration: string,
  type: string
) {
  let { data: premium, error } = await supabase
    .from("premium")
    .select("*")

    // Filters
    .eq("id", id);
  if (premium && premium[0]) {
    await renew(id, method, duration, premium[0]);
    return "renewed";
  } else {
    await create(id, method, duration, type);
    return "activated";
  }
}

async function renew(id: string, method: string, duration: string, actual) {
  const { data, error } = await supabase
    .from("premium")
    .update({
      renewed_at: Date.now(),
      method: method,
      expires_at: actual.expires_at + ms(duration),
    })
    .eq("id", id);
}

async function create(
  id: string,
  method: string,
  duration: string,
  type: string
) {
  const { data, error } = await supabase.from("premium").insert([
    {
      id: id,
      renewed_at: Date.now(),
      method: method,
      expires_at: Date.now() + ms(duration),
      type: type,
    },
  ]);
}
