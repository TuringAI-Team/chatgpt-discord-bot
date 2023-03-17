// Require the necessary discord.js classes
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Events,
  Partials,
} from "discord.js";
import "dotenv/config";
import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";
import interactionsHandler from "./handlers/interactions.js";

// Create a new client instance
const client: any = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [
    Partials.User, // We want to receive uncached users!
    Partials.Channel,
    Partials.Message,
  ],
});
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.commands = new Collection();
client.interactions = new Collection();
client.guildsVoice = [];
client.tasks = [];

// Handlers
eventHandler(client);
commandHandler(client);
interactionsHandler(client);
// Log in to Discord with your client's token
client.rest.on("rateLimited", (data) => console.log(data));

client.login(process.env.TOKEN);
