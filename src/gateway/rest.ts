import { createRestManager } from "@discordeno/rest";
import config from "../config.js";

export const rest = createRestManager({
	token: config.bot.token,
	applicationId: config.bot.id,
	proxy: {
		baseUrl: `${config.rest.host}:${config.rest.port}`,
		authorization: config.rest.auth,
	},
});
