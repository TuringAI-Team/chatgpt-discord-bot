import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import "dotenv/config";
import supabase from "../modules/supabase.js";
import {
  checkGeneration,
  generateImg,
  generateImg2img,
  png2webp,
} from "../modules/stablehorde.js";
import { isPremium } from "../modules/premium.js";
import { createCanvas, loadImage, Image } from "canvas";
import sharp from "sharp";
import { generateRateRow, generateUpscaleRow } from "../modules/stablehorde.js";
var maintenance = false;

var data = new SlashCommandBuilder()
  .setName("imagine")
  .setDescription("Generate an image using open joruney.")
  .addStringOption((option) =>
    option
      .setName("prompt")
      .setDescription("The prompt for generating an image")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("style")
      .setDescription("The style of the image")
      .setRequired(true)
      .addChoices(
        // anime, realistic, paintart,
        { name: "Anime", value: "anime" },
        { name: "Realistic", value: "realistic" },
        { name: "Paintart", value: "paintart" },
        { name: "Pixel Art", value: "pixelart" },
        { name: "Futuristic", value: "futuristic" },
        { name: "Microworld", value: "microworld" },
        { name: "T-Shirt", value: "tshirt" },
        { name: "Logo", value: "logo" },
        { name: "GTA 5 Art", value: "gta5" },
        { name: "Funko Pop", value: "funko" },
        { name: "Other", value: "other" }
      )
  );
