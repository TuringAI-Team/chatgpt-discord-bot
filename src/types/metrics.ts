export type MetricTypes = "guilds" | "users" | "credits" | "chat" | "image" | "vote" | "commands" | "campaigns";

export interface GuildsMetric {
	total: number;
	joins: number;
	leaves: number;
	premium: {
		total: number;
		credits: number;
		plan: number;
	};
}
export interface UsersMetric {
	total: number;
	new: number;
	premium: {
		total: number;
		credits: number;
		plan: number;
	};
}
export interface CreditsMetric {
	total: number; // total credits in all time
	totalUsed: number; // total credits used in all time
	used: number; // credits used in the time period (1 hour)
	totalBought: number; // total credits bought in all time
	bought: number; // credits bought in the time period (1 hour)
	guilds: {
		total: number; // total credits in all time
		used: number; // credits used in the time period (1 hour)
		bought: number; // credits bought in the time period (1 hour)
	};
	users: {
		total: number; // total credits in all time
		used: number; // credits used in the time period (1 hour)
		bought: number; // credits bought in the time period (1 hour)
	};
}
export interface ChatMetric {
	tokens: {
		completion: {
			models: Object; // name: tokens
			total: number;
			tones: Object; // tone name: tokens
		};
		prompt: {
			models: Object; // name: tokens
			total: number;
			tones: Object; // tone name: tokens
		};
	};
	requests: {
		total: number;
		models: Object; // name: requests
		tones: Object; // tone name: requests
	};
}
export interface ImageMetric {
	requests: {
		total: number;
		models: Object; // name: requests
	};
	images: {
		total: number;
		models: Object; // name: images amount
	};
}
export interface VoteMetric {
	total: number;
	new: number;
}
export interface CommandsMetric {
	executed: number;
	executions: Object; // command: { cooldowns: number,  executions: number};
}
export interface CampaignsMetric {
	views: {
		now: Object; // campaign: number
		total: Object;
	};
	clicks: {
		now: Object; // campaign: number
		total: Object;
	};
}

export interface Metric {
	id: string;
	type: MetricTypes;
	time: number;
	data: GuildsMetric | UsersMetric | CreditsMetric | ChatMetric | ImageMetric | VoteMetric | CommandsMetric | CampaignsMetric;
}
