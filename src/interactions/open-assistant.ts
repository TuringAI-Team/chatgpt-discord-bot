import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputStyle,
  TextInputBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { voiceAudio } from "../modules/voice.js";
import ms from "ms";
import { isPremium } from "../modules/premium.js";
import { getUserLang, setUserLang } from "../modules/open-assistant/user.js";
import OpenAssistant from "open-assistant.js";
var oa: OpenAssistant = new OpenAssistant(
  process.env.OA_APIKEY,
  process.env.OA_APIURL
);
import {
  getLocaleDisplayName,
  locales,
  getTranlation,
} from "../modules/open-assistant/langs.js";
import { formatTaskType, submitTask } from "../modules/open-assistant/tasks.js";
import {
  langInteraction,
  taskInteraction,
  initInteraction,
} from "../modules/open-assistant/interactions.js";
import {
  formatLabel,
  getLabel,
  labelText,
  getLabels,
} from "../modules/open-assistant/labels.js";

export default {
  data: {
    customId: "open-assistant",
    description: "Open assistant buttons.",
  },
  async execute(
    interaction,
    client,
    action,
    taskId,
    authorId,
    labelTag,
    labelValue
  ) {
    if (!interaction) return;
    var user = {
      id: interaction.user.id,
      display_name: interaction.user.username,
      auth_method: "discord",
    };
    if (action == "info") {
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
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
            .setCustomId(`open-assistant_tasks_n_${interaction.user.id}`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false),
          new ButtonBuilder()
            .setLabel("Change language")
            .setCustomId(`open-assistant_lang-btn_n_${interaction.user.id}`)
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
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
      await interaction.deferUpdate();
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var translation = await getTranlation(lang);
        await taskInteraction(interaction, lang, user, translation, client);
      }
    }
    if (action == "lang") {
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
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
          )} (${selected})**`
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
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
      await interaction.deferUpdate();

      await langInteraction(interaction);
    }
    if (action == "skip") {
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
      await interaction.deferUpdate();

      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var translation = await getTranlation(lang);
        await oa.rejectTask(taskId, "", user);
        var index = client.tasks.findIndex((x) => x.id == taskId);
        if (index > -1) {
          client.tasks.splice(index, 1);
        }
        await taskInteraction(interaction, lang, user, translation, client);
      }
    }
    if (action == "text-modal") {
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var task = client.tasks.find((x) => x.id == taskId);

        if (!task) {
          await interaction.reply({
            ephemeral: true,
            content: `Task not found, please use skip button to get a new task.`,
          });
          return;
        }
        var translation = await getTranlation(lang);
        const promptInput = new TextInputBuilder()
          .setCustomId("modal-input")
          .setMinLength(10)
          .setLabel(translation[formatTaskType(task.type)].label)
          .setPlaceholder(
            translation[formatTaskType(task.type)].response_placeholder
          )
          .setRequired(true)
          // Paragraph means multiple lines of text.
          .setStyle(TextInputStyle.Paragraph);
        const firstActionRow =
          new ActionRowBuilder<TextInputBuilder>().addComponents(promptInput);
        const modal = new ModalBuilder()
          .setCustomId(`open-assistant_modal-submit_${taskId}`)
          .setTitle(
            translation[formatTaskType(task.type)].instruction
              ? translation[formatTaskType(task.type)].instruction
              : translation[formatTaskType(task.type)].label
          );
        modal.addComponents(firstActionRow);
        await interaction.showModal(modal);
      }
    }
    if (action == "modal-submit") {
      await interaction.deferUpdate();
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await langInteraction(interaction);
      } else {
        var task = client.tasks.find((x) => x.id == taskId);

        if (!task) {
          await interaction.reply({
            ephemeral: true,
            content: `Task not found, please use skip button to get a new task.`,
          });
          return;
        }
        var text = interaction.fields.getTextInputValue("modal-input");
        await submitTask(
          taskId,
          user,
          interaction,
          { text },
          lang,
          task,
          client
        );
      }
    }
    if (action == "label") {
      if (authorId != interaction.user.id) {
        await interaction.reply({
          ephemeral: true,
          content: `${interaction.user}, you can't do this action please use '/open-assistant' to get a task.`,
        });
        return;
      }
      var lang = await getUserLang(interaction.user.id);
      if (!lang) {
        await interaction.deferUpdate();

        await langInteraction(interaction);
      } else {
        var translation = await getTranlation(lang);
        var task = client.tasks.find((x) => x.id == taskId);

        if (!task) {
          await interaction.reply({
            ephemeral: true,
            content: `Task not found, please use skip button to get a new task.`,
          });
          return;
        }
        await interaction.deferUpdate();
        var embeds = [];
        var infoEmbed = new EmbedBuilder()
          .setColor("#3a82f7")
          .setTimestamp()
          .setThumbnail("https://open-assistant.io/images/logos/logo.png")
          .setFooter({ text: `${getLocaleDisplayName(lang)}` })
          .setTitle(`${translation[formatTaskType(task.type)].label}`)
          .setDescription(`${translation[formatTaskType(task.type)].overview}`);
        embeds.push(infoEmbed);
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
        if (labelTag == "submit") {
          var solutions: any = {
            text: "",
            labels: {},
          };
          task.labels.forEach((x) => {
            if (x) {
              solutions.labels[x.name] = parseFloat(x.value);
            }
          });
          console.log(solutions);
          await submitTask(
            taskId,
            user,
            interaction,
            solutions,
            lang,
            task,
            client
          );
          return;
        }
        var label = await getLabel(translation, labelTag, task);
        const row = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        var rows = [];
        if (labelTag) {
          labelTag = labelTag.replaceAll("-", "_");
          if (
            !task.labels.find((x) => x.name == labelTag).value &&
            labelValue != "skip"
          ) {
            task.labels.find((x) => x.name == labelTag).value =
              formatLabel(labelValue);
            console.log(formatLabel(labelValue));
          }
        }
        if (!label) {
          var labels = await getLabels(task);
          var readyEmbed = new EmbedBuilder()
            .setColor("#3a82f7")
            .setTimestamp()
            .setFooter({ text: `${getLocaleDisplayName(lang)}` })
            .setTitle(`Are you sure?`)
            .addFields(
              task.labels.map((x) => {
                if (x) {
                  var value = x.value;
                  var label = labels.find((y) => y.name == x.name);
                  if (label.type == "yes/no") {
                    value = value == 1 ? "Yes" : "No";
                  } else {
                    value = `${value * 100}%`;
                  }
                  var name = x.name.replaceAll("_", "");
                  var labelTxt = labelText(label, translation);
                  if (labelTxt.question) {
                    name = labelTxt.question.replaceAll(
                      "{{language}}",
                      getLocaleDisplayName(lang)
                    );
                  }
                  if (labelTxt.max) {
                    name = `${labelTxt.min}/${labelTxt.max}`;
                  }

                  return {
                    name: `${name}`,
                    value: `${value}`,
                    inline: true,
                  };
                }
              })
            );
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${interaction.user.id}_submit`
              )
              .setLabel(`Submit`)
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${interaction.user.id}`
              )
              .setLabel(`Modify one`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_skip_${task.id}_${interaction.user.id}`
              )
              .setLabel(`${translation.skip} task`)
              .setStyle(ButtonStyle.Danger)
          );
          await interaction.editReply({
            embeds: [readyEmbed],
            components: [row],
          });
          return;
        }

        if (label.type == "yes/no") {
          var embed = new EmbedBuilder()
            .setColor("#3a82f7")
            .setTimestamp()
            .setFooter({ text: `${getLocaleDisplayName(lang)}` })
            .setTitle(
              `${label.question.replaceAll(
                "{{language}}",
                getLocaleDisplayName(lang)
              )}`
            );
          if (label.description) {
            embed.setDescription(`${label.description}`);
          }
          embeds.push(embed);
          row2.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_yes`
              )
              .setLabel(`✔`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_no`
              )
              .setLabel(`❌`)
              .setStyle(ButtonStyle.Secondary)
          );
        } else if (label.type == "number") {
          var embed = new EmbedBuilder()
            .setColor("#3a82f7")
            .setTimestamp()
            .setFooter({ text: `${getLocaleDisplayName(lang)}` })
            .setTitle(`${label.min}/${label.max}`);
          if (label.description) {
            embed.setDescription(`${label.description}`);
          }
          embeds.push(embed);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_1`
              )
              .setLabel(`1(${label.min})`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_2`
              )
              .setLabel(`2`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_3`
              )
              .setLabel(`3`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_4`
              )
              .setLabel(`4`)
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${taskId}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_5`
              )
              .setLabel(`5(${label.max})`)
              .setStyle(ButtonStyle.Secondary)
          );
          rows.push(row);
        } else if (label.type == "flag") {
          var flags = await getLabels(task);
        }
        if (labelTag || task.labels.find((x) => x.name == "spam").value) {
          row2.addComponents(
            new ButtonBuilder()
              .setCustomId(
                `open-assistant_label_${task.id}_${
                  interaction.user.id
                }_${label.name.replaceAll("_", "-")}_skip`
              )
              .setLabel(`${translation.skip} label`)
              .setStyle(ButtonStyle.Danger)
          );
        }
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(
              `open-assistant_skip_${task.id}_${interaction.user.id}`
            )
            .setLabel(`${translation.skip} task`)
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setLabel("Change language")
            .setCustomId(`open-assistant_lang-btn_n_${interaction.user.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(false)
        );

        rows.push(row2);
        await interaction.editReply({
          embeds: embeds,
          components: rows,
        });
      }
    }
  },
};
