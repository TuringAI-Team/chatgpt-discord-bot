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
import "dotenv/config";
import supabase from "./modules/supabase.js";
import { initTokens, reloadTokens, resetto0 } from "./modules/loadbalancer.js";

// Create a new client instance
const client: any = new Client({
  intents: [GatewayIntentBits.Guilds],
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

    console.log(`Successfully reloaded application (/) commands.`);
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
})();

client.once(Events.ClientReady, async (c) => {
  await resetto0();
  client.user.setPresence({
    activities: [
      { name: `v0.1.6 | dsc.gg/turing`, type: ActivityType.Playing },
    ],
    status: "online",
  });

  await reloadTokens();
  setInterval(async () => {
    await reloadTokens();
  }, ms("10m"));
  await initTokens();
  console.log(
    chalk.white(`Ready! Logged in as `) + chalk.blue.bold(c.user.tag)
  );

  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("abled", true);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction, client, commands);
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
