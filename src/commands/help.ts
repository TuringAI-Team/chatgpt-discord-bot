import { SlashCommandBuilder, EmbedBuilder, time } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get the command list of the bot"),
  async execute(interaction, client, commands, commandType) {
    let fields = [];
    for (let i = 0; i < commands.length; i++) {
      let command = commands[i].data;
      if (command.description) {
        let optionMsg = "";
        if (command.options) {
          let maxLength = command.options.length;
          if (maxLength > 3) maxLength = 3;
          for (let j = 0; j < maxLength; j++) {
            let option = command.options[j];
            optionMsg += " `" + `${option.name}: ${option.description}` + "`";
          }
        }

        let newField = {
          name: `/${command.name} ${optionMsg}`,
          value: command.description,
          inline: false,
        };
        fields.push(newField);
      }
    }
    let embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTimestamp()
      .setTitle("ChatGPT Help")
      .addFields(fields)
      .setFooter({
        text: "This is not an official bot.",
      });
    await commandType.reply(interaction, {
      embeds: [embed],
    });
    return;
  },
};
