import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat, conversationFn } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { renderResponse } from "../modules/render-response.js";
import { v4 as uuidv4 } from "uuid";
import { useToken, getAbleTokens } from "../modules/loadbalancer.js";
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
        .setName("conversation")
        .setDescription(
          "Select if you want to preserver context from the previous messages"
        )
        .setRequired(false)
        .addChoices(
          { name: "Conversation(Beta)", value: "true" },
          { name: "Isolated message", value: "false" }
        )
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
    var conversationMode = interaction.options.getString("conversation");

    if (!responseType) {
      responseType = "text";
    }
    if (!conversationMode) conversationMode = false;
    if (conversationMode == "true") conversationMode = true;
    if (conversationMode == "false") conversationMode = false;
    var shard = client.shard.client.options.shards[0] + 1;

    await interaction.deferReply();

    var result;
    if (conversationMode == false) {
      let { data: results, error } = await supabase
        .from("results")
        .select("*")

        // Filters
        .eq("prompt", message.toLowerCase())
        .eq("provider", "chatgpt");
      console.log(error);
      if (!results) {
        if (responseType == "image") {
          var errr = "Error connecting with db";
          await responseWithImage(interaction, message, errr, "error");
        } else {
          await responseWithText(interaction, message, errr, channel, "error");
        }
      }
      if (results[0] && results[0].result.text) {
        var type = "gpt-3.5";
        if (results[0].version) {
          type = results[0].version;
        }
        result = { text: results[0].result.text, type: type };
        const { data, error } = await supabase
          .from("results")
          .update({ uses: results[0].uses + 1 })
          .eq("id", results[0].id);
      } else {
        result = await chat(message, shard);
      }
    } else {
      let { data: conversations, error } = await supabase
        .from("conversations")
        .select("*")

        // Filters
        .eq("userId", interaction.user.id);
      var conversation: any = {};
      if (conversations && conversations[0]) conversation = conversations[0];
      if (!conversation || !conversation.id || conversations.length < 0) {
        var ableTokens = await getAbleTokens();
        if (ableTokens <= 11) {
          await interaction.editReply(
            `Conversations are at their capacity limit please try using isolated messages mode or wait until other users finish their conversations.`
          );
          return;
        }
        var token = await useToken(0, shard);
        if (!token) {
          await interaction.editReply(
            `Conversations are at their capacity limit please try using isolated messages mode or wait until other users finish their conversations.`
          );
          return;
        }
        if (token.error) {
          await interaction.editReply(
            `Conversations are at their capacity limit please try using isolated messages mode or wait until other users finish their conversations.`
          );
          return;
        }
        var id = uuidv4();

        const { data, error } = await supabase.from("conversations").insert([
          {
            id: id,
            account: token.id,
            lastMessage: Date.now(),
            userId: interaction.user.id,
          },
        ]);

        if (!error) {
          conversation.id = id;
          conversation.account = token.id;
        }
      }
      if (!conversation.id) {
        await interaction.editReply(
          `Conversations are at their capacity limit please try using isolated messages mode or wait until other users finish their conversations.`
        );
        return;
      }
      result = await conversationFn(
        message,
        conversation.id,
        conversation.account
      );
      const { data } = await supabase
        .from("conversations")
        .update({ lastMessage: Date.now() })
        .eq("userId", interaction.user.id);
    }

    if (!result) {
      if (responseType == "image") {
        await responseWithImage(
          interaction,
          message,
          `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
          "error"
        );
      } else {
        await responseWithText(
          interaction,
          message,
          `Something wrong happened, please wait we are solving this issue [dsc.gg/turing](https://dsc.gg/turing)`,
          channel,
          "error"
        );
      }
      return;
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