export default {
  cooldown: "4m",
  data,
  async execute(interaction, client) {
    if (maintenance == true && interaction.user.id != "530102778408861706") {
      await interaction.reply({
        content:
          "Service under maintenance, for more information join us on [dsc.gg/turing](https://dsc.gg/turing)",
        ephemeral: true,
      });
      return;
    }
    var tags = [];
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    var ispremium = await isPremium(interaction.user.id, guildId);
    if (
      interaction.channel &&
      interaction.channel.id != "1049275551568896000" &&
      interaction.channel.id != "1047053103414911026" &&
      interaction.guild.id == "899761438996963349"
    ) {
      interaction.reply({
        content: `For use this utility go to <#1049275551568896000>`,
        ephemeral: true,
      });
      return;
    }
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

    var steps = 30;
    //    if (ispremium) steps = 100;

    var prompt = interaction.options.getString("prompt");

    prompt = `${prompt}, ${tags.join(", ")}`;
    var defaultNegPrompt = `lowres, bad anatomy, ((bad hands)), (error), ((missing fingers)), extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, (deformed, disfigured, mutation, extra limbs:1.5),`;
    var nsfw = false;
    var FullnegPrompt = defaultNegPrompt;

    if (interaction.channel && interaction.channel.nsfw) nsfw = true;
    if (!interaction.channel) nsfw = true;

    await interaction.deferReply();

    try {
      var generation;
      var number = 2;
      if (ispremium) number = 4;
      var model;
      var style = interaction.options.getString("style");
      if (style == "anime") {
        model = "Anything Diffusion";
        prompt = `${prompt}, ((anime)), ((anime style))`;
      } else if (style == "realistic") {
        model = "Dreamlike Photoreal";
        prompt = `${prompt}, ((realistic)), ((RTX)), highres, ((photorealistic)), dreamlikeart`;
      } else if (style == "paintart") {
        model = "Midjourney PaintArt";
        prompt = `${prompt}, mdjrny-pntrt`;
      } else if (style == "logo") {
        model = "App Icon Diffusion";
        prompt = `${prompt}, ((logo)), ((app icon)), ((app icon style)), IconsMi`;
      } else if (style == "comic") {
        model = "Comic-Diffusion";
        prompt = `${prompt}, ((comic)), ((comic style))`;
      } else if (style == "gta5") {
        model = "GTA5 Artwork Diffusion";
        prompt = `${prompt}, gtav style`;
      } else if (style == "pixelart") {
        model = "AIO Pixel Art";
        prompt = `${prompt}, ((pixel art)), ((pixelart))`;
      } else if (style == "futuristic") {
        model = "Redshift Diffusion";
        prompt = `${prompt}, ((futuristic)), redshift style`;
      } else if (style == "tshirt") {
        model = "T-Shirt Print Designs";
        prompt = `${prompt}, printdesign`;
      } else if (style == "funko") {
        model = "Funko Diffusion";
        prompt = `${prompt}, funko style`;
      } else if (style == "microworld") {
        model = "Microworlds";
        prompt = `${prompt}, microworld`;
      } else {
        model = "Midjourney Diffusion";
        prompt = `${prompt}, mdjrny-v4 style`;
      }
      generation = await generateImg(prompt, steps, nsfw, number, model);

      if (generation.message) {
        if (
          generation.message.toLowerCase().includes("nsfw") ||
          generation.message.includes("unethical image")
        ) {
          const channel = client.channels.cache.get("1055943633716641853");
          channel.send(
            `**Wrong prompt from __${interaction.user.tag}__** (${
              interaction.user.id
            })\n**Prompt:** ${prompt}\n**Model:** Midjourney Diffusion\n**NSFW:** ${nsfw}\n**ChatGPT filter:** ${
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
                      model: "imagine",
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
                      model: "imagine",
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
              prompt: prompt,
              provider: "imagine",
              result: status.generations,
              uses: 1,
            },
          ]);

          await sendResults(
            status.generations,
            interaction,
            prompt,
            generation.id,
            interaction.user.id
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

async function sendResults(images, interaction, prompt, id: string, userId) {
  var imagesArr = images.map(async (g, i) => {
    const sfbuff = Buffer.from(g.img, "base64");
    var img = await sharp(sfbuff).toFormat("png").toBuffer();

    return new AttachmentBuilder(img, { name: "output.png" });
  });

  var embed = new EmbedBuilder()
    .setColor("#347d9c")
    .setTimestamp()
    .setImage(`attachment://output.png`)
    .setFooter({
      text: `Thanks to https://stablehorde.net/`,
    })
    .setFields({
      name: "Prompt",
      value: prompt,
      inline: false,
    });

  var row = await generateRateRow(id, userId, images[0].id);
  if (imagesArr.length > 1) {
    row = await generateUpscaleRow(id, images);
  }
  var imgs = images.map((g, i) => {
    const sfbuff = Buffer.from(g.img, "base64");
    return sfbuff;
  });

  let base64: any = await mergeBase64(imgs, 512 / 2, 512 / 2);
  base64 = base64.split("base64,")[1];
  var sfbuff = Buffer.from(base64, "base64");
  var resfile = new AttachmentBuilder(sfbuff, { name: "output.png" });
  var resfiles = [resfile];

  var reply = await interaction.editReply({
    files: resfiles,
    components: row,
    content: `${interaction.user}`,
    embeds: [embed],
  });
}

async function mergeBase64(imgs: string[], width, height) {
  var totalW = width * 2;
  var totalH = height * 2;

  if (imgs.length == 1) {
    totalW = totalW / 2;
    totalH = totalH / 2;
  }
  if (imgs.length == 2) {
    totalH = totalH / 2;
  }
  var canvas = createCanvas(totalW, totalH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (var i = 0; i < imgs.length; i++) {
    var im = await sharp(imgs[i]).toFormat("png").toBuffer();
    var b64 = Buffer.from(im).toString("base64");
    const img = new Image();
    var x = 0;
    var y = 0;
    if (i == 0) {
      x = 0;
      y = 0;
    }
    if (i == 1) {
      x = width;
      y = 0;
    }
    if (i == 2) {
      x = 0;
      y = height;
    }
    if (i == 3) {
      x = width;
      y = height;
    }
    img.onload = () => ctx.drawImage(img, x, y, width, height);
    img.onerror = (err) => {
      throw err;
    };
    img.src = `data:image/png;base64,${b64}`;
  }

  const dataURL = canvas.toDataURL();
  return dataURL;
}
function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
