import {
  AudioPlayer,
  createAudioResource,
  StreamType,
  entersState,
  VoiceConnectionStatus,
  joinVoiceChannel,
  getVoiceConnection,
} from "@discordjs/voice";
import discordTTS from "discord-tts";
import delay from "delay";
import { EndBehaviorType, VoiceReceiver } from "@discordjs/voice";
import axios from "axios";
import * as prism from "prism-media";
import "dotenv/config";
import { pipeline } from "node:stream";
import fs from "fs";
import { createWriteStream } from "node:fs";
import type { User } from "discord.js";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import cld from "cld";
import { chat } from "./gpt-api.js";
import Stream from "node:stream";
import { isPremium } from "./premium.js";

export async function voiceAudio(interaction, client, commandType) {
  await commandType.load(interaction);
  if (client.guildsVoice.find((x) => x == interaction.guildId)) {
    await commandType.reply(interaction, {
      ephemeral: true,
      content: `The bot is already processing a request in this server, please wait until the bot finish this request.`,
    });
    return;
  }
  if (!interaction.member.voice.channelId) {
    await commandType.reply(interaction, {
      ephemeral: true,
      content: `You are not connected to a voice channel.`,
    });
    return;
  }
  client.guildsVoice.push(interaction.guildId);
  let audioPlayer = new AudioPlayer();

  let voiceConnection = await startVoiceConnection(interaction, client);

  if (
    voiceConnection._state.status === VoiceConnectionStatus.Connecting ||
    voiceConnection._state.status === VoiceConnectionStatus.Ready
  ) {
    await voiceConnection.subscribe(audioPlayer);
    await infoEmbed(interaction, "hearing", commandType);
    await responseWithVoice(
      interaction,
      "Waiting for your request",
      commandType,
      audioPlayer
    );

    const receiver = voiceConnection.receiver;
    await createListeningStream(
      receiver,
      interaction.user.id,
      interaction,
      commandType,
      audioPlayer,
      interaction.user
    );
    const index = client.guildsVoice.indexOf(interaction.guildId);
    if (index > -1) {
      // only splice array when item is found
      client.guildsVoice.splice(index, 1); // 2nd parameter means remove one item only
    }

    /*  var text = await getTranscription();
    console.log(text);*/
  }
}

async function getTranscription(file) {
  try {
    const response = await axios({
      baseURL: `https://api-inference.huggingface.co/models/openai/whisper-base`,
      headers: { Authorization: `Bearer ${process.env.HF}` },
      method: "POST",
      data: file,
    });
    const result = response.data;
    return result;
  } catch (err) {
    return { error: err };
  }
}

function getDisplayName(userId: string, user?: User) {
  return user ? `${user.username}_${user.discriminator}` : userId;
}

export async function createListeningStream(
  receiver: VoiceReceiver,
  userId: string,
  interaction,
  commandType,
  audioPlayer,
  user?: User
) {
  const opusStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 1750,
    },
  });
  const oggStream = new prism.opus.OggLogicalBitstream({
    opusHead: new prism.opus.OpusHead({
      channelCount: 2,
      sampleRate: 48000,
    }),
    pageSizeControl: {
      maxPackets: 10,
    },
  });

  const filename = `./recordings/${Date.now()}-${userId}.ogg`;

  const out = createWriteStream(filename);
  console.log(`👂 Started recording ${filename}`);

  pipeline(opusStream, oggStream, out, async (err) => {
    if (err) {
      console.warn(`❌ Error recording file ${filename} - ${err.message}`);
    } else {
      console.log(`✅ Recorded ${filename}`);
      await responseWithVoice(
        interaction,
        "Processing your request",
        commandType,
        audioPlayer
      );

      await infoEmbed(
        interaction,
        "processing",
        commandType,
        "transcribing audio"
      );

      var buffer = await fs.readFileSync(filename);
      var text = await getTranscription(buffer);
      console.log(text);
      await fs.unlinkSync(filename);
      var ispremium = await isPremium(interaction.user.id);
      await infoEmbed(interaction, "processing", commandType, "chatgpt");

      var result = await chat(
        text.text,
        interaction.user.username,
        ispremium,
        "chatgpt",
        `chat-${interaction.user.id}`
      );
      if (!result.error) {
        await responseWithVoice(
          interaction,
          result.text,
          commandType,
          audioPlayer
        );
        var channel = interaction.channel;
        if (!interaction.channel) channel = interaction.user;
        await responseWithText(
          interaction,
          text.text,
          result.text,
          channel,
          "chatgpt",
          commandType
        );
      } else {
        await commandType.reply(
          interaction,
          `Something went wrong:\n${result.error}`
        );
      }
    }
  });
}
async function responseWithText(
  interaction,
  prompt,
  result,
  channel,
  type,
  commandType
) {
  var completeResponse = `**${interaction.user.tag}:** ${prompt}\n**AI(${type}):** ${result}`;
  var charsCount = completeResponse.split("").length;
  var row = await buttons(true);
  if (charsCount / 2000 >= 1) {
    var loops = Math.ceil(charsCount / 2000);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        try {
          commandType.reply(interaction, {
            content: completeResponse.split("").slice(0, 2000).join(""),
            embeds: [],
            components: row,
          });
        } catch (err) {
          console.log(err);
        }
      } else {
        channel.send(
          completeResponse
            .split("")
            .slice(2000 * i, 2000 * i + 2000)
            .join("")
        );
      }
    }
  } else {
    commandType.reply(interaction, {
      content: completeResponse,
      embeds: [],
      components: row,
    });
  }
}

