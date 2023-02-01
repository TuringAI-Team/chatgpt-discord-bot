import { SlashCommandBuilder, EmbedBuilder, time } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Get the command list of the bot"),
  async execute(interaction, client, commands, commandType) {
    var fields = [];
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
    await commandType.reply(interaction, {
      embeds: [embed],
    });
    return;
  },
};
