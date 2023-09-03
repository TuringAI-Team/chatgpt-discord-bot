import type { Conversation } from "../types/conversation.js";

import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../error/response.js";
import { EmbedColor } from "../utils/response.js";

import { BRANDING_COLOR } from "../../config.js";
export default createCommand({
  name: "bot",
  description: "View information & statistics about the bot",

  handler: async ({ bot, env, interaction }) => {
    let stats = await bot.api.other.stats();
    console.log(stats);
    return {
      embeds: {
        description: `Bot: ${JSON.stringify(stats)}`,
        color: BRANDING_COLOR,
      },

      ephemeral: false,
    };
  },
});
