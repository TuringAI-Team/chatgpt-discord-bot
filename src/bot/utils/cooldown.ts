import {
  BigString,
  ButtonComponent,
  ButtonStyles,
  Camelize,
  CreateMessageOptions,
  DiscordEmbed,
  MessageComponentTypes,
  MessageComponents,
} from "@discordeno/bot";
import { CollectionNames } from "../../types/collections.js";
import { Command, CommandCooldown } from "../types/index.js";
import { env, getCache, getCollectionKey, premium, setCache } from "./db.js";
import { generateCampaignEmbed } from "./campaigns.js";
import config from "../../config.js";

export async function checkCooldown(
  userId: BigString,
  command: Command,
  type: keyof CommandCooldown
): Promise<CreateMessageOptions | undefined> {
  const has = await getCooldown(userId, command.body.name);
  if (has) {
    const embeds: DiscordEmbed[] = [];
    const components: MessageComponents = [];
    const user = await env(userId.toString());
    if (!user) return {};
    const premiumInfo = await premium(user);

    const cooldownEmbed = {
      description: `This is a cooldown message. You can use this command again <t:${has}:R>. You can reduce/remove this cooldown by donating to the project. [Click here](https://turing.sh/pay)`,
    };

    if (!premiumInfo) {
      const campaign = await generateCampaignEmbed();
      if (campaign) {
        components.push({
          type: MessageComponentTypes.ActionRow,
          components: [
            {
              type: MessageComponentTypes.Button,
              label: "Click here",
              customId: `campaign_${campaign.id}`,
              style: ButtonStyles.Secondary,
            },
          ] as [ButtonComponent],
        });
        embeds.push(campaign.embed);
        embeds.push(cooldownEmbed);
        return {
          embeds,
          components,
        };
      }
    }
    embeds.push(cooldownEmbed);
    return {
      embeds,
    };
  } else {
    await setCooldown(userId, command.body.name, command.cooldown[type]);
  }
}

export async function getCooldown(userId: BigString, command: string) {
  const collection = getCollectionKey(
    CollectionNames.cooldowns,
    userId.toString(),
    command
  );
  const cooldown = await getCache<{
    expires: number;
  }>(collection);
  if (!cooldown) return false;
  //  calculate the time left
  return cooldown.expires;
}

export async function setCooldown(
  userId: BigString,
  command: string,
  time: number
) {
  if (time <= 0) return;
  const collection = getCollectionKey(
    CollectionNames.cooldowns,
    userId.toString(),
    command
  );
  await setCache(
    collection,
    {
      expires: Date.now() + time,
    },
    time
  );
}
