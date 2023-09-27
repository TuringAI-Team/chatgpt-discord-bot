import { update, insert, get, getCache, setCache, getCollectionKey } from "./db.js";
import {
	MetricTypes,
	GuildsMetric,
	UsersMetric,
	CreditsMetric,
	ChatMetric,
	ImageMetric,
	VoteMetric,
	CommandsMetric,
	CampaignsMetric,
} from "../../types/metrics.js";
import { randomUUID } from "crypto";
let lastPush;

const MetricTypesArr: Array<MetricTypes> = ["guilds", "users", "credits", "chat", "image", "vote", "commands", "campaigns"];

export async function getMetrics(
	type: MetricTypes,
): Promise<
	GuildsMetric | UsersMetric | CreditsMetric | ChatMetric | ImageMetric | VoteMetric | CommandsMetric | CampaignsMetric | undefined
> {
	const collectionKey = getCollectionKey("metrics", type, "latest");
	const latest = (await getCache(collectionKey)) as
		| GuildsMetric
		| UsersMetric
		| CreditsMetric
		| ChatMetric
		| ImageMetric
		| VoteMetric
		| CommandsMetric
		| CampaignsMetric
		| undefined;
	if (latest) return latest;
}

export function getDefaultMetrics(
	type: MetricTypes,
): GuildsMetric | UsersMetric | CreditsMetric | ChatMetric | ImageMetric | VoteMetric | CommandsMetric | CampaignsMetric | undefined {
	switch (type) {
		case "guilds":
			// get type and change number type to 0
			// type = GuildMetric
			// return type
			const guilds: GuildsMetric = {
				total: 0,
				joins: 0,
				leaves: 0,
				premium: {
					total: 0,
					credits: 0,
					plan: 0,
				},
			};
			return guilds;
		case "users":
			let users: UsersMetric = {
				total: 0,
				new: 0,
				premium: {
					total: 0,
					credits: 0,
					plan: 0,
				},
			};
			return users;
		case "credits":
			let credits: CreditsMetric = {
				total: 0,
				totalUsed: 0,
				used: 0,
				totalBought: 0,
				bought: 0,
				guilds: {
					total: 0,
					used: 0,
					bought: 0,
				},
				users: {
					total: 0,
					used: 0,
					bought: 0,
				},
			};
			return credits;
		case "chat":
			let chat: ChatMetric = {
				tokens: {
					completion: {
						models: [],
						total: 0,
						tones: [],
					},
					prompt: {
						models: [],
						total: 0,
						tones: [],
					},
				},
				requests: {
					models: [],
					total: 0,
					tones: [],
				},
			};
			return chat;
		case "image":
			let image: ImageMetric = {
				requests: {
					total: 0,
					models: [],
				},
				images: {
					total: 0,
					models: [],
				},
			};
			return image;
		case "vote":
			let vote: VoteMetric = {
				total: 0,
				new: 0,
			};
			return vote;
		case "commands":
			let commands: CommandsMetric = {
				executed: 0,
				executions: {
					// command: { cooldowns: number,  executions: number};
				},
			};
			return commands;
		case "campaigns":
			let campaigns: CampaignsMetric = {
				views: {
					total: {},
					now: {},
				},
				clicks: {
					total: {},
					now: {},
				},
			};
			return campaigns;
		default:
			return;
	}
}

export async function setMetrics(type: MetricTypes, newData: NonNullable<unknown>) {
	// newData -> locates the parameter as string "param.param.param: '+1'"and use +1 to add data
	let oldMetrics = await getMetrics(type);
	const newMetric = Object.keys(newData)[0].split(".");
	const newMetricValue = Object.values(newData)[0];
	if (!oldMetrics) oldMetrics = getDefaultMetrics(type);
	if (!oldMetrics) return;
	let oldMetricValue: NonNullable<unknown> = oldMetrics;
	let newMetrics = { ...oldMetrics };

	if (newMetric.length > 1) {
		// @ts-ignore
		oldMetricValue = oldMetrics[newMetric[0]];
		// @ts-ignore
		if (newMetric.length >= 2) oldMetricValue = oldMetricValue[newMetric[1]];
		let newValue: NonNullable<unknown> = oldMetricValue;
		if (typeof newMetricValue == "string" && typeof oldMetricValue == "number") {
			let symbol = newMetricValue.includes("+") ? "+" : "-";
			let value = parseInt(newMetricValue.replace(symbol, ""));
			newValue = symbol == "+" ? oldMetricValue + value : oldMetricValue - value;
		}
		if (newMetric.length == 1) {
			// @ts-ignore
			newMetrics[newMetric[0]] = newValue;
		} else if (newMetric.length == 2) {
			// @ts-ignore
			newMetrics[newMetric[0]][newMetric[1]] = newValue;
		}
	}

	let collectionKey = getCollectionKey("metrics", type, "latest");
	console.log(`${type}, ${JSON.stringify(newMetrics)}, ${collectionKey}`);
	await setCache(collectionKey, newMetrics);
	return newMetrics;
}

setInterval(async () => {
	console.log("Pushing metrics to database");
	// go through all the metrics and push them to the database
	// get the total metrics
	for (const type of MetricTypesArr) {
		const latest = await getMetrics(type);
		await insert(
			"metrics",
			{
				time: Date.now(),
				type: type,
				data: latest,
			},
			randomUUID(),
		);
	}
}, 1000 * 60 * 60); // 5 minutes
