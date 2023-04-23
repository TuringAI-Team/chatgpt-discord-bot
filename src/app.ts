import chalk from "chalk";

import { BotManager } from "./bot/manager.js";
import { Logger } from "./util/logger.js";
import { Config } from "./config.js";

enum AppState {
	/* The app is not initialized yet */
	Stopped,

	/* The app is currently starting up */
	Starting,

	/* The app is up & running */
	Running
}

/* Stripped-down app data */
export interface StrippedApp {
	/* Configuration data */
	config: Config;
}

export class App {
    /* Logging instance */
    public readonly logger: Logger;

	/* Manager, in charge of managing the Discord bot & their shards */
	public readonly manager: BotManager;

	/* Configuration data */
	public config: Config;

	/* Current initialization state */
	public state: AppState;

    constructor() {
        this.logger = new Logger();

		/* Set up various managers & services. */
		this.manager = new BotManager(this);

        /* Assign a temporary value to the config, while we wait for the application start.
           Other parts shouldn't access the configuration during this time. */
        this.config = null!;

		/* Set the default, stopped state of the app. */
		this.state = AppState.Stopped;
    }

    /**
     * Set up the application & all related services.
     * @throws An error, if something went wrong
     */
    public async setup(): Promise<void> {
		this.state = AppState.Starting;

		/* Load the configuration. */
		await import("./config.json", {
			assert: {
				type: "json"
			}
		})
			.then(data => this.config = data.default as any)
			.catch(error => {
				this.logger.error(`Failed to load configuration -> ${chalk.bold(error.message)}`);
				this.stop(1);
			});

		/* Load the configuration. */
		await this.manager.setup()
			.catch(error => {
				this.logger.error(`Failed to set up the bot sharding manager -> ${chalk.bold(error.message)}`);
				this.stop(1);
			});

		this.state = AppState.Running;
    }

	/**
     * Shut down the application & all related services.
     */
	public async stop(code: number = 0): Promise<void> {
		this.state = AppState.Stopped;

		/* Exit the process. */
		process.exit(code);
	}

	/**
	 * Get a stripped-down interface of this class.
	 * @returns Stripped-down app
	 */
	public strip(): StrippedApp {
		return {
			config: this.config
		};
	}
}