import { SettingCategory } from "../settings.js";
import { Plan, Subscription } from "../subscription.js";
import { Infractions } from "./users.js";

export interface Guild {
	id: string;
	created: string;
	infractions: Infractions[];
	subscription: Subscription | null;
	plan: Plan | null;
	settings: {
		[key: string]: string | number | boolean | object | Array<string | number | boolean>;
	};
	settings_new: SettingCategory[];
	metadata: Record<string, unknown>;
}
