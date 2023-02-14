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
      await interaction.deferUpdate();
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var translation = await getTranlation(lang);
        var embed = new EmbedBuilder()
          .setColor("#3a82f7")
          .setTimestamp()
          .setTitle("Open assistant Info")
          .setDescription(
            `Open Assistant is a project organized by LAION and is aimed to be the next ChatGPT but open source making it public of everyone. Now is creating the dataset that you can help to create with this bot. \n\n
          **How it works?**\nClick the button "Grab a task" the first time you click it would ask you to know the language you want to use after that it would show a task you can solve in order to contribute to the dataset. If you don't know what you have to do in that task it would be explained in a short way in the top and you can click the button "what i have to do" to get more information, once you have completed the task you submit it.`
          )
          .setURL("https://open-assistant.io/?ref=turing")
          .setFooter({ text: `${getLocaleDisplayName(lang)}` })
          .setThumbnail("https://open-assistant.io/images/logos/logo.png");
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(translation.grab_a_task)
            .setCustomId("open-assistant_tasks")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false),
          new ButtonBuilder()
            .setLabel("Change language")
            .setCustomId("open-assistant_lang-btn")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false)
        );
        await interaction.editReply({
          embeds: [embed],
          components: [row],
        });
      }
    }
    if (action == "tasks") {
      await interaction.deferUpdate();
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var translation = await getTranlation(lang);
        await taskInteraction(interaction, lang, user, translation);
      }
    }
    if (action == "lang") {
      var selected = interaction.values[0];
      await interaction.deferUpdate();
      await setUserLang(interaction.user.id, selected);
      var translation = await getTranlation(selected);
      var successEmbed = new EmbedBuilder()
        .setColor(`#51F73A`)
        .setTimestamp()
        .setDescription(
          `Language changed to **${getLocaleDisplayName(
            selected
          )}(${selected})**`
        )
        .setURL("https://open-assistant.io/?ref=turing");
      interaction.editReply({
        embeds: [successEmbed],
        components: [],
      });
      setTimeout(async () => {
        await initInteraction(interaction, translation, selected);
      }, 3000);
    }
    if (action == "lang-btn") {
      await interaction.deferUpdate();

      await langInteraction(interaction);
    }
    if (action == "skip") {
      await interaction.deferUpdate();

      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        await oa.rejectTask(taskId, "", user);
        // await rejectTask(taskId, lang);
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
      await interaction.deferUpdate();
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var task = {
          id: taskId,
          type: "initial_prompt",
        };
        var text = interaction.fields.getTextInputValue("initial-prompt-input");
        var messageId = await oa.acceptTask(taskId, user, interaction.id);
        var solveTask = await oa.solveTask(
          task,
          user,
          lang,
          { text: text },
          messageId
        );
        var successEmbed = new EmbedBuilder()
          .setColor(`${solveTask.type == "task_done" ? "#51F73A" : "#F73A3A"}`)
          .setTimestamp()
          .setDescription(
            `${
              solveTask.type == "task_done"
                ? "Task done"
                : "Something went wrong"
            }(loading new task...)`
          )
          .setURL("https://open-assistant.io/?ref=turing")
          .setFooter({ text: `${getLocaleDisplayName(lang)}` });
        await interaction.editReply({
          embeds: [successEmbed],
          components: [],
        });
        setTimeout(async () => {
          var translation = await getTranlation(lang);
          await taskInteraction(interaction, lang, user, translation);
        }, 3000);
      }
    }
  },
};

export async function getTranlation(lang: string) {
  var res = await fetch(
    `https://open-assistant.io/locales/${lang}/common.json`
  );
  var json = await res.json();
  var res2 = await fetch(
    `https://open-assistant.io/locales/${lang}/tasks.json`
  );
  var json2 = await res2.json();
  var res3 = await fetch(
    `https://open-assistant.io/locales/${lang}/dashboard.json`
  );
  var json3 = await res3.json();
  var res4 = await fetch(
    `https://open-assistant.io/locales/${lang}/leaderboard.json`
  );
  var json4 = await res4.json();
  var res5 = await fetch(
    `https://open-assistant.io/locales/${lang}/labelling.json`
  );
  var json5 = await res5.json();
  var res6 = await fetch(
    `https://open-assistant.io/locales/${lang}/message.json`
  );
  var json6 = await res6.json();
  var translationObject = {
    ...json,
    ...json2,
    ...json3,
    ...json4,
    ...json5,
    ...json6,
  };
  return translationObject;
}

