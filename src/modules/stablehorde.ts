import StableHorde from "@zeldafan0225/stable_horde";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
const stable_horde = new StableHorde({
  cache_interval: 1000 * 10,
  cache: {
    generations_check: 1000 * 30,
  },
  client_agent: "ChatGPT-Discord-bot:3.0:(discord)Mrlol#0333",
  default_token: process.env.STABLE_HORDE,
});
import { createCanvas, loadImage, Image } from "canvas";
import sharp from "sharp";
import { Configuration, OpenAIApi } from "openai";
import supabase from "./supabase.js";
import "dotenv/config";
import axios from "axios";
import { AttachmentBuilder, StringSelectMenuBuilder } from "discord.js";
import { isPremium } from "./premium.js";
const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);
import underagedCebs from "./all_name_regex.js";

export default stable_horde;
export async function getModels() {
  var models = await stable_horde.getModels();
  return models;
}

export async function generateImg(
  prompt: string,
  steps: number,
  nsfw: boolean,
  n,
  model,
  width,
  height
) {
  var passFilter = await filter(prompt, model);
  if (!passFilter) {
    return {
      message:
        "To prevent generation of unethical images, we cannot allow this prompt with NSFW models/tags.",
      filter: true,
    };
  }
  try {
    const generation = await stable_horde.postAsyncGenerate({
      prompt: `${prompt}`,
      nsfw: nsfw,
      censor_nsfw: nsfw == true ? false : true,
      r2: false,
      shared: true,
      models: [model],
      params: {
        n: n,
        steps: steps,
        // @ts-ignore
        sampler_name: "k_dpmpp_sde",
        width: width,
        height: height,
      },
    });
    return generation;
  } catch (e) {
    return { message: e };
  }
}
export async function generateImg2img(
  prompt: string,
  model: string,
  amount: number,
  nsfw: boolean,
  source_image: string,
  width,
  height
) {
  var passFilter = await filter(prompt, model);
  if (!passFilter) {
    return {
      message:
        "To prevent generation of unethical images, we cannot allow this prompt with NSFW models/tags.",
    };
  }
  try {
    const generation = await stable_horde.postAsyncGenerate({
      prompt: prompt,
      nsfw: nsfw,
      censor_nsfw: nsfw == true ? false : true,
      r2: false,
      shared: true,
      models: [model],
      source_image,
      source_processing: StableHorde.SourceImageProcessingTypes.img2img,
      params: {
        n: amount,
        steps: 40,
        // @ts-ignore
        sampler_name: "k_dpmpp_sde",
        width,
        height,
        denoising_strength: 0.75,
      },
    });
    return generation;
  } catch (e) {
    return { message: e };
  }
}

export async function png2webp(pngUrl) {
  const response = await axios.get(pngUrl, { responseType: "arraybuffer" });
  const imageBuffer = Buffer.from(response.data, "binary");
  const webpBuffer = await sharp(imageBuffer).toFormat("webp").toBuffer();

  // Convert the WebP image buffer to a base64 string
  const webpBase64 = webpBuffer.toString("base64");

  return webpBase64;
}

async function filter(prompt, model?) {
  var youngWords = [
    "kid",
    "kids",
    "lolis",
    "children",
    "child",
    "boy",
    "baby",
    "young",
    "teen",
    "teenager",
    "niñita",
    "years",
    "16yo",
    "year old",
    "underage",
    "underaged",
    "under-age",
    "under-aged",
    "juvenile",
    "minor",
    "underaged-minor",
    "youngster",
    "young teen",
    "preteen",
    "pre-teen",
    "infant",
    "toddler",
    "baby",
    "prepubescent",
    "short,",
    "minor-aged",
  ];
  var nsfwModels = ["Hentai Diffusion"];
  var nsfwWords = ["naked", "nude", "uncensored"];
  var isNsfw = false;
  var isYoung = false;
  if (nsfwModels.find((x) => x == model)) isNsfw = true;
  if (nsfwWords.some((v) => prompt.toLowerCase().includes(v.toLowerCase())))
    isNsfw = true;
  if (youngWords.some((v) => prompt.toLowerCase().includes(v.toLowerCase())))
    isYoung = true;
  if (underagedCebs.some((v) => prompt.toLowerCase().includes(v.toLowerCase())))
    isYoung = true;
  if (!isYoung) {
    var result = await openai.createModeration({
      input: prompt,
    });
    isYoung = result.data.results[0].categories["sexual/minors"];
  }
  if (isYoung && isNsfw) return false;
  return true;
}

