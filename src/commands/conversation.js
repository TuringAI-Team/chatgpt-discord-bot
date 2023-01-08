import { SlashCommandBuilder } from "discord.js";
import supabase from "../modules/supabase.js";
import { createConversation } from "../modules/gpt-api.js";
import ms from "ms";
import { CollectorUtils } from "discord.js-collector-utils";
import delay from "delay";

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
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("initialmessage")
        .setDescription("The first message of the conversation")
        .setRequired(true)
    ),
  async execute(interaction) {
    var type = "public";
    var privateConversation = false;
    if (type == "private") {
      privateConversation = true;
    }
    await interaction.editReply({
      ephemeral: privateConversation,
      content: `This function is under maintenance.\nYou can find more information [in our server](https://dsc.gg/turing).`,
    });
    return;
    await interaction.reply({
      content: `Creating collector...`,
      ephemeral: privateConversation,
    });
    if (!interaction.channel) {
      await interaction.editReply({
        ephemeral: privateConversation,
        content: `This function is only available for server chats.\nYou can use it [in our server](https://dsc.gg/turing) or in other server with this bot.`,
      });
      return;
    }
    var conversationExist = await checkConversation(interaction.channel.id);
    if (conversationExist) {
      await interaction.editReply({
        ephemeral: privateConversation,
        content: `There is an active conversation in this channel`,
      });
      return;
    }
    var duration = ms(interaction.options.getString("time"));
    var initialMessage = interaction.options.getString("initialmessage");
    var conversation = await createConversation(initialMessage);
    if (
      conversation ==
      `Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`
    ) {
      await interaction.editReply({
        ephemeral: privateConversation,
        content: `Wait 1-2 mins the bot is reloading.\nFor more information join our discord: [dsc.gg/turing](https://dsc.gg/turing)`,
      });
      return;
    }
    if (conversation.error) {
      await interaction.editReply({
        ephemeral: privateConversation,
        content: conversation.error,
      });
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
    await delay(ms("5s"));
    await interaction.editReply({
      ephemeral: privateConversation,
      content: `Collector ready.\nStart talking and the bot will answer.\nUse stop to finish the conversation`,
    });
    await interaction.channel.send(
      `**Human:** ${initialMessage}\n**ChatGPT:** ${conversation.response}`
    );

    console.log(
      `${interaction.guild.name} ${interaction.user.tag} - new conversation`
    );
    var answered = true;
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
        if (!answered) {
          var msg = await message.reply(
            "Please wait until I answer your previous messsage."
          );
          return;
        }
        answered = false;
        var msg = await message.reply(
          "Loading ...\nNow that you are waiting you can join us in [dsc.gg/turing](https://dsc.gg/turing)"
        );
        await delay(ms("10s"));
        const response1 = await conversation.send(message.content);
        answered = true;
        if (response1.split("").length >= 1600) {
          await msg.edit(response1.split("").slice(0, 1500).join(""));
          await interaction.channel.send(
            response1.split("").slice(1500).join("")
          );
        } else {
          await msg.edit(response1);
        }

        msg.edit(response1);
      },
      // Options
      {
        time: duration,
        reset: false,
        stopFilter: (message) => message.content.toLowerCase() === "stop",
        target: interaction.user,
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
