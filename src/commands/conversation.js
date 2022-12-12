import { SlashCommandBuilder } from "discord.js";
import { getUser } from "../modules/user.js";
import supabase from "../modules/supabase.js";
import { createConversation } from "../modules/gpt.js";
import ms from "ms";
import { CollectorUtils } from "discord.js-collector-utils";

export default {
  data: new SlashCommandBuilder()
    .setName("conversation")
    .setDescription("Start a conversation with ChatGPT")
    .addStringOption((option) =>
      option
        .setName("time")
        .setDescription("The max duration of the conversation")
        .addChoices(
          { name: "2 minutes", value: "2m" },
          { name: "4 minutes", value: "4m" },
          { name: "6 minutes", value: "6m" },
          { name: "8 minutes", value: "8m" },
          { name: "10 minutes", value: "10m" },
          { name: "12 minutes", value: "12m" }
        )
        .setRequired(false)
    ),
  async execute(interaction) {
    var user = await getUser(interaction.user);
    await interaction.reply({
      content: `Creating collector...`,
    });
    if (!interaction.channel) {
      await interaction.editReply(
        `This function is only available for server chats.\nYou can use it [in our server](https://dsc.gg/turing) or in other server with this bot.`
      );
      return;
    }
    var conversationExist = await checkConversation(interaction.channel.id);
    if (conversationExist) {
      await interaction.editReply(
        `There is an active conversation in this channel`
      );
      return;
    }
    //var duration = ms(interaction.options.getString("time"));
    await interaction.editReply(
      `Collector ready.\nStart talking and the bot will answer.\nUse stop to finish the conversation`
    );
    console.log(
      `${interaction.guild.name} ${interaction.user.tag} - new conversation`
    );
    var conversation = await createConversation();
    if (conversation == `Wait 1-2 mins the bot is reloading .`) {
      await interaction.editReply(`Wait 1-2 mins the bot is reloading .`);
      return;
    }
    if (
      conversation ==
      `ChatGPT is down now.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`
    ) {
      await interaction.editReply(
        `ChatGPT is down now.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`
      );
      return;
    }
    const { data, error } = await supabase.from("conversations").insert([
      {
        id: interaction.channel.id,
        abled: true,
      },
    ]);
    if (error) {
      console.log(error);
    }

    let collector = await CollectorUtils.collectByMessage(
      interaction.channel,
      // Retrieve Result
      async (message) => {
        if (message.author.bot) return;
        if (message.content == "stop") {
          const { data, error } = await supabase
            .from("conversations")
            .delete()
            .eq("id", interaction.channel.id)
            .eq("abled", true);

          message.reply("Conversation finished");
          return;
        }
        var msg = await message.reply("Loading ...");
        const response1 = await conversation.sendMessage(message.content);
        msg.edit(response1);
      },
      // Options
      {
        time: ms("8m"),
        reset: false,
        stopFilter: (message) => message.content.toLowerCase() === "stop",

        onExpire: async () => {
          const { data, error } = await supabase
            .from("conversations")
            .delete()
            .eq("id", interaction.channel.id)
            .eq("abled", true);

          await interaction.channel.send(`Conversation finished.`);
        },
      }
    );
    return;
  },
};

async function checkConversation(channelID) {
  let { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")

    // Filters
    .eq("id", channelID)
    .eq("abled", true);
  if (error) {
    return false;
  } else {
    if (conversations.length > 0) {
      return true;
    }
    return false;
  }
}
