import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  PermissionsBitField,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import "dotenv/config";
import { activateKey, isPremium } from "../modules/premium.js";
import supabase from "../modules/supabase.js";

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
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("info")
      .setDescription("Get information about your subscription.")
  );
export default {
  data,
  disablePing: true,
  ephemeral: true,
  async execute(interaction, client) {
    var key = interaction.options.getString("key");
    var type = interaction.options.getString("type");
    if (interaction.options.getSubcommand() === "buy") {
      await interaction.editReply({
        content:
          `You can buy a key to get Turing AI Premium [here](https://turingai.mysellix.io/). After buying your key you can activate your subscription using the command:` +
          "`/premium claim`",
        ephemeral: false,
      });
    } else if (interaction.options.getSubcommand() === "claim") {
      if (!key) {
        await interaction.editReply({
          content: `Invalid key`,
          ephemeral: true,
        });
      }
      var r;
      if (type == "server") {
        if (
          !interaction.member.permissions.has(
            PermissionsBitField.Flags.Administrator
          )
        ) {
          await interaction.reply({
            content: `You need to be an administrator to activate a server key.`,
            ephemeral: true,
          });
          return;
        }
        r = await activateKey(key, interaction.guild.id, type);
      } else {
        r = await activateKey(key, interaction.user.id, type);
      }
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
    } else if (interaction.options.getSubcommand() === "info") {
      let guildId;
      if (interaction.guild) guildId = interaction.guild.id;
      let premium = await isPremium(interaction.user.id, guildId);
      if (premium) {
        let premiumData = await supabase
          .from("premium")
          .select("*")

          // Filters
          .eq("id", interaction.user.id);
        if (!premiumData.data[0]) {
          // check if user is admin
          if (
            !interaction.member.permissions.has(
              PermissionsBitField.Flags.Administrator
            )
          ) {
            await interaction.reply({
              content: `You need to be an administrator to check your server subscription.`,
              ephemeral: true,
            });
            return;
          }
          premiumData = await supabase
            .from("premium")
            .select("*")
            .eq("id", interaction.guild.id);
        }
        let embed = new EmbedBuilder()
          .setTitle("Turing AI Premium")
          .setTimestamp()
          .addFields(
            {
              name: "Type",
              value: premiumData.data[0].type,
              inline: true,
            },
            {
              name: "Expires at",
              value: formatMs(premiumData.data[0].expires_at),
              inline: true,
            },
            {
              name: "Renewed at",
              value: formatMs(premiumData.data[0].renewed_at),
              inline: true,
            }
          )
          .setColor("#5865F2");
        await interaction.editReply({
          content: `${interaction.user}, here is your premium information:`,
          embeds: [embed],
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content:
            `You don't have Turing AI Premium. You can buy a key to get Turing AI Premium [here](https://turingai.mysellix.io/). After buying your key you can activate your subscription using the command:` +
            "`/premium claim`",
          ephemeral: true,
        });
      }
    }
  },
};

function formatMs(ms) {
  //  format to dd/mm/yyyy hh:mm:ss
  var d = new Date(ms);
  var date = d.getDate();
  var month = d.getMonth() + 1;
  var year = d.getFullYear();
  var hours = d.getHours();
  var minutes = d.getMinutes();
  var seconds = d.getSeconds();
  return `${date}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}
