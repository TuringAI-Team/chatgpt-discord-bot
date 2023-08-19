import { InteractionCallbackData, InteractionResponseTypes } from "discordeno";

import { type MessageResponse, transformResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";

export default createTransformer("interaction", (bot, interaction) => {
	Object.defineProperty(interaction, "reply", {
		value: function (response: MessageResponse) {
			return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
				type: InteractionResponseTypes.ChannelMessageWithSource,
				data: transformResponse<InteractionCallbackData>(response)
			});
		}
	});

	Object.defineProperty(interaction, "defer", {
		value: function () {
			return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
				type: InteractionResponseTypes.DeferredChannelMessageWithSource
			});
		}
	});

	Object.defineProperty(interaction, "editReply", {
		value: function (response: MessageResponse) {
			return bot.helpers.editOriginalInteractionResponse(interaction.token, transformResponse(response));
		}
	});
    
	return interaction;
});