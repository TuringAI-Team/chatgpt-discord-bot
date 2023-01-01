import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { chat } from "../modules/gpt-api.js";
import { getUser, updateCredits } from "../modules/user.js";
import supabase from "../modules/supabase.js";

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
    if (user.credits <= 0) {
      await interaction.editReply(
        `You don't have enough credits for this acction. If you want more credits, please join us in [dsc.gg/turing](https://dsc.gg/turing)`
      );
      return;
    }
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
      if (
        result !=
          "We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)" &&
        result !=
          "Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)"
      ) {
        const { data, error } = await supabase.from("results").insert([
          {
            provider: "chatgpt",
            prompt: message.toLowerCase(),
            result: { text: result },
          },
        ]);
      }
    }
    if (
      result !=
        "Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)" &&
      result !=
        "Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)" &&
      result !=
        `We are reaching our capacity limits right now please wait 1-2 minutes. \nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`
    ) {
      await updateCredits(user.id, user.credits - 1);
    }
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
      await checkGuild(interaction, client);

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
      await checkGuild(interaction, client);

      return;
    }
    await interaction.editReply(
      `**Human:** ${message}\n**ChatGPT:** ${result}`
    );
    await checkGuild(interaction, client);
    return;
  },
};

async function checkGuild(interaction, client) {
  if (process.env.REQUIRED_MEMBERS) {
    var guild = interaction.guild;
    if (guild && guild.memberCount <= parseInt(process.env.REQUIRED_MEMBERS)) {
      var owner = await guild.fetchOwner();
      var ch = client.channels.cache.get("1051425293715390484");
      ch.send(
        `I have left **${guild.name}**(${guild.id})\nIt has a total of **${guild.memberCount} members**.\nThe owner is: **${owner.user.tag}(${owner.id})**`
      );
      await interaction.channel.send(
        `${owner}, I am going to leave this server, since the bot is limited to servers with more than **${process.env.REQUIRED_MEMBERS} members**. If you want to continue using the bot please go to [dsc.gg/turing](https://dsc.gg/turing) . Thanks for using the bot and sorry for the inconvenience.`
      );
      await guild.leave();
    }
  }
}
