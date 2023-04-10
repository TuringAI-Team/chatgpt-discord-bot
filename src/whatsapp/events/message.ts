import { isPremium } from "../../modules/premium.js";
import supabase from "../../modules/supabase.js";
import ms from "ms";
import { validate } from "uuid";
import { checkTerms } from "../../modules/terms.js";
import delay from "delay";

export default {
  name: "message",
  async execute(message, client) {
    if (!(message.from || message.body.length || message.fromMe)) return;

    message.user = {
      id: message.from,
      name: message.from,
      ispremium: await isPremium(message.from, null),
      contact: await message.getContact(),
    };
    message.load = async () => {
      client.sendSeen(message.from);
    };

    message.content = message.body;
    // command that start with ! or / or .
    var args;
    if (
      message.content.startsWith("!") ||
      message.content.startsWith("/") ||
      message.content.startsWith(".")
    ) {
      args = message.content.slice(1).trim().split(/ +/g);
      message.commandName = args.shift().toLowerCase();
      if (message.commandName == "chat") {
        var content = args.join(" ");
        message.content = content;
      }
    }
    if (!message.commandName) {
      if (message.isGroup) return;
      if (isUUIDv4(message.content)) {
        message.commandName = "claim";
        args = [message.content];
      } else {
        message.commandName = "chat";
      }
    }
    var command = client.commands.find((x) => x.name == message.commandName);
    if (!command) return await message.reply("Command not found");
    var terms: any = await checkTerms(message.user.id, "whatsapp");
    if (terms && !terms.model) {
      try {
        await message.reply(terms);
        await delay(8000);
      } catch (e) {
        console.log(e);
      }
    }
    var ispremium = message.user.ispremium;
    try {
      if (ispremium == false && command.cooldown) {
        let { data: cooldowns, error } = await supabase
          .from("cooldown")
          .select("*")

          // Filters
          .eq("userId", message.user.id)
          .eq("command", `whatsapp-${command.name}`);
        if (cooldowns && cooldowns[0]) {
          var cooldown = cooldowns[0];
          var createdAt = new Date(cooldown.created_at);
          var milliseconds = createdAt.getTime();
          var now = Date.now();
          var diff = now - milliseconds;
          // @ts-ignore
          var count = ms(command.cooldown) - diff;
          // @ts-ignore
          if (diff >= ms(command.cooldown)) {
            const { data, error } = await supabase
              .from("cooldown")
              .update({ created_at: new Date() })
              .eq("userId", message.user.id)
              .eq("command", `whatsapp-${command.name}`);
            await command.execute(message, client, args);
          } else {
            var msg = await message.reply(
              `Use this command again *${ms(
                count
              )}*.\nIf you want to *avoid this cooldown* you can *donate to get premium*. If you want to donate use the command buy a key in our shop and send it here.`
            );
            await msg.reply(
              `Our shop: https://turingai.mysellix.io/product/63d6802c1fc36`
            );
          }
        } else {
          const { data, error } = await supabase
            .from("cooldown")
            .insert([
              { userId: message.user.id, command: `whatsapp-${command.name}` },
            ]);
          await command.execute(message, client, args);
        }
      } else {
        await command.execute(message, client, args);
      }
    } catch (error) {
      try {
        await message.reply("There was an error while executing this command!");
      } catch (error) {}
    }
  },
};

const isUUIDv4 = (str) => {
  return validate(str) && str[14] === "4";
};
