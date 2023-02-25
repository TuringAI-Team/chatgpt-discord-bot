import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
} from "discord.js";
import { chat } from "../modules/blip-2.js";
import supabase from "../modules/supabase.js";
import axios from "axios";
import { isPremium } from "../modules/premium.js";
var maintenance = false;

export default {
  cooldown: "2m",
  data: new SlashCommandBuilder()
    .setName("blip-2")
    .setDescription("Chat with an AI")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for the AI")
        .setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image option for chat with the bot")
        .setRequired(true)
    ),
  async execute(interaction, client, commands, commandType, options) {
    /*  await interaction.reply({
      content: `Under development`,
      ephemeral: true,
    });
    return;*/
    var ispremium = await isPremium(interaction.user.id, guildId);
    if (!ispremium) {
      await commandType.reply(interaction, {
        content:
          "This command is premium only since is in a test phase, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }
    await commandType.load(interaction);
    if (maintenance == true && interaction.user.id != "530102778408861706") {
      await commandType.reply(
        interaction,
        "Service under maintenance, for more information join us on [dsc.gg/turing](https://dsc.gg/turing)"
      );
      return;
    }
    var message;
    if (!interaction.options) {
      message = options.message;
    } else {
      message = interaction.options.getString("message");
      if (
        message.includes("@everyone") ||
        message.includes("<@") ||
        message.includes("@here")
      ) {
        return;
      }
    }

    var result;
    var cached = false;
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    const attachment = interaction.options.getAttachment("image");
    var img = await axios.get(attachment.url, {
      responseType: "arraybuffer",
    });
    result = await chat(
      attachment.url,
      message,
      interaction.user.username,
      `blip-${interaction.user.id}`
    );
    // }

    if (!result) {
      await responseWithText(
        interaction,
        message,
        `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
        channel,
        "error",
        commandType,
        attachment.url
      );
      return;
    }
    if (!result.error) {
      var response = result.text;
      if (cached == false) {
        const { data, error } = await supabase.from("results").insert([
          {
            provider: "blip-2",
            prompt: message.toLowerCase(),
            result: { text: response },
            guildId: interaction.guildId,
          },
        ]);
        // console.log(error);
      }
      var channel = interaction.channel;
      if (!interaction.channel) channel = interaction.user;

      await responseWithText(
        interaction,
        message,
        response,
        channel,
        "blip-2",
        commandType,
        attachment.url
      );
    } else {
      await responseWithText(
        interaction,
        message,
        result.error,
        channel,
        "error",
        commandType,
        attachment.url
      );
    }
    return;
  },
};

async function responseWithText(
  interaction,
  prompt,
  result,
  channel,
  type,
  commandType,
  image?
) {
  var completeResponse = `**${interaction.user.tag}:** ${prompt}\n**AI(${type}):** ${result}`;
  var charsCount = completeResponse.split("").length;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Danger)
      .setLabel(`Reset conversation with ${type}`)
      .setCustomId(`reset_${type}-${interaction.user.id}`)
  );
  var rows = [];
  if (type != "error") {
    rows.push(row);
  }
  if (charsCount / 2000 >= 1) {
    var lastMsg;
    var loops = Math.ceil(charsCount / 2000);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          lastMsg = await commandType.reply(interaction, {
            content: completeResponse.split("").slice(0, 2000).join(""),
            components: rows,
            files: [
              {
                attachment: image,
                name: "image.png",
              },
            ],
          });
        } catch (err) {
          console.log(err);
        }
      } else {
        if (channel) {
          try {
            lastMsg = await lastMsg.reply(
              completeResponse
                .split("")
                .slice(2000 * i, 2000 * i + 2000)
                .join("")
            );
          } catch (err) {}
        }
      }
    }
  } else {
    commandType.reply(interaction, {
      content: completeResponse,
      files: [
        {
          attachment: image,
          name: "image.png",
        },
      ],
    });
  }
}
