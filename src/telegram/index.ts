import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";

var bot: any = new Telegraf(process.env.TELEGRAM);
bot.commands = [];

eventHandler(client);
commandHandler(client);

bot.launch();
