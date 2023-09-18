import { Intents } from "@discordeno/bot";

type Partner = {
	emoji: string;
	name: string;
	url: string;
	description: string;
};

const partners: Partner[] = [
	{
		emoji: "emoji as discord expects it",
		name: "",
		url: "",
		description: "",
	},
];

export default {
	bot: {
		token: "",
		id: "",
		intents: Intents.DirectMessages | Intents.GuildMessages,
	},
	rest: {
		host: "",
		port: 8083,
		auth: "",
	},
	database: {
		redis: {
			host: "",
			port: 6379,
			password: "",
			username: "",
		},
		supabase: {
			url: "",
			key: "",
		},
	},
	rabbitmq: {
		uri: "",
	},
	api: {
		key: "",
		captchaKey: "",
		// superKey: "",
		// host: ""
	},
	brand: {
		invite: "",
		color: "",
	},
	partners,
} as const;
