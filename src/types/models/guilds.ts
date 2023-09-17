import { SettingsCategory } from "../settings.js";
import { Plan, Subscription } from "../subscription.js";
import { Infractions } from "./users.js";

export interface Guild {
	id: string;
	created: string;
	infractions: Infractions[];
	subscription: Subscription | null;
	plan: Plan | null;
	settings: SettingsCategory[];
	settings_new: SettingsCategory[];
	metadata: Record<string, unknown>;
}
