import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import OpenAssistant from "open-assistant.js";
import { getLocaleDisplayName, locales } from "./langs.js";
import { formatTaskType } from "./tasks.js";
var oa: OpenAssistant = new OpenAssistant(
  process.env.OA_APIKEY,
  process.env.OA_APIURL
);

export async function taskInteraction(
  interaction,
  lang,
  user,
  translation,
  client
) {
  /*var ispremium = await isPremium(interaction.user.id, interaction.guildId);
    if (!ispremium) {
      await interaction.editReply({
        ephemeral: true,
        content: `This feature is only for premium users.`,
      });
      return;
    }*/

  var task = await oa.getTask({
    type: "random",
    user: user,
    collective: false,
    lang: lang,
  });
  client.tasks.push(task);
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

  if (
    task.type == "initial_prompt" ||
    task.type == "assistant_reply" ||
    task.type == "prompter_reply"
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          `open-assistant_text-modal_${task.id}_${interaction.user.id}`
        )
        .setLabel(`${translation[formatTaskType(task.type)].label}`)
        .setStyle(ButtonStyle.Primary)
    );
    embeds.push(embed);
    if (task.type == "assistant_reply" || task.type == "prompter_reply") {
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
    }
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`open-assistant_label_${task.id}_${interaction.user.id}`)
        .setLabel(`${translation[formatTaskType(task.type)].label}`)
        .setStyle(ButtonStyle.Primary)
    );
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
  }
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`open-assistant_skip_${task.id}_${interaction.user.id}`)
      .setLabel(`${translation.skip}`)
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setLabel("Change language")
      .setCustomId(`open-assistant_lang-btn_n_${interaction.user.id}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false)
  );
  rows.push(row);
  await interaction.editReply({
    components: rows,
    embeds: embeds,
  });
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
      .setCustomId(`open-assistant_lang_n_${interaction.user.id}`)
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
      .setCustomId(`open-assistant_info_n_${interaction.user.id}`)
      .setStyle(ButtonStyle.Primary),
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

async function sendErr(err: string) {
  var embed = new EmbedBuilder()
    .setColor("#F73A3A")
    .setDescription(err)
    .setTimestamp();
  return embed;
}
