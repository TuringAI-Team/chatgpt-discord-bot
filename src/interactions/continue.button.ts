import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { getVoiceConnection } from "@discordjs/voice";
import { checkTerms } from "../modules/terms.js";
import { chat } from "../modules/gpt-api.js";
import ms from "ms";
import { isPremium } from "../modules/premium.js";

export default {
  data: {
    customId: "co",
    description: "Continue your conversation",
  },
  async execute(interaction, client, userId) {
    if (interaction.user.id != userId) {
      await interaction.reply({
        content: `${interaction.user} , you can't continue this answer because you are not the owner of this conversation.`,
        ephemeral: true,
      });
      return;
    }

    let terms = await checkTerms(userId, "discord");
    if (typeof terms == "string") {
      await interaction.reply({
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
      if (!ispremium) {
        let { data: cooldowns, error } = await supabase
          .from("cooldown")
          .select("*")

          // Filters
          .eq("userId", interaction.user.id)
          .eq("command", "continue-btn");
        if (cooldowns && cooldowns[0]) {
          var cooldown = cooldowns[0];
          var createdAt = new Date(cooldown.created_at);
          var milliseconds = createdAt.getTime();
          var now = Date.now();
          var diff = now - milliseconds;
          // @ts-ignore
          var count = ms("1m") - diff;
          // @ts-ignore
          if (diff >= ms("1m")) {
            const { data, error } = await supabase
              .from("cooldown")
              .update({ created_at: new Date() })
              .eq("userId", interaction.user.id)
              .eq("command", "continue-btn");
            await continuefn(terms, interaction, ispremium, channel);
          } else {
            await interaction.reply({
              content:
                `Please wait **${ms(
                  count
                )}** to use this command again.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
                "`/premium buy` .",
              ephemeral: true,
            });
          }
        } else {
          const { data, error } = await supabase
            .from("cooldown")
            .insert([{ userId: interaction.user.id, command: "continue-btn" }]);
          await continuefn(terms, interaction, ispremium, channel);
        }
      } else {
        await continuefn(terms, interaction, ispremium, channel);
      }
    }
  },
};
async function continuefn(terms, interaction, ispremium, channel) {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({
        ephemeral: false,
      });
    } catch (err) {}
  }
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
    await responseWithText(interaction, "continue", response, channel, model);
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
