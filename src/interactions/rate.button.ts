import { SlashCommandBuilder } from "discord.js";
import stable_horde from "../modules/stablehorde.js";
import supabase from "../modules/supabase.js";

export default {
  data: {
    customId: "r",
    description: "Button for rating images",
  },
  async execute(interaction, client, generationId, imageId, userId, rate) {
    if (userId != interaction.user.id) {
      await interaction.reply({
        content: `You can't rate a image that you haven't generated.`,
        ephemeral: true,
      });
      return;
    }
    var { data, error } = await supabase
      .from("results")
      .select("*")
      .eq("id", generationId)
      .eq("rated", true);
    if (data && data[0]) {
      await interaction.reply({
        content: `This image have already been rated`,
        ephemeral: true,
      });
      return;
    }
    const res = await stable_horde
      .postRating(generationId, {
        ratings: [{ id: imageId, rating: parseInt(rate) }],
      })
      .catch(async (error) => {
        if (error.message == "This generation appears already rated") {
          await interaction.reply({
            content: `This image have already been rated`,
            ephemeral: true,
          });
          return;
        }
      });
    await supabase
      .from("results")
      .update({
        rated: true,
      })
      .eq("id", generationId);
    try {
      await interaction.update({
        content: `${interaction.user} image rated(${rate}/10) successfully.`,
        ephemeral: true,
      });
    } catch (err) {
      console.log(err);
    }
  },
};
