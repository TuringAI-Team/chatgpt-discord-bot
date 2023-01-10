import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { renderResponse } from "../modules/render-response.js";

export default {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with ChatGPT")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for ChatGPT")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of message for ChatGPT")
        .setRequired(false)
        .addChoices(
          { name: "public", value: "public" },
          { name: "private", value: "private" }
        )
    ),
  async execute(interaction, client) {
    var message = interaction.options.getString("message");
    var type = interaction.options.getString("type");

    var privateConversation = false;
    if (type == "private") {
      privateConversation = true;
    }
    await interaction.reply({
      ephemeral: privateConversation,
      content: `Loading...\nNow that you are waiting you can join us in [dsc.gg/turing](https://dsc.gg/turing)`,
    });
    var result;
    let { data: results, error } = await supabase
      .from("results")
      .select("*")

      // Filters
      .eq("prompt", message.toLowerCase())
      .eq("provider", "chatgpt");
    if (results[0] && results[0].result.text) {
      result = results[0].result.text;
      const { data, error } = await supabase
        .from("results")
        .update({ uses: results[0].uses + 1 })
        .eq("id", results[0].id);
    } else {
      result = await chat(message);
    }

    if (!result.error) {
      const { data, error } = await supabase.from("results").insert([
        {
          provider: "chatgpt",
          prompt: message.toLowerCase(),
          result: { text: result },
          guildId: interaction.guildId,
        },
      ]);
      var channel = interaction.channel;
      if (!interaction.channel) channel = interaction.user;
      var response = await renderResponse({
        prompt: message,
        response: result,
        userImageUrl: interaction.user.avatarURL(),
        username: interaction.user.tag,
      });
      var image = new AttachmentBuilder(response, { name: "output.jpg" });

      await interaction.editReply({
        content: "",
        files: [image],
      });
    } else {
      var response = await renderResponse({
        prompt: message,
        response: result.error,
        username: interaction.user.tag,
        userImageUrl: interaction.user.avatarURL(),
      });
      var image = new AttachmentBuilder(response, { name: "output.jpg" });

      await interaction.editReply({
        content: "",
        files: [image],
      });
    }
    return;
  },
};
