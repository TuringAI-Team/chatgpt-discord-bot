import { Text, Image, Audio, Video } from "turing.sh";
import { TURING_API_KEY, TURING_CAPTCHA_KEY, TURING_HOST } from "../config.js";

export default {
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
	audio: new Audio({
		apiKey: TURING_API_KEY,
		captchaKey: TURING_CAPTCHA_KEY,
		options: {
			host: TURING_HOST,
			stream: true,
		},
	}),
	video: new Video({
		apiKey: TURING_API_KEY,
		captchaKey: TURING_CAPTCHA_KEY,
		options: {
			host: TURING_HOST,
			stream: true,
		},
	}),
};
