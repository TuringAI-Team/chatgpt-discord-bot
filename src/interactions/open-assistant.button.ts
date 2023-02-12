import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputStyle,
  TextInputBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { voiceAudio } from "../modules/voice.js";
import ms from "ms";
import { isPremium } from "../modules/premium.js";
import {
  getTask,
  getUserLang,
  initPrompt,
  rejectTask,
  setUserLang,
} from "../modules/open-assistant.js";
import data from "../modules/tasks.js";
import message from "src/events/message.js";

export default {
  data: {
    customId: "open-assistant",
    description: "Open assistant buttons.",
  },
  async execute(interaction, client, action, taskId) {
    console.log(action);
    if (action == "info") {
      var embed = new EmbedBuilder()
        .setColor("#3a82f7")
        .setTimestamp()
        .setTitle("Open assistant Info")
        .setDescription(
          `Open Assistant is a project organized by LAION and is aimed to be the next ChatGPT but open source making it public of everyone. Now is creating the dataset that you can help to create with this bot. \n\n
          **How it works?**\nClick the button "Grab a task" the first time you click it would ask you to know the language you want to use after that it would show a task you can solve in order to contribute to the dataset. If you don't know what you have to do in that task it would be explained in a short way in the top and you can click the button "what i have to do" to get more information, once you have completed the task you submit it.`
        )
        .setURL("https://open-assistant.io/?ref=turing")
        .setThumbnail("https://open-assistant.io/images/logos/logo.svg");
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("Grab a task")
          .setCustomId("open-assistant_tasks")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await interaction.update({
        embeds: [embed],
        components: [row],
      });
    }
    if (action == "tasks") {
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        await interaction.deferUpdate();
        await taskInteraction(interaction, lang);
      }
    }
    if (action == "lang") {
      var selected = interaction.values[0];
      await interaction.deferUpdate();
      console.log(selected);
      await setUserLang(interaction.user.id, selected);
      interaction.editReply({
        content: `Language changed to **${getLocaleDisplayName(
          selected
        )}(${selected})**`,
      });
    }
    if (action == "skip") {
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        // await rejectTask(taskId, lang);
        await interaction.deferUpdate();
        await taskInteraction(interaction, lang);
      }
    }
    if (action == "initial-prompt") {
      const promptInput = new TextInputBuilder()
        .setCustomId("initial-prompt-input")
        .setMinLength(10)
        .setLabel("Prompt:")
        .setPlaceholder("Write your prompt here...")
        .setRequired(true)
        // Paragraph means multiple lines of text.
        .setStyle(TextInputStyle.Paragraph);
      const firstActionRow =
        new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput);
      const modal = new ModalBuilder()
        .setCustomId(`open-assistant_initial-prompt-submit_${taskId}`)
        .setTitle("Provide the initial prompts");
      modal.addComponents(firstActionRow);
      await interaction.showModal(modal);
    }
    if (action == "initial-prompt-submit") {
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var text = interaction.fields.getTextInputValue("initial-prompt-input");
        await initPrompt(taskId, lang, text);
        await interaction.deferUpdate();
        await taskInteraction(interaction, lang);
      }
    }
  },
};

async function taskInteraction(interaction, lang) {
  var task = await getTask(lang);
  console.log(task);
  var embeds = [];
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTimestamp()
    .setTitle(`${data[formatTaskType(task.type)].label}`)
    .setDescription(`${data[formatTaskType(task.type)].overview}`);
  var rows = [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`open-assistant_skip_${task.id}`)
      .setLabel("Skip")
      .setStyle(ButtonStyle.Danger)
  );
  if (task.type == "initial_prompt") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`open-assistant_initial-prompt_${task.id}`)
        .setLabel("Initial prompt")
        .setStyle(ButtonStyle.Primary)
    );
    embeds.push(embed);
  } else {
    embeds.push(embed);
    task.conversation.messages.forEach((x) => {
      var username = "User:";
      if (x.is_assistant) username = "AI:";
      var emb = new EmbedBuilder()
        .setColor("#3a82f7")
        .setTitle(username)
        .setDescription(x.text)
        .setFooter({ text: x.frontend_message_id });
      embeds.push(emb);
    });
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`open-assistant_reply_${task.id}`)
        .setLabel("Reply")
        .setStyle(ButtonStyle.Primary)
    );
  }
  rows.push(row);
  await interaction.editReply({
    components: rows,
    embeds: embeds,
  });
}

function formatTaskType(type: string) {
  if (type == "assistant_reply") {
    return "reply_as_assistant";
  } else if ((type = "user_reply")) {
    return "reply_as_user";
  } else if (type == "initial_prompt") {
    return "create_initial_prompt";
  } else {
    return type;
  }
}

async function langInteraction(interaction) {
  var arr: { value: string; label: string }[] = locales.map((x) => {
    return {
      value: x,
      label: getLocaleDisplayName(x),
    };
  });
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTitle("Select the lang.")
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("open-assistant_lang")
      .setPlaceholder("Nothing selected")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(arr)
  );
  await interaction.update({
    embeds: [embed],
    components: [row],
  });
}

var locales = [
  "ar",
  "bn",
  "ca",
  "da",
  "de",
  "en",
  "es",
  "eu",
  "fa",
  "fr",
  "gl",
  "hu",
  "it",
  "ja",
  "ko",
  "pl",
  "pt-BR",
  "ru",
  "uk-UA",
  "vi",
  "zh",
  "th",
  "tr",
  "id",
];
const missingDisplayNamesForLocales = {
  eu: "Euskara",
  gl: "Galego",
};

/**
 * Returns the locale's name.
 */
export const getLocaleDisplayName = (
  locale: string,
  displayLocale = undefined
) => {
  // Intl defaults to English for locales that are not oficially translated
  if (missingDisplayNamesForLocales[locale]) {
    return missingDisplayNamesForLocales[locale];
  }
  const displayName = new Intl.DisplayNames([displayLocale || locale], {
    type: "language",
  }).of(locale);
  // Return the Titlecased version of the language name.
  return displayName.charAt(0).toLocaleUpperCase() + displayName.slice(1);
};
