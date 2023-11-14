import {
  ButtonComponent,
  ButtonStyles,
  MessageComponentTypes,
} from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";
import { EnabledSections, generateSections } from "../utils/settings.js";
import { env } from "../utils/db.js";

export const settings: ButtonResponse = {
  id: "settings",
  args: ["action", "value"],
  isPrivate: false,
  run: async (interaction, data) => {
    return;
    /*
    const environment = await env(
      interaction.user.id.toString(),
      interaction.guildId?.toString()
    );
    switch (data.action) {
      case "open": {
        const page = EnabledSections[0];
        const section = await generateSections(page, environment);
        if (section) {
          await interaction.edit(section);
        } else {
          await interaction.edit({
            content: "No section found",
          });
        }
        break;
      }
      case "update":
        break;
      default:
        await interaction.edit({
          content: "No action found",
        });
    }*/
  },
};

export default settings;
