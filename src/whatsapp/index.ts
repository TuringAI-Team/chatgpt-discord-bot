import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import { WebhookClient, AttachmentBuilder } from "discord.js";
import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";

var args = [];
if (process.env.NODE_ENV != "development") {
  args.push("--no-sandbox");
}

const client: any = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args,
  },
});
client.webhook = new WebhookClient({
  url: process.env.DISCORD_WEBHOOK_URL,
});
client.commands = [];

eventHandler(client);
commandHandler(client);

if (process.env.NODE_ENV != "development") {
  client.initialize();
}
