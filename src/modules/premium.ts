import supabase from "./supabase.js";
import ms from "ms";

export async function isPremium(id: string) {
  let { data: premium, error } = await supabase
    .from("premium")
    .select("*")

    // Filters
    .eq("id", id);
  if (premium && premium[0]) {
    var now = Date.now();
    if (now >= premium[0].expires_at) {
      const { data, error } = await supabase
        .from("premium")
        .delete()
        .eq("id", id);

      return false;
    }
    return true;
  }
  return false;
}

export async function activateKey(key: string, id: string) {
  let { data: keyD, error } = await supabase
    .from("keys")
    .select("*")

    // Filters
    .eq("key", key)
    .eq("claimed", false);
  if (keyD && keyD[0]) {
    var duration = keyD[0].duration;
    if (duration == "1m") duration = "30d";
    await makeItPremium(id, "key", duration);
    await supabase
      .from("keys")
      .update({
        claimed: true,
        claimedAt: Date.now(),
        claimedBy: id,
        duration: duration,
      })

      // Filters
      .eq("key", key)
      .eq("claimed", false);
    return {
      message: "Premium activated successfully",
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
  duration: string
) {
  let { data: premium, error } = await supabase
    .from("premium")
    .select("*")

    // Filters
    .eq("id", id);
  if (premium && premium[0]) {
    await renew(id, method, duration);
  } else {
    await create(id, method, duration);
  }
}

async function renew(id: string, method: string, duration: string) {
  const { data, error } = await supabase
    .from("premium")
    .update({
      renewed_at: Date.now(),
      method: method,
      expires_at: Date.now() + ms(duration),
    })
    .eq("id", id);
}

async function create(id: string, method: string, duration: string) {
  const { data, error } = await supabase.from("premium").insert([
    {
      id: id,
      renewed_at: Date.now(),
      method: method,
      expires_at: Date.now() + ms(duration),
    },
  ]);
}
