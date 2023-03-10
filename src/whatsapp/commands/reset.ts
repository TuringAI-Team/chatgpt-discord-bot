import supabase from "../../modules/supabase.js";

export default {
  name: "reset",
  description: "Reset your conversation with the bot",
  cooldown: null,
  async execute(message, client) {
    try {
      await supabase.from("conversations").delete().eq("id", message.user.id);
      await message.reply("Conversation has been reset");
    } catch (err) {
      await message.reply("Error connecting with db");
      return;
    }
  },
};
