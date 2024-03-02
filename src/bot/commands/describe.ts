import { ButtonStyles, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { createCommand } from "../config/setup.js";
import { IMAGE_MODELS } from "../models/index.js";
import EventEmitter from "events";
import { LOADING_INDICATORS } from "../../types/models/users.js";
import { mergeImages } from "../utils/image-merge.js";
import { getDefaultValues, getSettingsValue } from "../utils/settings.js";
import { chargePlan, requiredPremium } from "../utils/premium.js";
import vision from "../models/vision.js";
import axios from "axios";

export default createCommand({
	body: {
		name: "describe",
		description: "Describe an image using AI",
		type: "ChatInput",
		options: [
			{
				type: "Attachment",
				name: "image",
				description: "The image to use",
				required: true,
			},
			{
				type: "String",
				name: "typeImage",
				description: "The type of image you want to describe",
				choices: [
					["Person", "person"],
					["Anything", "anything"],
				],
			},
		],
	},
	cooldown: {
		user: 2 * 60 * 1000,
		voter: 1.5 * 60 * 1000,
		subscription: 1.25 * 60 * 1000,
	},
	interaction: async ({ interaction, options, env, premium }) => {
		let typeImage = options.getString("typeImage") as "person" | "anything";
		if (!typeImage) typeImage = "anything";
		const image = options.getAttachment("image");
		const base64 = await imageUrlToBase64(image.url);

		const response = await vision.run(interaction.bot.api, {
			image: base64,
			typeImage,
		});
		await interaction.edit({
			content: response.description,
		} as CreateMessageOptions);
	},
});

async function imageUrlToBase64(url: string) {
	const res = await axios.get(url, { responseType: "arraybuffer" });
	const buffer = Buffer.from(res.data, "binary").toString("base64");
	return buffer;
}
