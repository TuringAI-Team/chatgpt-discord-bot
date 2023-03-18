import { SlashCommandBuilder } from "discord.js";
import stable_horde from "../modules/stablehorde.js";
import supabase from "../modules/supabase.js";

export default {
  data: {
    customId: "r",
    description: "Button for rating images",
  },
  async execute(interaction, client, generationId, imageId, userId, rate) {
    if (interaction && !interaction.deferred && !interaction.replied) {
      try {
        await interaction.deferReply();
      } catch (err) {}
    }

    if (userId != interaction.user.id) {
      await interaction.editReply({
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
      await interaction.editReply({
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
          await interaction.editReply({
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
      await interaction.editReply({
        content: `${interaction.user} image rated(${rate}/10) successfully.`,
        ephemeral: true,
      });
    } catch (err) {
      console.log(err);
    }
  },
};
