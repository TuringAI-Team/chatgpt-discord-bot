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
    let startDate = new Date("Thu, 15 Dec 2022 18:27:08 UTC");
    let msStart = startDate.getTime();
    return {
      embeds: {
        title: "Bot Statistics",
        description: `Bot: ${JSON.stringify(stats)}`,
        fields: [
          {
            name: "Servers 🖥️",
            value: `${stats.guilds}`,
          },
        ],
        color: BRANDING_COLOR,
        timestamp: msStart,
      },

      ephemeral: false,
    };
  },
});
