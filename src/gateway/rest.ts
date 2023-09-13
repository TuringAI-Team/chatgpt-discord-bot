import { createRestManager } from "@discordeno/rest";
import { BOT_ID, BOT_TOKEN, REST_AUTH, REST_URL } from "../config.js";

export const rest = createRestManager({
	token: BOT_TOKEN,
	applicationId: BOT_ID,
	proxy: {
		baseUrl: REST_URL,
		authorization: REST_AUTH,
	},
});
