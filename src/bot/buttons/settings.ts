import { ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";
import {generateEmbed} from '../utils/settings.js'

export const settings: ButtonResponse = {
	id: "settings",
	args: ["action"],
	isPrivate: false,
	run: async (interaction, data) => {
        switch (data.action) {
            case 'open': 
                await generat
                break;
            case 'update':
                break;
            default: 
                await interaction.edit({
                    content: "No action found"
                })
        }
    },  
};

export default settings;
