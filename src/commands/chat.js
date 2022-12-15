import { SlashCommandBuilder } from "discord.js";
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
    ),
  async execute(interaction) {
    var user = await getUser(interaction.user);
    var message = interaction.options.getString("message");
    await interaction.reply({
      content: `Loading...\nNow that you are waiting you can join us in [dsc.gg/turing](https://dsc.gg/turing)`,
    });
    var result = await chat(message);
    /* console.log(
      `${interaction.guild ? interaction.guild.name : "dm"} ${
        interaction.user.tag
      }: ${message}\nAI: ${result}`
    );*/
    if (result.split("").length >= 4000) {
      await interaction.editReply(
        `**Human:** ${message}\n**ChatGPT:** ${result
          .split("")
          .slice(0, 1500)
          .join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(1500, 3000).join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(3000).join("")}`
      );
      return;
    }
    if (result.split("").length >= 2000) {
      await interaction.editReply(
        `**Human:** ${message}\n**ChatGPT:** ${result
          .split("")
          .slice(0, 1500)
          .join("")}`
      );
      await interaction.channel.send(
        ` ${result.split("").slice(1500).join("")}`
      );
      return;
    }
    await interaction.editReply(
      `**Human:** ${message}\n**ChatGPT:** ${result}`
    );

    return;
  },
};
