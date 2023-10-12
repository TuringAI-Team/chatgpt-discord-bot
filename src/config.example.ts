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
		permissions: 0,
		dev: true,
		status: [
			{
				since: null,
				activities: {
					name: "",
					type: "",
					url: "",
				},
				status: 0,
			},
		],
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
		color: 0,
	},
	partners,
	repository: "TuringAI-Team/chatgpt-discord-bot",
} as const;
