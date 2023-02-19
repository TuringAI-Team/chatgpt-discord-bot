import { Events } from "discord.js";
import chalk from "chalk";
import ms from "ms";
import supabase from "../modules/supabase.js";
import { isPremium } from "../modules/premium.js";
import { SlashCommandBuilder, EmbedBuilder, time } from "discord.js";

const msgType = {
  type: "message",
  load: async (msg) => {
    await msg.react("<a:loading:1051419341914132554>");
  },
  reply: async (msg, content) => {
    try {
      await msg.reply(content);
    } catch (err) {}

    try {
      await msg.reactions.removeAll();
    } catch (err) {}
  },
};

export default {
  name: Events.MessageCreate,
  once: false,
  async execute(message, client) {
    if (message.mentions.has(client.user) && !message.author.bot) {
      var content = message.content;
      if (message.content.includes(`<@${client.user.id}>`)) {
        if (!message.content.startsWith(`<@${client.user.id}>`)) return;
        content = message.content.split(`<@${client.user.id}> `)[1];
      }

      var commandName = content;
      var commands = await client.commands.toJSON();
      if (!commandName) commandName = "help";
      var command = client.commands.get(commandName);
      var options: any = {};
      message.user = message.author;

      if (!command) {
        commandName = "chat";
        command = client.commands.get(commandName);
      }
      if (command.disablePing) return;
      if (commandName == "chat" || commandName == "voice") {
        options.message = content.replace("chat ", "");
        options.model = "chatgpt";
      }
      var guildId;
      if (message.guild) guildId = message.guild.id;
      var ispremium = await isPremium(message.author.id, guildId);
      try {
        if (command.cooldown && ispremium == false) {
          let { data: cooldowns, error } = await supabase
            .from("cooldown")
            .select("*")

            // Filters
            .eq("userId", message.author.id)
            .eq("command", commandName);
          if (cooldowns && cooldowns[0]) {
            var cooldown = cooldowns[0];
            var createdAt = new Date(cooldown.created_at);
            var milliseconds = createdAt.getTime();
            var now = Date.now();
            var diff = now - milliseconds;
            //@ts-ignore
            var count = ms(command.cooldown) - diff;
            //@ts-ignore
            if (diff >= ms(command.cooldown)) {
              const { data, error } = await supabase
                .from("cooldown")
                .update({ created_at: new Date() })
                .eq("userId", message.author.id)
                .eq("command", commandName);
              await command.execute(
                message,
                client,
                commands,
                msgType,
                options
              );
            } else {
              await message.reply({
                content:
                  `Use this command again **${ms(
                    count
                  )}**.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
                  "`/premium buy` .",
                ephemeral: true,
              });
            }
          } else {
            const { data, error } = await supabase
              .from("cooldown")
              .insert([{ userId: message.author.id, command: commandName }]);
            await command.execute(message, client, commands, msgType, options);
          }
        } else {
          await command.execute(message, client, commands, msgType, options);
        }
      } catch (error) {
        try {
          await message.reply({
            content: "There was an error while executing this command!",
            ephemeral: true,
          });
        } catch (err) {}
      }
    }
  },
};
