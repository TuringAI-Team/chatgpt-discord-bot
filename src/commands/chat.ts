import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { useToken } from "../modules/loadbalancer.js";
import chatSonic from "../modules/sonic.js";
import { isPremium } from "../modules/premium.js";
var maintenance = false;
import { ImagineInteraction } from "../modules/stablehorde.js";

export default {
  cooldown: "2m",
  disablePing: null,
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with an AI")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for the AI")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("model")
        .setDescription("The model you want to use for the AI.")
        .setRequired(true)
        .addChoices(
          { name: "ChatGPT(gpt-3.5)", value: "chatgpt" },
          { name: "Clyde(gpt-3.5)", value: "clyde" },
          //{ name: "DAN(gpt-3.5)", value: "dan" },
          { name: "GPT-4", value: "gpt-4" },
          { name: "GPT-3", value: "gpt-3" },
          {
            name: "Open Assistant(oasst-sft-1-pythia-12b)",
            value: "oasst-sft-1-pythia-12b",
          }
        )
    )
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image option for chat with the bot")
        .setRequired(false)
    ),
  async execute(interaction, client, commands, commandType, options) {
    await commandType.load(interaction);
    if (maintenance == true && interaction.user.id != "530102778408861706") {
      await commandType.reply(
        interaction,
        "Service under maintenance, for more information join us on [dsc.gg/turing](https://dsc.gg/turing)"
      );
      return;
    }
    var message;
    var model;
    var hasVoted = false;
    var attachment;

    if (!interaction.options) {
      message = options.message;
      model = options.model;
      hasVoted = options.hasVoted;
      attachment = options.attachment;
    } else {
      message = interaction.options.getString("message");
      attachment = interaction.options.getAttachment("image");
      if (
        message.includes("@everyone") ||
        message.includes("<@") ||
        message.includes("@here")
      ) {
        return;
      }
      model = interaction.options.getString("model");
      hasVoted = interaction.user.hasVoted;
    }

    var result;
    var cached = false;
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    var ispremium = await isPremium(interaction.user.id, guildId);
    /*if (attachment && !ispremium) {
      await commandType.reply(interaction, {
        content:
          "This feature(image) is premium only, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }*/
    if (!ispremium && model == "gpt-4" && !hasVoted) {
      await commandType.reply(interaction, {
        content: `For using this model you need to be a premium user or vote for us on [top.gg](https://top.gg/bot/852791525517404200/vote) . To get premium use the command \`/premium buy\``,
        ephemeral: true,
      });
      return;
    }
    if (attachment && model == "gpt-3") {
      await commandType.reply(interaction, {
        content: "This feature(image) is not available for this model",
        ephemeral: true,
      });
      return;
    }
    if (
      model == "gpt-3" ||
      model == "oasst-sft-1-pythia-12b" ||
      model == "gpt-4" ||
      model == "OpenAssistant"
    ) {
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", model);
      if (!results || error) {
        console.log(error, results);
        var errr = "Error connecting with db";

        await responseWithText(
          interaction,
          message,
          errr,
          channel,
          "error",
          commandType,
          null,
          client
        );
        return;
      }
      if (
        (results[0] && results[0].result.text && !ispremium) ||
        (model != "gpt-4" &&
          results[0] &&
          results[0].result.text &&
          !attachment)
      ) {
        result = {
          text: results[0].result.text,
          type: model == "oasst-sft-1-pythia-12b" ? "OpenAssistant" : model,
        };
        const { data, error } = await supabase
          .from("results")
          .update({ uses: results[0].uses + 1 })
          .eq("id", results[0].id);
        cached = true;
      } else {
        result = await chat(
          message,
          interaction.user.username,
          ispremium,
          model,
          `${model}-${interaction.user.id}`,
          0,
          attachment,
          interaction
        );
      }
    }
    if (model == "chatgpt" || model == "dan" || model == "clyde") {
      result = await chat(
        message,
        interaction.user.username,
        ispremium,
        model,
        `${model}-${interaction.user.id}`,
        0,
        attachment,
        interaction
      );
      // }
    }
    if (model == "chatsonic") {
      if (!ispremium) {
        await commandType.reply(interaction, {
          ephemeral: true,
          content:
            `This model is only for premium users. If you want to donate use the command ` +
            "`/premium buy` .",
        });
        return;
      }
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", "chatsonic");
      if (!results || error) {
        var errr = "Error connecting with db";

        await responseWithText(
          interaction,
          message,
          errr,
          channel,
          "error",
          commandType,
          attachment,
          client
        );
        return;
      }
      if (results[0] && results[0].result.text) {
        result = { text: results[0].result.text, type: "chatsonic" };
        const { data, error } = await supabase
          .from("results")
          .update({ uses: results[0].uses + 1 })
          .eq("id", results[0].id);
        cached = true;
      } else {
        result = await chatSonic(message);
      }
    }
    if (!result) {
      await responseWithText(
        interaction,
        message,
        `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
        channel,
        "error",
        commandType,
        null,
        client
      );
      return;
    }
    if (!result.error) {
      var response = result.text;
      if (cached == false) {
        const { data, error } = await supabase.from("results").insert([
          {
            provider: model,
            prompt: message.toLowerCase(),
            result: { text: response },
            guildId: interaction.guildId,
          },
        ]);
        // console.log(error);
      }
      var channel = interaction.channel;
      if (!interaction.channel) channel = interaction.user;
      // change user default model to selected model

      await responseWithText(
        interaction,
        message,
        response,
        channel,
        result.type,
        commandType,
        attachment,
        client
      );
      const { data, error } = await supabase
        .from("users")
        .update({ defaultChatModel: result.type })
        .eq("id", interaction.user.id);
    } else {
      await responseWithText(
        interaction,
        message,
        result.error,
        channel,
        "error",
        commandType,
        null,
        client
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
  image,
  client
) {
  prompt = prompt
    .replaceAll("@everyone", "everyone")
    .replaceAll("@here", "here")
    .replaceAll("<@", "@");

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
  if (image) {
    var files = [
      {
        attachment: image.url,
        name: "image.png",
      },
    ];
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
            components: rows,
            files: files,
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
      components: rows,
      files: files,
    });
  }
}
