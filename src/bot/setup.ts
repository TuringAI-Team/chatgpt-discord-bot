import { Awaitable } from "discord.js";
import { basename } from "path";
import chalk from "chalk";

import { Event } from "../event/event.js";
import { Utils } from "../util/utils.js";
import { type App } from "../app.js";
import { type Bot } from "./bot.js";

type BotSetupAppType = App | Bot

interface BotSetupStep<AppType extends BotSetupAppType = BotSetupAppType> {
    /* Name of the setup step */
    name: string;

    /* Only execute the step if this function evaluates to `true` */
    check?: (bot: AppType) => Awaitable<boolean>;

    /* Function to execute for the setup step */
    execute: (bot: AppType) => Awaitable<any>;
}

type BotSetupType = "bot" | "app"

const BotSetupSteps: {
    bot: BotSetupStep<Bot>[],
    app: BotSetupStep<App>[]
} = {
    app: [
        {
            name: "Configuration",
            execute: async app => await import("../config.json", {
                assert: {
                    type: "json"
                }
            }).then(data => app.config = data.default as any)
        },

        {
            name: "Cache manager",
            execute: app => app.cache.setup()
        },

        {
            name: "Database manager",
            execute: app => app.db.setup()
        },

        {
            name: "Turing RabbitMQ connection",
            execute: app => app.connection.setup()
        },

        {
            name: "Cluster manager",
            execute: app => app.manager.setup()
        }
    ],

    bot: [
            {
                name: "Stable Horde",
                execute: async bot => bot.image.setup()
            },

            {
                name: "Supabase database",
                execute: async bot => bot.db.setup()
            },

            {
                name: "Conversation sessions",
                execute: async bot => bot.conversation.setup()
            },

            {
                name: "Scheduled tasks",
                execute: bot => bot.task.setup()
            },

            {
                name: "Load Discord commands",
                execute: async bot => bot.command.loadAll()
            },

            {
                name: "Load Discord interactions",
                execute: async bot => bot.interaction.loadAll()
            },

            {
                name: "Register Discord commands",
                check: bot => bot.data.id === 0,
                execute: bot => bot.command.register()
            },

            {
                name: "Load Discord events",
                execute: bot => Utils.search("./build/events", "js")
                    .then(files => files.forEach(path => {
                        /* Name of the event */
                        const name: string = basename(path).split(".")[0];

                        import(path)
                            .then((data: { [key: string]: Event }) => {
                                const event: Event = new (data.default as any)(bot);
                                
                                bot.client.on(event.name, async (...args: any[]) => {
                                    try {
                                        await event.run(...args);
                                    } catch (error) {
                                        bot.logger.error(`Failed to run event ${chalk.bold(name)} ->`, error)
                                    }
                                });
                            })
                            .catch(error => bot.logger.warn(`Failed to load event ${chalk.bold(name)} ->`, error));
                    }))
            }
    ]
}

export const executeConfigurationSteps = async (bot: BotSetupAppType, type: BotSetupType): Promise<void> => {
    const steps: BotSetupStep<any>[] = BotSetupSteps[type];

    /* Execute all of the steps asynchronously, in order. */
    for (const [ index, step ] of steps.entries()) {
        try {
            /* Whether the step should be executed */
            const check: boolean = step.check ? await step.check(bot) : true;

            /* Execute the step. */
            if (check) await step.execute(bot);
            if (bot.dev) bot.logger.debug(`Executed configuration step ${chalk.bold(step.name)}. [${chalk.bold(index + 1)}/${chalk.bold(steps.length)}]`);

        } catch (error) {
            bot.logger.error(`Failed to execute configuration step ${chalk.bold(step.name)} ->`, error);
            bot.stop(1);
        }
    }
}