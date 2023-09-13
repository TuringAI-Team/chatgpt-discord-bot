import { InteractionDataOption } from "@discordeno/bot";

export type ImagineOption =
	| "prompt"
	| "negative"
	| "model"
	| "style"
	| "count"
	| "steps"
	| "guidance"
	| "sampler"
	| "seed"
	| "ratio"
	| "enhance";

export type ImagineValues = Partial<Record<ImagineOption, string | number | boolean | undefined>>;

export type ImagineOptions = {
	[key in ImagineOption]?: InteractionDataOption;
};
