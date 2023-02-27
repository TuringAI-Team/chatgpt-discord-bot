import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import stable_horde, {
  generateImg2img,
  checkGeneration,
  sendResults,
} from "../modules/stablehorde.js";
import supabase from "../modules/supabase.js";
import { generateRateRow } from "../modules/stablehorde.js";
import { isPremium } from "../modules/premium.js";
import ms from "ms";

export default {
  data: {
    customId: "v",
    description: "Make variations of an image",
  },
  async execute(interaction, client, generationId, imageId) {
    await interaction.deferReply();
    // cooldown system for not premium users
    var ispremium = await isPremium(interaction.user.id, interaction.guildId);
    if (!ispremium) {
      let { data: cooldowns, error } = await supabase
        .from("cooldown")
        .select("*")

        // Filters
        .eq("userId", interaction.user.id)
        .eq("command", "variations-imagine");
      if (cooldowns && cooldowns[0]) {
        var cooldown = cooldowns[0];
        var createdAt = new Date(cooldown.created_at);
        var milliseconds = createdAt.getTime();
        var now = Date.now();
        var diff = now - milliseconds;
        //@ts-ignore
        var count = ms("30s") - diff;
        //@ts-ignore
        if (diff >= ms("30s")) {
          const { data, error } = await supabase
            .from("cooldown")
            .update({ created_at: new Date() })
            .eq("userId", interaction.user.id)
            .eq("command", "variations-imagine");
        } else {
          await interaction.editReply({
            content:
              `Use this command again **${ms(
                count
              )}**.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
              "`/premium buy` .",
            ephemeral: true,
          });
          return;
        }
      } else {
        const { data, error } = await supabase
          .from("cooldown")
          .insert([
            { userId: interaction.user.id, command: "variations-imagine" },
          ]);
      }
    }
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
    console.log(generation);
    var result = generation.result;
    var image = result.generations.find((x) => x.id == imageId);
    if (!image) {
      await interaction.editReply({
        content: `Image not found`,
        ephemeral: true,
      });
      return;
    }

    const sfbuff = Buffer.from(image.img, "base64");
    var nsfw = false;
    var userBans = await supabase
      .from("bans")
      .select("*")
      .eq("id", interaction.user.id);
    if (userBans.data[0] && userBans.data[0].banned) {
      interaction.reply({
        content: `You are banned from using this utility, If you think this is an error please contact [the support server](https://dsc.gg/tureing) .`,
        ephemeral: true,
      });
      return;
    }

    if (interaction.channel && interaction.channel.nsfw) nsfw = true;
    if (!interaction.channel) nsfw = true;
    try {
      var generation;
      var number = 2;
      if (ispremium) number = 4;

      generation = await generateImg2img(
        generation.prompt,
        generation.provider.split("imagine-")[1],
        number,
        nsfw,
        image.img,
        generation.result.width,
        generation.result.height
      );

      if (generation.message) {
        if (
          generation.message ==
            `This prompt appears to violate our terms of service and will be reported. Please contact us if you think this is an error.` ||
          generation.message.includes("unethical image") ||
          generation.message.includes("nsfw")
        ) {
          const channel = client.channels.cache.get("1055943633716641853");
          channel.send(
            `**Wrong prompt from __${interaction.user.tag}__** (${
              interaction.user.id
            })\n**Prompt:** ${prompt}\n**Model:** ${
              generation.provider.split("imagine-")[1]
            }\n**NSFW:** ${nsfw}\n**ChatGPT filter:** ${
              generation.filter ? "yes" : "no"
            }`
          );
          if (!userBans.data[0]) {
            await supabase.from("bans").insert([
              {
                id: interaction.user.id,
                tries: 1,
                banned: false,
                prompts: [
                  {
                    prompt: prompt,
                    model: "imagine",
                    nsfw: nsfw,
                    date: new Date(),
                  },
                ],
              },
            ]);
          } else {
            if (userBans.data[0].tries >= 2) {
              await supabase
                .from("bans")
                .update({
                  banned: true,
                  tries: userBans.data[0].tries + 1,
                  prompts: [
                    ...userBans.data[0].prompts,
                    {
                      prompt: prompt,
                      imagine: true,
                      model: generation.provider.split("imagine-")[1],
                      nsfw: nsfw,
                      date: new Date(),
                    },
                  ],
                })
                .eq("id", interaction.user.id);
            } else {
              await supabase
                .from("bans")
                .update({
                  tries: userBans.data[0].tries + 1,
                  prompts: [
                    ...userBans.data[0].prompts,
                    {
                      prompt: prompt,
                      imagine: true,
                      model: generation.provider.split("imagine-")[1],
                      nsfw: nsfw,
                      date: new Date(),
                    },
                  ],
                })
                .eq("id", interaction.user.id);
            }
          }
        }

        await interaction.editReply({
          content: `Something wrong happen:\n${generation.message}`,
          ephemeral: true,
        });
        return;
      }
    } catch (err) {
      console.log(err);
      await interaction.editReply({
        content: `Something wrong happen.`,
        ephemeral: true,
      });
      return;
    }

    var interval = setInterval(async () => {
      try {
        var status = await checkGeneration(generation);
        if (status.done) {
          clearInterval(interval);
          const { data, error } = await supabase.from("results").insert([
            {
              id: generation.id,
              prompt: generation.prompt,
              provider: generation.provider,
              result: {
                generations: status.generations,
                nsfw: nsfw,
                width: generation.result.width,
                height: generation.result.height,
              },
              uses: 1,
            },
          ]);

          await sendResults(
            status.generations,
            interaction,
            generation.prompt.split("###")[0],
            generation.id,
            interaction.user.id,
            generation.prompt.split("###")[1],
            generation.provider.split("imagine-")[1],
            false
          );
        } else {
          if (status.wait_time == undefined) {
            console.log("No wait time", status);
            clearInterval(interval);
            await interaction.editReply({
              content: `Something wrong happen.`,
              ephemeral: true,
            });
          }
          try {
            var waittime = status.wait_time;
            if (waittime < 15) waittime = 15;
            await interaction.editReply({
              content: `Loading...(${waittime}s)`,
            });
          } catch (err) {
            console.log(err);
            clearInterval(interval);
            await interaction.editReply({
              content: `Something wrong happen.`,
              ephemeral: true,
            });
          }
        }
      } catch (err) {
        console.log(err);
        clearInterval(interval);
        await interaction.editReply({
          content: `Something wrong happen.`,
          ephemeral: true,
        });
      }
    }, 15000);
  },
};
