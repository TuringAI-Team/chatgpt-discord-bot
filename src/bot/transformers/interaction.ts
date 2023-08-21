import { DiscordInteraction, Interaction, InteractionCallbackData, InteractionResponseTypes } from "discordeno";

import { type MessageResponse, transformResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";

export default createTransformer<"interaction", Interaction, DiscordInteraction>(
	"interaction",

	(bot, interaction) => {
		Object.defineProperty(interaction, "reply", {
			value: function(response: MessageResponse) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.ChannelMessageWithSource,
					data: transformResponse<InteractionCallbackData>(response)
				});
			}
		});

		Object.defineProperty(interaction, "editReply", {
			value: function(response: MessageResponse) {
				return bot.helpers.editOriginalInteractionResponse(interaction.token, transformResponse(response));
			}
		});

		Object.defineProperty(interaction, "update", {
			value: function(response: MessageResponse) {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.UpdateMessage,
					data: transformResponse<InteractionCallbackData>(response)
				});
			}
		});

		Object.defineProperty(interaction, "deleteReply", {
			value: function() {
				return bot.helpers.deleteOriginalInteractionResponse(interaction.token);
			}
		});

		Object.defineProperty(interaction, "defer", {
			value: function() {
				return bot.helpers.sendInteractionResponse(interaction.id, interaction.token, {
					type: InteractionResponseTypes.DeferredChannelMessageWithSource
				});
			}
		});
		
		return interaction;
	}
);