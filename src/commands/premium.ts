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
      .addStringOption((option) =>
        option
          .setName("type")
          .setDescription("The key type you have bought in our shop.")
          .setRequired(true)
          .addChoices(
            {
              name: "Key for users",
              value: "user",
            },
            {
              name: "Key for servers",
              value: "server",
            }
          )
      )
  );
export default {
  data,
  async execute(interaction, client) {
    var key = interaction.options.getString("key");
    var type = interaction.options.getString("type");
    if (interaction.options.getSubcommand() === "buy") {
      await interaction.reply({
        content:
          `You can buy a key to get Turing AI Premium [here](https://turingai.mysellix.io/). After buying your key you can activate your subscription using the command:` +
          "`/premium claim`",
        ephemeral: false,
      });
    } else {
      if (!key) {
        await interaction.reply({
          content: `Invalid key`,
          ephemeral: true,
        });
      }
      var r;
      if (type == "server") {
        r = await activateKey(key, interaction.guild.id, type);
      } else {
        r = await activateKey(key, interaction.user.id, type);
      }
      if (r.error) {
        await interaction.reply({
          content: r.error,
          ephemeral: true,
        });
        return;
      }
      if (r.message) {
        await interaction.reply({
          content: `${interaction.user}, ${r.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
