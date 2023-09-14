import { Guild } from "./models/guilds.js";
import { User } from "./models/users.js";

export interface Environment {
	user: User;
	guild: Guild | null;
}
