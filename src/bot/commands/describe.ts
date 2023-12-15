import { ButtonStyles, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { createCommand } from "../config/setup.js";
import { IMAGE_MODELS } from "../models/index.js";
import EventEmitter from "events";
import { LOADING_INDICATORS } from "../../types/models/users.js";
import { mergeImages } from "../utils/image-merge.js";
import { getDefaultValues, getSettingsValue } from "../utils/settings.js";
import { chargePlan, requiredPremium } from "../utils/premium.js";

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
            }
        ],
    },
    cooldown: {
        user: 1.5 * 60 * 1000,
        voter: 1.25 * 60 * 1000,
        subscription: 1 * 60 * 1000,
    },
    interaction: async ({ interaction, options, env, premium }) => {
    }
})