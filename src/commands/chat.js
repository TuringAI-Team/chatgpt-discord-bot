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
      await checkGuild(interaction);

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
      await checkGuild(interaction);

      return;
    }
    await interaction.editReply(
      `**Human:** ${message}\n**ChatGPT:** ${result}`
    );
    await checkGuild(interaction);
    return;
  },
};

async function checkGuild(interaction) {
  if (process.env.REQUIRED_MEMBERS) {
    var guild = interaction.guild;
    if (guild && guild.memberCount <= parseInt(process.env.REQUIRED_MEMBERS)) {
      var owner = await guild.fetchOwner();
      var ch = client.channels.cache.get("1051425293715390484");
      ch.send(
        `I have left **${guild.name}**(${guild.id})\nIt has a total of **${guild.memberCount} members**.\nThe owner is: **${owner.user.tag}(${owner.id})**`
      );
      await interaction.channel.send(
        `${owner}, I am going to leave this server, since the bot is limited to servers with more than **${process.env.REQUIRED_MEMBERS} members. If you want to continue using the bot please go to [dsc.gg/turing](https://dsc.gg/turing). Thanks for using the bot and sorry for the inconvenience.`
      );
      await guild.leave();
    }
  }
}
