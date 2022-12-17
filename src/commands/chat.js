import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { chat } from "../modules/gpt-api.js";
import { getUser } from "../modules/user.js";

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
  async execute(interaction) {
    var user = await getUser(interaction.user);
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
    var result = await chat(message);
    /* console.log(
      `${interaction.guild ? interaction.guild.name : "dm"} ${
        interaction.user.tag
      }: ${message}\nAI: ${result}`
    );*/
    if (result.split("").length >= 3500) {
      await interaction.editReply(
        `**Human:** ${message}\n**ChatGPT:** ${result
          .split("")
          .slice(0, 1500)
          .join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(1600, 3000).join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(3000).join("")}`
      );
      return;
    }
    if (result.split("").length >= 1600) {
      await interaction.editReply(
        `**Human:** ${message}\n**ChatGPT:** ${result
          .split("")
          .slice(0, 1600)
          .join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(1600).join("")}`
      );
      return;
    }
    await interaction.editReply(
      `**Human:** ${message}\n**ChatGPT:** ${result}`
    );

    return;
  },
};
