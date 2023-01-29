import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import "dotenv/config";
import { activateKey } from "../modules/premium.js";

var data = new SlashCommandBuilder()
  .setName("premium")
  .setDescription(
    "Get your Turing AI premium subscription and use the bot without restrictions."
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("buy").setDescription("Buy your key.")
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("claim")
      .setDescription("Activate your subscription with your key.")

      .addStringOption((option) =>
        option
          .setName("key")
          .setDescription("The key you have bought in our shop.")
          .setRequired(true)
      )
  );
export default {
  data,
  async execute(interaction, client) {
    var key = interaction.options.getString("key");
    if (interaction.options.getSubcommand() === "buy") {
      await interaction.reply({
        content:
          `You can buy a key to get Turing AI Premium [here](https://turingai.mysellix.io/). After buying your key you can activate your subscription using the command:` +
          "`/premium claim`",
        ephemeral: true,
      });
    } else {
      await interaction.deferReply();
      if (!key) {
        await interaction.editReply({
          content: `Invalid key`,
          ephemeral: true,
        });
      }
      var r = await activateKey(key, interaction.user.id);
      if (r.error) {
        await interaction.editReply({
          content: r.error,
          ephemeral: true,
        });
        return;
      }
      if (r.message) {
        await interaction.editReply({
          content: `${interaction.user}, ${r.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
