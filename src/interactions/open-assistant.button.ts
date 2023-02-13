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
import { getUserLang, setUserLang } from "../modules/open-assistant.js";
import OpenAssistant from "open-assistant.js";
var oa: OpenAssistant = new OpenAssistant(
  process.env.OA_APIKEY,
  process.env.OA_APIURL
);

export default {
  data: {
    customId: "open-assistant",
    description: "Open assistant buttons.",
  },
  async execute(interaction, client, action, taskId) {
    var user = {
      id: interaction.user.id,
      display_name: interaction.user.username,
      auth_method: "discord",
    };
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
          .setStyle(ButtonStyle.Primary)
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
        var translation = await getTranlation(lang);
        await taskInteraction(interaction, lang, user, translation);
      }
    }
    if (action == "lang") {
      var selected = interaction.values[0];
      await interaction.deferUpdate();
      await setUserLang(interaction.user.id, selected);
      var translation = await getTranlation(selected);
      await initInteraction(interaction, translation, selected);
      interaction.editReply({
        content: `Language changed to **${getLocaleDisplayName(
          selected
        )}(${selected})**`,
      });
    }
    if (action == "lang-btn") {
      await langInteraction(interaction);
    }
    if (action == "skip") {
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        await oa.rejectTask(taskId, "", user);
        // await rejectTask(taskId, lang);
        await interaction.deferUpdate();
        var translation = await getTranlation(lang);

        await taskInteraction(interaction, lang, user, translation);
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
        var task = {
          id: taskId,
          type: "initial_prompt",
        };
        var text = interaction.fields.getTextInputValue("initial-prompt-input");
        var messageId = await oa.acceptTask(taskId, user);
        var solveTask = await oa.solveTask(
          task,
          user,
          lang,
          { text: text },
          messageId
        );

        //   await initPrompt(taskId, lang, text);
        await interaction.deferUpdate();
        var translation = await getTranlation(lang);
        await taskInteraction(interaction, lang, user, translation);
      }
    }
  },
};

export async function getTranlation(lang: string) {
  var res = await fetch(
    `https://open-assistant.io/locales/${lang}/common.json`
  );
  var json = await res.json();
  console.log(json);
  return json;
}

async function taskInteraction(interaction, lang, user, translation) {
  var task = await oa.getTask({
    type: "random",
    user: user,
    collective: false,
    lang: lang,
  });
  console.log(task);
  var embeds = [];
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTimestamp()
    .setFooter({ text: `${getLocaleDisplayName(lang)}` })
    .setTitle(`${translation[formatTaskType(task.type)].label}`)
    .setDescription(`${translation[formatTaskType(task.type)].overview}`);
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

export async function langInteraction(interaction) {
  var arr: { value: string; label: string }[] = locales.map((x) => {
    return {
      value: x,
      label: getLocaleDisplayName(x),
    };
  });
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTitle("Select the lang.");
  //   .setTimestamp();
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
export async function initInteraction(interaction, translation, lang) {
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTimestamp()
    .setFooter({ text: `${getLocaleDisplayName(lang)}` })
    .setTitle("Open assistant")
    .setDescription(`${translation["conversational"]}`)
    .setURL("https://open-assistant.io/?ref=turing")
    .setThumbnail("https://open-assistant.io/images/logos/logo.svg");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("What is this?")
      .setCustomId("open-assistant_info")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Grab a task")
      .setCustomId("open-assistant_tasks")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setLabel("Change language")
      .setCustomId("open-assistant_lang-btn")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)
  );
  await interaction.editReply({
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
