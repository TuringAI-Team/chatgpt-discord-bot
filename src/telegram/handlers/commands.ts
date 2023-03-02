import path from "node:path";
import fs from "node:fs";
import chalk from "chalk";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function commandHandler(bot) {
  const eventsPath = path.join(__dirname, "../commands");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = `../commands/${file}`;
    const { default: command } = await import(filePath);
    bot.commands.push(command);
    bot.on(command.name, async (...args) => {
      await command.execute(...args, bot);
    });
  }
}