export async function checkGeneration(generation: any) {
  // check the status of your generation using the generations id
  const check = await stable_horde.getGenerationStatus(generation.id);
  return check;
}
export async function generateUpscaleRow(generationId, images) {
  const row = new ActionRowBuilder();
  for (var i = 0; i < images.length; i++) {
    var btn1 = new ButtonBuilder() //1
      .setCustomId(`u_${generationId}_${images[i].id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`U${i + 1}`);
    row.addComponents(btn1);
  }
  return row;
}

export async function generateVariationRow(generationId, images) {
  const row = new ActionRowBuilder();
  for (var i = 0; i < images.length; i++) {
    var btn1 = new ButtonBuilder() //1
      .setCustomId(`v_${generationId}_${images[i].id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`V${i + 1}`);
    row.addComponents(btn1);
  }
  return row;
}

export async function generateRateRow(generationId, userId, imageId) {
  const row = new ActionRowBuilder();
  const btn1 = new ButtonBuilder() //1
    .setCustomId(`r_${generationId}_${imageId}_${userId}_1`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("😖");
  row.addComponents(btn1);
  //\😒  \😀 \😍️️️️️️\☹️
  const btn2 = new ButtonBuilder() //3
    .setCustomId(`r_${generationId}_${imageId}_${userId}_3`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("☹️");
  row.addComponents(btn2);
  const btn3 = new ButtonBuilder() //5
    .setCustomId(`r_${generationId}_${imageId}_${userId}_5`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("😒");
  row.addComponents(btn3);
  const btn4 = new ButtonBuilder() //7
    .setCustomId(`r_${generationId}_${imageId}_${userId}_7`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("😀");
  row.addComponents(btn4);
  const btn5 = new ButtonBuilder() //9
    .setCustomId(`r_${generationId}_${imageId}_${userId}_9`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel("😍️️️️️️");
  row.addComponents(btn5);
  return [row];
}

export async function ImagineInteraction(interaction, client, style, prompt) {
  var guildId;
  if (interaction.guild) guildId = interaction.guild.id;
  var ispremium = await isPremium(interaction.user.id, guildId);
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

  var steps = 40;
  //    if (ispremium) steps = 100;
  var width = 512;
  var height = 512;

  var defaultNegPrompt = `lowres, bad anatomy, ((bad hands)), (error), ((missing fingers)), extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, (deformed, disfigured, mutation, extra limbs:1.5),`;
  var negPrompt = defaultNegPrompt;
  // get parameters in prompt string like "prompt --no negative prompt --ar aspect ratio"
  var promptParams = prompt.split("--");
  prompt = promptParams[0];
  if (promptParams.length > 1) {
    for (var i = 1; i < promptParams.length; i++) {
      var param = promptParams[i].split(" ");
      if (param[0] == "no") {
        // replace default negative prompt with user defined negative prompt
        negPrompt = param[1] + ", ";
      }
      if (param[0] == "ar") {
        // aspect ration can be 1:1, 1:2 or 2:1
        var ar = param[1].split(":");
        if (ar[0] == "1" && ar[1] == "1") {
          width = 512;
          height = 512;
        }
        if (ar[0] == "1" && ar[1] == "2") {
          width = 512;
          height = 1024;
        }
        if (ar[0] == "2" && ar[1] == "1") {
          width = 1024;
          height = 512;
        }
      }
    }
  }
  var nsfw = false;

  if (interaction.channel && interaction.channel.nsfw) nsfw = true;
  if (!interaction.channel) nsfw = true;
  if (!interaction.deferred) {
    await interaction.deferReply();
  }

  try {
    var generation;
    var number = 2;
    if (ispremium) number = 4;
    var model;
    var fullPrompt;
    if (style == "anime") {
      model = "Anything Diffusion";
      fullPrompt = `${prompt}, ((anime)), ((anime style))`;
    } else if (style == "realistic") {
      model = "Dreamlike Photoreal";
      fullPrompt = `${prompt}, ((realistic)), ((RTX)), highres, ((photorealistic)), dreamlikeart`;
    } else if (style == "paintart") {
      model = "Midjourney PaintArt";
      fullPrompt = `${prompt}, mdjrny-pntrt`;
    } else if (style == "logo") {
      model = "App Icon Diffusion";
      fullPrompt = `${prompt}, ((logo)), ((app icon)), ((app icon style)), IconsMi`;
    } else if (style == "comic") {
      model = "Comic-Diffusion";
      fullPrompt = `${prompt}, ((comic)), ((comic style))`;
    } else if (style == "gta5") {
      model = "GTA5 Artwork Diffusion";
      fullPrompt = `${prompt}, gtav style`;
    } else if (style == "pixelart") {
      model = "AIO Pixel Art";
      fullPrompt = `${prompt}, ((pixel art)), ((pixelart))`;
    } else if (style == "futuristic") {
      model = "Redshift Diffusion";
      fullPrompt = `${prompt}, ((futuristic)), redshift style`;
    } else if (style == "tshirt") {
      model = "T-Shirt Print Designs";
      fullPrompt = `${prompt}, printdesign`;
    } else if (style == "funko") {
      model = "Funko Diffusion";
      fullPrompt = `${prompt}, funko style`;
    } else if (style == "microworld") {
      model = "Microworlds";
      fullPrompt = `${prompt}, microworld`;
    } else {
      model = "Midjourney Diffusion";
      fullPrompt = `${prompt}, mdjrny-v4 style`;
    }
    fullPrompt = `${fullPrompt} ### ${negPrompt}`;
    generation = await generateImg(
      fullPrompt,
      steps,
      nsfw,
      number,
      model,
      width,
      height
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
          })\n**Prompt:** ${prompt}\n**Model:** ${model}\n**NSFW:** ${nsfw}\n**ChatGPT filter:** ${
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
                    model: model,
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
                    model: model,
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
            prompt: fullPrompt,
            provider: `imagine-${model}`,
            result: {
              generations: status.generations,
              width: width,
              height: height,
            },
            uses: 1,
          },
        ]);

        await sendResults(
          status.generations,
          interaction,
          prompt,
          generation.id,
          interaction.user.id,
          negPrompt,
          style
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
}

export async function sendResults(
  images,
  interaction,
  prompt,
  id: string,
  userId,
  negPrompt,
  style,
  variations: boolean = true
) {
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
    });
  if (variations) {
    embed.setFields(
      {
        name: "Prompt",
        value: prompt,
        inline: false,
      },
      {
        name: "Negative Prompt",
        value: negPrompt,
        inline: false,
      },
      {
        name: "Style",
        value: style,
        inline: false,
      }
    );
  } else {
    embed.setTitle("Variations");
  }

  var row = await generateRateRow(id, userId, images[0].id);
  if (imagesArr.length > 1) {
    row = [await generateUpscaleRow(id, images)];
    if (variations) {
      row.push(await generateVariationRow(id, images));
    }
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

export async function mergeBase64(imgs: string[], width, height) {
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
