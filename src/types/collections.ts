export type CollectionName = keyof typeof CollectionNames;

export enum CollectionNames {
	guilds = "guilds_new",
	users = "users_new",
	conversations = "convos_new",
	images = "images_new",
	campaigns = "campaigns_new",
	metrics = "metrics_new",
	cooldowns = "cooldowns_new",
}
