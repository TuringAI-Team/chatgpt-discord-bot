import { Text, Image, Other } from "turing.sh";
import {
  TURING_API_KEY,
  TURING_CAPTCHA_KEY,
  TURING_HOST,
  TURING_SUPER_KEY,
} from "../config.js";

export function createAPI() {
  return {
    text: new Text({
      apiKey: TURING_API_KEY,
      captchaKey: TURING_CAPTCHA_KEY,

      options: {
        host: TURING_HOST,
        stream: true,
      },
    }),

    image: new Image({
      apiKey: TURING_API_KEY,
      captchaKey: TURING_CAPTCHA_KEY,

      options: {
        host: TURING_HOST,
        stream: true,
      },
    }),

    other: new Other({
      apiKey: TURING_API_KEY,
      captchaKey: TURING_CAPTCHA_KEY,
      superKey: TURING_SUPER_KEY,

      options: {
        host: TURING_HOST,
        stream: true,
      },
    }),
  };
}
