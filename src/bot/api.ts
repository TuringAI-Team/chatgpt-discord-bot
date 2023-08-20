import { Text, Image } from "turing.sh";
import { TURING_API_KEY, TURING_CAPTCHA_KEY } from "../config.js";

export function createAPI() {
	return {
		text: new Text({
			apiKey: TURING_API_KEY,
			captchaKey: TURING_CAPTCHA_KEY,

			options: {
				stream: true
			}
		}),

		image: new Image({
			apiKey: TURING_API_KEY,
			captchaKey: TURING_CAPTCHA_KEY,

			options: {
				stream: true
			}
		})
	};
}