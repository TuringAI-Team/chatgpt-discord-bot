// Require the necessary discord.js classes
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import ms from "ms";
import { fileURLToPath } from "url";
import {
  Client,
  Events,
  Collection,
  GatewayIntentBits,
  ActivityType,
  REST,
  Routes,
} from "discord.js";
import { initChat } from "./modules/gpt-api.js";
import supabase from "./modules/supabase.js";
import * as dotenv from "dotenv"; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import "./modules/status.js";

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

client.commands = new Collection();
const commands = [];
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = `./commands/${file}`;
  console.log(filePath);
  const { default: command } = await import(filePath);
  // Set a new item in the Collection with the key as the command name and the value as the exported module
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  } else {
    console.log(
      chalk.yellow(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      )
    );
  }
}

// Construct and prepare an instance of the REST module

// and deploy your commands!
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, async (c) => {
  console.log(
    chalk.white(`Ready! Logged in as `) + chalk.blue.bold(c.user.tag)
  );
  var guilds = client.guilds.cache.map((guild) => guild);
  for (var i = 0; i < guilds.length; i++) {
    var guild = client.guilds.cache.get(guilds[i].id);
    var owner = await guild.fetchOwner();
    if (guild.memberCount <= 3) {
      /* owner.user
        .send(
          `I leave your server call ${guild.name} because we have a servers limit put by discord. If you want to use the bot please enter in [dsc.gg/turing](https://dsc.gg/turing)`
        )
        .catch((err) => console.log(`${owner.user.tag} no ha sido notificado`));
*/
      var ch = client.channels.cache.get("1051425293715390484");
      ch.send(
        `Me he salido de **${guild.name}**(${guild.id})\nTenía un total de **${guild.memberCount} miembros**.\nSu dueño es **${owner.user.tag}(${owner.id})**`
      );
      await guild.leave();
    }
  }
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("abled", true);
  await initChat();
  setInterval(async () => {
    await initChat();
  }, ms("50m"));
  client.user.setPresence({
    activities: [
      { name: `v0.0.8 | dsc.gg/turing`, type: ActivityType.Playing },
    ],
    status: "online",
  });
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }
});

// Log in to Discord with your client's token
client.login(process.env.TOKEN);
