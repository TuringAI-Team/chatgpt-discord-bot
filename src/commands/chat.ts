import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { renderResponse } from "../modules/render-response.js";

export default {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with ChatGPT")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for ChatGPT")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("response")
        .setDescription("The type of resoibse message that you want")
        .setRequired(false)
        .addChoices(
          { name: "image", value: "image" },
          { name: "text", value: "text" }
        )
    ),
  async execute(interaction, client) {
    var message = interaction.options.getString("message");
    var responseType = interaction.options.getString("response");
    if (!responseType) {
      responseType = "text";
    }
    await interaction.reply({
      content: `Loading...\nNow that you are waiting you can join us in [dsc.gg/turing](https://dsc.gg/turing)`,
    });
    var result;
    let { data: results, error } = await supabase
      .from("results")
      .select("*")

      // Filters
      .eq("prompt", message.toLowerCase())
      .eq("provider", "chatgpt");
    if (results[0] && results[0].result.text) {
      var type = "gpt-3.5";
      if (results[0].version) {
        type = results[0].version;
      }
      result = { response: results[0].result.text, type: type };
      const { data, error } = await supabase
        .from("results")
        .update({ uses: results[0].uses + 1 })
        .eq("id", results[0].id);
    } else {
      result = await chat(message);
    }
    if (!result.error) {
      var response = result.text;
      if (result.type == "gpt-3.5") {
        const { data, error } = await supabase.from("results").insert([
          {
            provider: "chatgpt",
            version: result.type,
            prompt: message.toLowerCase(),
            result: { text: response },
            guildId: interaction.guildId,
          },
        ]);
      }

      var channel = interaction.channel;
      if (!interaction.channel) channel = interaction.user;
      if (responseType == "image") {
        await responseWithImage(interaction, message, response, result.type);
      } else {
        await responseWithText(
          interaction,
          message,
          response,
          channel,
          result.type
        );
      }
    } else {
      if (responseType == "image") {
        await responseWithImage(interaction, message, result.error, "error");
      } else {
        await responseWithText(
          interaction,
          message,
          result.error,
          channel,
          "error"
        );
      }
    }
    return;
  },
};

async function responseWithImage(interaction, prompt, result, type) {
  var response = await renderResponse({
    prompt: prompt,
    response: result,
    username: interaction.user.tag,
    userImageUrl: interaction.user.avatarURL(),
    chatgptUsername: `ChatGPT#3799(${type})`,
  });
  var image = new AttachmentBuilder(response, { name: "output.jpg" });
  try {
    await interaction.editReply({
      content: "",
      files: [image],
    });
  } catch (err) {
    console.log(err);
  }
}

async function responseWithText(interaction, prompt, result, channel, type) {
  var completeResponse = `**Human:** ${prompt}\n**ChatGPT(${type}):** ${result}`;
  var charsCount = completeResponse.split("").length;
  if (charsCount / 2000 >= 1) {
    var loops = Math.ceil(charsCount / 2000);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          interaction.editReply(
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
    interaction.editReply(completeResponse);
  }
}
