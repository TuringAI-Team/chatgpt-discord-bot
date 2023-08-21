import type { Transformers } from "discordeno";

import type { Transformer } from "../transformers/mod.js";
import { DiscordBot } from "../mod.js";

export function createTransformer<T extends keyof Transformers, Transformed, Raw>(
	name: T, handler: (bot: DiscordBot, transformedPayload: Transformed, raw: Raw) => unknown
): Transformer<T, Transformed, Raw> {
	return  {
		name, handler
	};
}