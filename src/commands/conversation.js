import { SlashCommandBuilder, MessageCollector } from "discord.js";
import { getUser } from "../modules/user.js";
import { createConversation } from "../modules/gpt.js";
import ms from "ms";

export default {
  data: new SlashCommandBuilder()
    .setName("conversation")
    .setDescription("Start a conversation with ChatGPT"),
  async execute(interaction) {
    var user = await getUser(interaction.user);
    await interaction.reply({
      content: `Creating collector...`,
    });
    var conversation = await createConversation();
    await interaction.editReply(
      `Collector ready.\nStart talking an the bot will answer.`
    );
    const timeout = 120000;

    const collector = new MessageCollector(
      interaction.channel,
      (m) => m.author.id === interaction.author.id,
      {
        time: timeout,
      }
    );
    collector.on("collect", async (m) => {
      console.log(`Collected ${m.content}`);
      var res = await conversation.sendMessage(m.content);
      console.log(res);
      m.reply(res);
    });

    collector.on("end", (collected) => {
      console.log(`Collected ${collected.size} items`);
    });

    return;
  },
};
