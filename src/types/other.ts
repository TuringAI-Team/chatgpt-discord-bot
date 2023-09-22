import { ShardState } from "@discordeno/gateway";
import { Guild } from "./models/guilds.js";
import { User } from "./models/users.js";

export interface Environment {
	user: User;
	guild?: Guild;
}

export interface ShardInfo {
	id: number;
	state: ShardState;
	rtt: number;
	workerId: number;
}
