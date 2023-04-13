import {
  ContextMenuCommandBuilder,
  EmbedBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { removeMessage, useToken } from "../modules/loadbalancer.js";
import { isPremium } from "../modules/premium.js";
import delay from "delay";
import { randomUUID } from "crypto";
import { Configuration, OpenAIApi } from "openai";

export default {
  cooldown: "3m",
  data: new ContextMenuCommandBuilder()
    .setName("Translate this message")
    .setType(ApplicationCommandType.Message),
  async execute(interaction, client, commands, commandType, options) {
    await commandType.load(interaction);
    let guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    let ispremium = await isPremium(interaction.user.id, guildId);
    let result = await chat(
      interaction.targetMessage.content,
      "",
      ispremium,
      "translator",
      randomUUID(),
      0,
      null,
      interaction
    );
    let channel = interaction.channel;
    if (!interaction.channel) channel = interaction.user;
    if (!result) {
      await responseWithText(
        interaction,
        interaction.targetMessage.content,
        `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
        channel,
        "error",
        commandType
      );
      return;
    }
    if (!result.error) {
      var response = result.text;

      await responseWithText(
        interaction,
        interaction.targetMessage.content,
        response,
        channel,
        "",
        commandType
      );
    } else {
      await responseWithText(
        interaction,
        interaction.targetMessage.content,
        result.error,
        channel,
        "error",
        commandType
      );
    }
  },
};
async function responseWithText(
  interaction,
  prompt,
  result,
  channel,
  type,
  commandType
) {
  prompt = prompt
    .replaceAll("@everyone", "everyone")
    .replaceAll("@here", "here")
    .replaceAll("<@", "@");

  var completeResponse = `**Original Message:** ${prompt}\n**ChatGPT Translation:** ${result}`;
  var charsCount = completeResponse.split("").length;

  if (type != "error") {
  }

  if (charsCount / 2000 >= 1) {
    var lastMsg;
    var loops = Math.ceil(charsCount / 2000);
    console.log(loops);

    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          lastMsg = await commandType.reply(interaction, {
            content: completeResponse.split("").slice(0, 2000).join(""),
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
          } catch (err) {
            console.log(err);
          }
        }
      }
    }
  } else {
    commandType.reply(interaction, {
      content: completeResponse,
      //files: files,
    });
  }
}
function format(response: any, allProbs: any) {
  var classes = { "!": "unlikely", '"': "possibly" };
  const choices = response.choices[0];
  const logprobs = choices.logprobs.top_logprobs[0];
  const probs = Object.fromEntries(
    Object.entries(logprobs).map(([key, value]) => [
      key,
      100 * Math.exp(value as number),
    ])
  );
  const topProb = {
    [classes[choices.text]]: 100 * Math.exp(choices.logprobs.token_logprobs[0]),
  };
  if (allProbs) {
    return { probs, topProb, word: classes[choices.text] };
  }
  return { topProb, word: classes[choices.text] };
}
