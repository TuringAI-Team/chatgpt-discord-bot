import { Audio, Image, Text, Video } from "turing.sh";
import config from "../config.js";

export type Api = {
  text: Text;
  image: Image;
  audio: Audio;
  video: Video;
};

export default {
  text: new Text({
    apiKey: config.api.key,
    captchaKey: config.api.captchaKey,
    options: {
      host: config.api.host,
      stream: true,
    },
  }),
  image: new Image({
    apiKey: config.api.key,
    captchaKey: config.api.captchaKey,
    options: {
      host: config.api.host,
      stream: true,
    },
  }),
  audio: new Audio({
    apiKey: config.api.key,
    captchaKey: config.api.captchaKey,
    options: {
      host: config.api.host,
      stream: true,
    },
  }),
  video: new Video({
    apiKey: config.api.key,
    captchaKey: config.api.captchaKey,
    options: {
      host: config.api.host,
      stream: true,
    },
  }),
} satisfies Api;
