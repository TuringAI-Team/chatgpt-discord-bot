import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { useToken } from "../modules/loadbalancer.js";
import chatSonic from "../modules/sonic.js";
import { isPremium } from "../modules/premium.js";
var maintenance = false;

export default {
  cooldown: "2m",
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
          { name: "GPT-3", value: "gpt-3" },
          { name: "Codex(GPT-3 for coding)", value: "code-davinci-002" },
          { name: "ChatGPT(gpt-3.5)(down)", value: "chatgpt" },
          { name: "ChatSonic(premium only)", value: "chatsonic" }
        )
    ),
  /*
    .addStringOption((option) =>
      option
        .setName("cache")
        .setDescription(
          "Select if you want to generate a totally new response or not.(premium only)"
        )
        .setRequired(false)
        .addChoices(
          { name: "enabled", value: "true" },
          {
            name: "disabled",
            value: "false",
          }
        )
    )*/ async execute(interaction, client, commands, commandType, options) {
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
    if (!interaction.options) {
      message = options.message;
      model = options.model;
    } else {
      message = interaction.options.getString("message");
      model = interaction.options.getString("model");
    }

    var result;
    var cached = false;
    var ispremium = await isPremium(interaction.user.id);

    if (model == "gpt-3") {
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", "gpt-3");
      if (!results || error) {
        var errr = "Error connecting with db";

        await responseWithText(
          interaction,
          message,
          errr,
          channel,
          "error",
          commandType
        );
        return;
      }
      if (results[0] && results[0].result.text) {
        result = { text: results[0].result.text, type: "gpt-3" };
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
          "gpt-3",
          `${interaction.user.id}-gpt-3`
        );
      }
    }
    if (model == "code-davinci-002") {
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", "code-davinci-002");
      if (!results || error) {
        var errr = "Error connecting with db";

        await responseWithText(
          interaction,
          message,
          errr,
          channel,
          "error",
          commandType
        );
        return;
      }
      if (results[0] && results[0].result.text) {
        result = { text: results[0].result.text, type: "code-davinci-002" };
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
          "code-davinci-002",
          `${interaction.user.id}-code-davinci-002`
        );
      }
    }
    if (model == "chatgpt") {
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", "chatgpt");
      if (!results || error) {
        var errr = "Error connecting with db";

        await responseWithText(
          interaction,
          message,
          errr,
          channel,
          "error",
          commandType
        );
        return;
      }
      if (results[0] && results[0].result.text && !ispremium) {
        result = { text: results[0].result.text, type: "chatgpt" };
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
          "chatgpt",
          `chat-${interaction.user.id}`
        );
      }
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
          commandType
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
        commandType
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

      await responseWithText(
        interaction,
        message,
        response,
        channel,
        result.type,
        commandType
      );
    } else {
      await responseWithText(
        interaction,
        message,
        result.error,
        channel,
        "error",
        commandType
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
  commandType
) {
  var completeResponse = `**${interaction.user.tag}:** ${prompt}\n**AI(${type}):** ${result}`;
  var charsCount = completeResponse.split("").length;
  if (charsCount / 2000 >= 1) {
    var loops = Math.ceil(charsCount / 2000);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          commandType.reply(
            interaction,
            completeResponse.split("").slice(0, 2000).join("")
          );
        } catch (err) {
          console.log(err);
        }
      } else {
        channel.send(
          completeResponse
            .split("")
            .slice(2000 * i, 2000 * i + 2000)
            .join("")
        );
      }
    }
  } else {
    commandType.reply(interaction, completeResponse);
  }
}
