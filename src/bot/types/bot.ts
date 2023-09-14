import { Collection, createLogger } from "@discordeno/utils";
import { createClient } from "redis";
import API from "../api.js";
import { CommandList } from "../handlers/index";

declare module "@discordeno/bot" {
	interface Bot {
		/** Bot logger */
		logger: ReturnType<typeof createLogger>;

		/** Redis connection */
		redis: ReturnType<typeof createClient>;

		/** Turing API */
		api: typeof API;

		/** Command Cooldowns
		 * @type bigint as the user id
		 * @type number as the Unix timestamp of when does the cooldown end
		 */
		cooldowns: Collection<bigint, Record<CommandList, number>>;
	}
}
