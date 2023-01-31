import { Events } from "discord.js";
import chalk from "chalk";
import ms from "ms";
import supabase from "../modules/supabase.js";
import { isPremium } from "../modules/premium.js";
import { SlashCommandBuilder, EmbedBuilder, time } from "discord.js";

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message, client) {
    if (message.mentions.has(client.user)) {
      var fields = [];
      var commands = await client.commands.toJSON();
      for (var i = 0; i < commands.length; i++) {
        var command = commands[i].data;
        var optionMsg = "";
        var maxLength = command.options.length;
        if (maxLength > 3) maxLength = 3;
        for (var j = 0; j < maxLength; j++) {
          var option = command.options[j];
          optionMsg += " `" + `${option.name}: ${option.description}` + "`";
        }
        var newField = {
          name: `/${command.name} ${optionMsg}`,
          value: command.description,
          inline: false,
        };
        fields.push(newField);
      }
      var embed = new EmbedBuilder()
        .setColor("#813479")
        .setTimestamp()
        .setTitle("ChatGPT Help")
        .addFields(fields)
        .setFooter({
          text: "This is not an official bot.",
        });
      await message.reply({
        embeds: [embed],
      });
      return;
    }
  },
};
