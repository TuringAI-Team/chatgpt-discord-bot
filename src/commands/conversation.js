import { SlashCommandBuilder } from "discord.js";
import { getUser } from "../modules/user.js";
import { createConversation } from "../modules/gpt.js";
import ms from "ms";
import { CollectorUtils } from "discord.js-collector-utils";

export default {
  data: new SlashCommandBuilder()
    .setName("conversation")
    .setDescription("Start a conversation with ChatGPT"),
  async execute(interaction) {
    var user = await getUser(interaction.user);
    await interaction.reply({
      content: `Creating collector...`,
    });
    await interaction.editReply(
      `Collector ready.\nStart talking and the bot will answer.\nUse stop to finish the conversation`
    );
    var conversation = await createConversation();

    let collector = await CollectorUtils.collectByMessage(
      interaction.channel,
      // Retrieve Result
      async (message) => {
        if (message.author.bot) return;
        if (message.content == "stop") {
          message.reply("Conversation finished");
          return;
        }
        var msg = await message.reply("Loading ...");
        const response1 = await conversation.sendMessage(message.content);
        msg.edit(response1);
      },
      // Options
      {
        time: 120000,
        reset: false,
        stopFilter: (message) => message.content.toLowerCase() === "stop",

        onExpire: async () => {
          await interaction.channel.send(`Conversation finished.`);
        },
      }
    );
    return;
  },
};
