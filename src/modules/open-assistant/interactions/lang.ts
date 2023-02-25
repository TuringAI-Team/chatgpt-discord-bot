import {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import OpenAssistant from "open-assistant.js";
import { getLocaleDisplayName, locales } from "../langs.js";
import { formatTaskType } from "../tasks.js";
var oa: OpenAssistant = new OpenAssistant(
  process.env.OA_APIKEY,
  process.env.OA_APIURL
);
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
