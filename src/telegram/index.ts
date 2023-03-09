import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";

import eventHandler from "./handlers/events.js";
import commandHandler from "./handlers/commands.js";

var bot: any = new Telegraf(process.env.TELEGRAM);
bot.commands = [];

eventHandler(bot);
commandHandler(bot);

bot.launch();
