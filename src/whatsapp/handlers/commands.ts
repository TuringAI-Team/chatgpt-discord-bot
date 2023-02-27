import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function commandHandler(client) {
  const commandsPath = path.join(__dirname, "../commands");

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = `../commands/${file}`;
    const { default: command } = await import(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    client.commands.push(command);
  }
}
