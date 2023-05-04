import chalk from "chalk";

import { chooseStatusMessage } from "../util/status.js";
import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class ReadyEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "ready");
	}

	public async run(): Promise<void> {
		this.bot.logger.info(`Started on ${chalk.bold(this.bot.client.user!.tag)}.`);

		if (!this.bot.started) {
			this.bot.once("done", () => {
				setInterval(() => chooseStatusMessage(this.bot), 3 * 60 * 1000);
				chooseStatusMessage(this.bot);
			});

		} else {
			setInterval(() => chooseStatusMessage(this.bot), 3 * 60 * 1000);
			chooseStatusMessage(this.bot);
		}
	}
}