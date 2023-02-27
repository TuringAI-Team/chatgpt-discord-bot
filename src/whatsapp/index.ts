import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { WebhookClient, AttachmentBuilder } from "discord.js";
import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";

const client: any = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ["--no-sandbox"],
  },
});
client.webhook = new WebhookClient({
  url: process.env.DISCORD_WEBHOOK_URL,
});
client.commands = [];

eventHandler(client);
commandHandler(client);

client.initialize();
