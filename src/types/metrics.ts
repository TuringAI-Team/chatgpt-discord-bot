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
			models: Array<{
				name: string;
				tokens: number;
			}>;
			total: number;
			tones: Array<{
				name: string;
				tokens: number;
			}>;
		};
		prompt: {
			models: Array<{
				name: string;
				tokens: number;
			}>;
			total: number;
			tones: Array<{
				name: string;
				tokens: number;
			}>;
		};
	};
	requests: {
		total: number;
		models: Array<{
			name: string;
			requests: number;
		}>;
		tones: Array<{
			name: string;
			requests: number;
		}>;
	};
}
export interface ImageMetric {
	requests: {
		total: number;
		models: Array<{
			name: string;
			requests: number;
		}>;
	};
	images: {
		total: number;
		models: Array<{
			name: string;
			images: number;
		}>;
	};
}
export interface VoteMetric {
	total: number;
	new: number;
}
export interface CommandsMetric {
	executed: number;
	executions: Array<{
		command: string;
		executions: number;
		cooldowns: number;
	}>;
}
export interface CampaignsMetric {
	views: {
		now: Array<{
			campaign: string;
			views: number;
		}>;
		total: Array<{
			campaign: string;
			views: number;
		}>;
	};
	clicks: {
		now: Array<{
			campaign: string;
			clicks: number;
		}>;
		total: Array<{
			campaign: string;
			clicks: number;
		}>;
	};
}

export interface Metric {
	id: string;
	type: MetricTypes;
	time: number;
	data: GuildsMetric | UsersMetric | CreditsMetric | ChatMetric | ImageMetric | VoteMetric | CommandsMetric | CampaignsMetric;
}
