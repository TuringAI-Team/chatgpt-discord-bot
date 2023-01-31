// Require the necessary discord.js classes
import chalk from "chalk";
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Partials,
} from "discord.js";
import "dotenv/config";
import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";
// Create a new client instance
const client: any = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [
    Partials.User, // We want to receive uncached users!
    Partials.Channel,
    Partials.Message,
  ],
});
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.commands = new Collection();
client.interactions = new Collection();

// Handlers
eventHandler(client);
commandHandler(client);
// Log in to Discord with your client's token
client.login(process.env.TOKEN);