async function responseWithVoice(
  interaction,
  result,
  commandType,
  audioPlayer
) {
  if (!result) result = "Something went wrong with your prompt.";
  var charsCount = result.split("").length;
  var audioResources = [];
  var langCode = "en";
  try {
    var langObj = await cld.detect(result);
    if (langObj.reliable && langObj.languages[0].code != "en") {
      langCode = langObj.languages[0].code;
    }
  } catch (err) {}

  if (charsCount >= 200) {
    if (charsCount >= 1000) {
      commandType.reply(interaction, `Answer is too long to read it`);
      return;
    }
    var loops = Math.ceil(charsCount / 200);
    for (var i = 0; i < loops; i++) {
      if (i == 0) {
        let stream = discordTTS.getVoiceStream(
          `${result.split("").slice(0, 200).join("")}`,
          { lang: langCode }
        );
        let audioResource = createAudioResource(stream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true,
        });
        audioResources.push({ ar: audioResource, chars: 200 });
      } else {
        let stream = discordTTS.getVoiceStream(
          `${result
            .split("")
            .slice(200 * i, 200 * i + 200)
            .join("")}`,
          { lang: langCode }
        );
        let audioResource = createAudioResource(stream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true,
        });
        audioResources.push({
          ar: audioResource,
          chars: result.split("").slice(200 * i, 200 * i + 200).length,
        });
      }
    }
  } else {
    var stream = discordTTS.getVoiceStream(`${result}`, {
      lang: langCode,
    });
    var audioResource = createAudioResource(stream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });
  }

  if (audioResources.length >= 1) {
    for (let i = 0; i < audioResources.length; i++) {
      var ar = audioResources[i].ar;
      console.log(`playing ${i} with ${audioResources[i].chars} characters`);
      audioPlayer.play(ar);
      await delay(audioResources[i].chars * 80);
    }
  } else {
    audioPlayer.play(audioResource);
    await delay(charsCount * 80);
  }
}

async function infoEmbed(interaction, status, commandType, process?) {
  var embed = new EmbedBuilder()
    .setTitle("ChatGPT Voice(Beta)")
    .setColor("#5865F2")
    .setTimestamp();
  if (status == "hearing") {
    embed.setDescription("I am waiting for your command.");
  }
  if (status == "processing") {
    embed.setDescription(`ChatGPT is processing(${process}) your request.`);
  }
  if (status == "result") {
    embed.setDescription("ChatGPT successfully.");
  }
  var row = await buttons(false);
  await commandType.reply(interaction, {
    embeds: [embed],
    components: row,
  });
}
export async function Elevenlabs(string) {
  try {
    var res = await axios({
      baseURL: "https://api.pawan.krd/tts",
      method: "POST",
      headers: {
        "Content-type": "application/json",
      },
      data: JSON.stringify({
        text: string,
        voice: "adam",
      }),
      responseType: "arraybuffer",
    });
    var data = res.data;
    var stream = await convertBufferToStream(data);
    return stream;
  } catch (err) {
    console.log(err);
    return null;
  }
}

async function convertBufferToStream(buffer) {
  const binaryStream = new Stream.Readable();
  binaryStream.push(buffer);
  binaryStream.push(null);
  return binaryStream;
}
async function startVoiceConnection(interaction, client) {
  let voiceConnection;
  if (getVoiceConnection(interaction.guildId)) {
    voiceConnection = getVoiceConnection(interaction.guildId);
  }
  if (
    !voiceConnection ||
    voiceConnection._state.status === VoiceConnectionStatus.Disconnected
  ) {
    voiceConnection = joinVoiceChannel({
      channelId: interaction.member.voice.channelId,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    voiceConnection = await entersState(
      voiceConnection,
      VoiceConnectionStatus.Connecting,
      10_000
    );
  }
  return voiceConnection;
}
async function buttons(bool) {
  const row = new ActionRowBuilder();
  var btn1 = new ButtonBuilder() //1
    .setCustomId(`leave-vc`)
    .setStyle(ButtonStyle.Secondary)
    .setLabel(`Stop voice system`);
  row.addComponents(btn1);
  if (bool) {
    var btn2 = new ButtonBuilder() //1
      .setCustomId(`chat-vc`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`🎙️New command`);
    row.addComponents(btn2);
  }

  return [row];
}
