import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import commandHandler from "./handlers/commands.js";

var bot: any = new Telegraf(process.env.TELEGRAM);
bot.commands = [];
commandHandler(bot);

bot.launch();
