import { update, insert, get, getCache, setCache, getCollectionKey } from "./db.js";
import { MetricTypes } from "../../types/metrics.js";
import { randomUUID } from "crypto";
let lastPush;

const MetricTypesArr: Array<MetricTypes> = ["guilds", "users", "credits", "chat", "image", "vote", "commands", "campaigns"];

export async function getMetrics(type: MetricTypes) {
	let collectionKey = getCollectionKey("metrics", type, "latest");
	const latest = await getCache(collectionKey);
	if (latest) return latest;
}

export async function setMetrics(type: MetricTypes, newData: Object) {
	// newData -> locates the parameter as string "param.param.param: '+1'"and use +1 to add data
	let oldMetrics = await getMetrics(type);
	let newMetric = Object.keys(newData)[0].split(".");
	let newMetricValue = Object.values(newData)[0];
	console.log(newMetric, newMetricValue);
	let newMetrics = { ...oldMetrics };
	return;
	let collectionKey = getCollectionKey("metrics", type, "latest");
	await setCache(collectionKey, newMetrics);
	return newMetrics;
}

setInterval(async () => {
	console.log("Pushing metrics to database");
	// go through all the metrics and push them to the database
	// get the total metrics
	for (let type of MetricTypesArr) {
		let latest = await getMetrics(type);
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