async function taskInteraction(interaction, lang, user, translation) {
  var ispremium = await isPremium(interaction.user.id, interaction.guildId);
  if (!ispremium) {
    await interaction.editReply({
      ephemeral: true,
      content: `This feature is only for premium users.`,
    });
    return;
  }
  console.log(await oa.getAvailability(user, lang));

  var task = await oa.getTask({
    type: "random",
    user: user,
    collective: false,
    lang: lang,
  });
  console.log(task);
  if (task.message) {
    var embd = await sendErr(task.message);
    await interaction.editReply({
      embeds: [embd],
      components: [],
    });
    return;
  }
  var embeds = [];
  var embed = new EmbedBuilder()
    .setColor("#3a82f7")
    .setTimestamp()
    .setThumbnail("https://open-assistant.io/images/logos/logo.png")
    .setFooter({ text: `${getLocaleDisplayName(lang)}` })
    .setTitle(`${translation[formatTaskType(task.type)].label}`)
    .setDescription(`${translation[formatTaskType(task.type)].overview}`);
  var rows = [];
  const row = new ActionRowBuilder();

  if (task.type == "initial_prompt") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`open-assistant_initial-prompt_${task.id}`)
        .setLabel(`${translation[formatTaskType(task.type)].label}`)
        .setStyle(ButtonStyle.Primary)
    );
    embeds.push(embed);
  } else {
    embeds.push(embed);
    task.conversation.messages.forEach((x, i) => {
      var username = "User";
      if (x.is_assistant) username = "AI";

      var emb = new EmbedBuilder()
        .setAuthor({
          iconURL: `${
            username == "User"
              ? "https://open-assistant.io/images/temp-avatars/av1.jpg"
              : "https://open-assistant.io/images/logos/logo.png"
          }`,
          name: username,
        })
        .setDescription(x.text)
        .setFooter({ text: x.frontend_message_id });
      if (i == task.conversation.messages.length - 1) {
        emb.setColor("#3a82f7");
      }
      embeds.push(emb);
    });
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`open-assistant_reply_${task.id}`)
        .setLabel("Reply")
        .setStyle(ButtonStyle.Primary)
    );
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`open-assistant_skip_${task.id}`)
      .setLabel(`${translation.skip}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel("Change language")
      .setCustomId("open-assistant_lang-btn")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false)
  );
  rows.push(row);
  await interaction.editReply({
    components: rows,
    embeds: embeds,
  });
}

async function sendErr(err: string) {
  var embed = new EmbedBuilder()
    .setColor("#F73A3A")
    .setDescription(err)
    .setTimestamp();
  return embed;
}

function formatTaskType(type: string) {
  if (type == "assistant_reply") {
    return "reply_as_assistant";
  } else if (type == "user_reply") {
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
    .setThumbnail("https://open-assistant.io/images/logos/logo.png")
    .setTitle("Select the lang.")
    .setDescription(
      `By selecting a language you accept our [tos](https://open-assistant.io/terms-of-service)`
    );
  //   .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("open-assistant_lang")
      .setPlaceholder("Nothing selected")
      .setMinValues(1)
      .setMaxValues(1)
      .setOptions(arr)
  );
  await interaction.editReply({
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
    .setThumbnail("https://open-assistant.io/images/logos/logo.png");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel(translation.about)
      .setCustomId("open-assistant_info")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel(translation.grab_a_task)
      .setCustomId("open-assistant_tasks")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(false),
    new ButtonBuilder()
      .setLabel("Change language")
      .setCustomId("open-assistant_lang-btn")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false)
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
