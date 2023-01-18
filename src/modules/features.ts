import { Client } from "discord.js";
export async function checkIsTuring(client: Client, userId: string) {
  var guild = await client.guilds.cache.get("899761438996963349");
  if (guild) {
    var member = await guild.members.cache.get(userId);
    if (member) {
      return true;
    }
  }
  return false;
}
