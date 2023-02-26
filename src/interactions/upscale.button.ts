import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import stable_horde from "../modules/stablehorde.js";
import supabase from "../modules/supabase.js";
import { generateRateRow } from "../modules/stablehorde.js";

export default {
  data: {
    customId: "u",
    description: "Upscale an image",
  },
  async execute(interaction, client, generationId, imageId) {
    await interaction.deferReply();
    var { data, error } = await supabase
      .from("results")
      .select("*")
      .eq("id", generationId);
    if (!data || !data[0]) {
      await interaction.editReply({
        content: `Generation not found`,
        ephemeral: true,
      });
      return;
    }
    var generation = data[0];
    var result = generation.result;
    var image = result.find((x) => x.id == imageId);
    if (!image) {
      await interaction.editReply({
        content: `Image not found`,
        ephemeral: true,
      });
      return;
    }

    const sfbuff = Buffer.from(image.img, "base64");
    var attch = new AttachmentBuilder(sfbuff, { name: "output.png" });
    var embed = new EmbedBuilder()
      .setColor("#347d9c")
      .setTimestamp()
      .setTitle(`Upscaled image`)
      .setImage(`attachment://output.png`);
    var row = await generateRateRow(generationId, interaction.user.id, imageId);

    await interaction.editReply({
      embeds: [embed],
      components: row,
      files: [attch],
      content: `${interaction.user}`,
    });
  },
};
