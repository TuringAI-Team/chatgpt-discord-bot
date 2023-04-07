import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { getVoiceConnection } from "@discordjs/voice";
import { checkTerms } from "../modules/terms.js";
import { chat } from "../modules/gpt-api.js";
import { isPremium } from "../modules/premium.js";

export default {
  data: {
    customId: "co",
    description: "Continue your conversation",
  },
  async execute(interaction, client, userId) {
    if (!interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply({
          ephemeral: false,
        });
      } catch (err) {}
    }

    if (interaction.user.id != userId) {
      await interaction.editReply({
        content: "You can't continue this message",
        ephemeral: true,
      });
      return;
    }
    let terms = await checkTerms(userId, "discord");
    if (typeof terms == "string") {
      await interaction.editReply({
        content: terms,
        ephemeral: true,
      });
      setTimeout(async () => {
        await interaction.deleteReply();
      }, 8000);
      return;
    }
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    var ispremium = await isPremium(interaction.user.id, guildId);
    let channel = interaction.channel;
    if (!interaction.channel) channel = interaction.user;
    if (terms) {
      var model = terms.model;
      let result = await chat(
        "continue",
        interaction.user.username,
        ispremium,
        model,
        `${model}-${interaction.user.id}`,
        0,
        null,
        interaction
      );
      // }

      if (!result) {
        await responseWithText(
          interaction,
          "continue",
          `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
          channel,
          "error"
        );
        return;
      }
      if (!result.error) {
        var response = result.text;
        await responseWithText(
          interaction,
          "continue",
          response,
          channel,
          model
        );
      } else {
        await responseWithText(
          interaction,
          "continue",
          result.error,
          channel,
          "error"
        );
      }
    }
  },
};

export async function responseWithText(
  interaction,
  prompt,
  result,
  channel,
  type
) {
  prompt = prompt
    .replaceAll("@everyone", "everyone")
    .replaceAll("@here", "here")
    .replaceAll("<@", "@");

  var completeResponse = `**AI(${type}):** ${result}`;
  var charsCount = completeResponse.split("").length;

  var rows = [];

  if (charsCount / 2000 >= 1) {
    var lastMsg;
    var loops = Math.ceil(charsCount / 2000);
    console.log(loops);

    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          lastMsg = await interaction.editReply({
            content: completeResponse.split("").slice(0, 2000).join(""),
            components: rows,
            ephemeral: false,
            //    files: files,
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
    interaction.editReply({
      content: completeResponse,
      components: rows,
      ephemeral: false,
      //files: files,
    });
  }
}
