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
import { isPremium } from "../modules/premium.js";
var maintenance = false;
import { ImagineInteraction } from "../modules/stablehorde.js";
import delay from "delay";
import {
  checkInCache,
  saveInCache,
  addUsesInCache,
} from "../modules/cache-responses.js";

export default {
  cooldown: "150s",
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
          //  { name: "Alan(gpt-4)", value: "alan" },
          { name: "ChatGPT(gpt-3.5)", value: "chatgpt" },
          //{ name: "Clyde(gpt-3.5)", value: "clyde" },
          //{ name: "DAN(gpt-3.5)", value: "dan" },
          { name: "GPT-4(Premium only)", value: "gpt4" },
          { name: "GPT-3", value: "gpt3" },
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
    if ((!ispremium && model == "gpt4") || (!ispremium && model == "alan")) {
      /*
      await commandType.reply(interaction, {
        content: `For using this model you need to be a premium user or vote for us on [top.gg](https://top.gg/bot/1053015370115588147/vote) for free. To get premium use the command \`/premium buy\``,
        ephemeral: true,
      });
      return;*/
      await commandType.reply(interaction, {
        content: `For using this model you need to be a **premium user**. To get premium use the command \`/premium buy\``,
        ephemeral: true,
      });
      return;
    }

    if (!ispremium && model == "gpt3" && !hasVoted) {
      await commandType.reply(interaction, {
        content: `For using this model you need to be a **premium user** or **vote for us** on [top.gg](https://top.gg/bot/1053015370115588147/vote) **for free**. To get premium use the command \`/premium buy\``,
        ephemeral: true,
      });
      return;
    }
    if (attachment && model == "gpt3") {
      await commandType.reply(interaction, {
        content: "This feature(image) is not available for this model",
        ephemeral: true,
      });
      return;
    }
    let channel = interaction.channel;
    if (!interaction.channel) channel = interaction.user;
    if (
      model == "gpt3" ||
      model == "oasst-sft-1-pythia-12b" ||
      model == "gpt4" ||
      model == "OpenAssistant"
    ) {
      // change default timeout to 30s using supabasejs here u have official docs:

      let results: any = await checkInCache(message, model);
      if (!results) {
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
        (results && results.text && !ispremium && !attachment) ||
        (results && results.text && !attachment && model == "gpt4")
      ) {
        result = {
          text: results.text,
          type: model == "oasst-sft-1-pythia-12b" ? "OpenAssistant" : model,
        };

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
    if (
      model == "chatgpt" ||
      model == "dan" ||
      model == "clyde" ||
      model == "alan"
    ) {
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
      await sendAnswer(
        interaction,
        cached,
        model,
        response,
        message,
        result,
        channel,
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
async function checkDB(message, model, tries) {
  let { data: results, error } = await supabase
    .from("results")
    .select("*")

    // Filters
    .eq("provider", model)
    .textSearch("prompt", `${message.toLowerCase().split(" ").join(`' & `)}}`);

  if (error && error.code == "57014" && tries < 3) {
    await delay(10000);
    return await checkDB(message, model, tries + 1);
  } else if (error && error.code == "57014" && tries >= 3) {
    return { results: [], error };
  }
  if (results) {
    results = results.filter((r) => r.prompt == message.toLowerCase());
  }

  return { results, error };
}
async function sendAnswer(
  interaction,
  cached,
  model,
  response,
  message,
  result,
  channel,
  commandType,
  attachment,
  client
) {
  if (cached == false) {
    await saveInCache(message, response, model);
    const { data, error } = await supabase.from("results").insert([
      {
        provider: model,
        prompt: message.toLowerCase(),
        result: { text: response },
        guildId: interaction.guildId,
      },
    ]);
    // console.log(error);
  } else {
    await addUsesInCache(message, model);
  }

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
}
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
  /*
  if (image) {
    var files = [
      {
        attachment: image.url,
        name: "image.png",
      },
    ];
  }*/
  if (result.includes("GEN_IMG=")) {
    var imgPrompt = result.split("GEN_IMG=")[1];
    await ImagineInteraction(interaction, client, "auto", imgPrompt);
    return;
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
    commandType.reply(interaction, {
      content: completeResponse,
      components: rows,
      //files: files,
    });
  }
}
