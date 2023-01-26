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
import {
  initTokens,
  reloadTokens,
  resetto0,
  reloadConversations,
  reloadAll,
} from "./modules/loadbalancer.js";

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
      { name: `v0.1.9 | dsc.gg/turing`, type: ActivityType.Playing },
    ],
    status: "online",
  });

  await reloadTokens();
  /*setInterval(async () => {
    await reloadConversations();
  }, ms("1m"));*/
  setInterval(async () => {
    await reloadTokens();
  }, ms("10m"));
  setInterval(async () => {
    await reloadAll(client.shard.client.options.shards[0] + 1);
  }, ms("15m"));
  const { data, error } = await supabase.from("conversations").delete();
  await initTokens(client.shard.client.options.shards[0] + 1);
  console.log(
    chalk.white(`Ready! Logged in as `) + chalk.blue.bold(c.user.tag)
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    if (command.cooldown) {
      let { data: cooldowns, error } = await supabase
        .from("cooldown")
        .select("*")

        // Filters
        .eq("userId", interaction.user.id)
        .eq("command", interaction.commandName);
      if (cooldowns && cooldowns[0]) {
        var cooldown = cooldowns[0];
        var createdAt = new Date(cooldown.created_at);
        var milliseconds = createdAt.getTime();
        var now = Date.now();
        var diff = now - milliseconds;
        var count = ms(command.cooldown) - diff;
        if (diff >= ms(command.cooldown)) {
          await command.execute(interaction, client, commands, "update");
        } else {
          await interaction.reply(
            `Please wait **${ms(
              count
            )}** to use this command again.\nIf you want to **avoid this cooldown** you can **join [our server](https://discord.gg/7dN9Buk5ts)**.`
          );
        }
      } else {
        await command.execute(interaction, client, commands, "create");
      }
    } else {
      await command.execute(interaction, client, commands);
    }
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
