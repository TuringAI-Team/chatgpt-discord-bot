import { ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";

export const settings: ButtonResponse = {
	id: "settings",
	args: ["action"],
	isPrivate: false,
	run: async (interaction, data) => {
        switch (data.action) {
            case 'open': 
            
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
