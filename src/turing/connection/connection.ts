import { Connection as RabbitMQClient, Consumer as RabbitMQConsumer, Publisher as RabbitMQPublisher } from "rabbitmq-client";

import { TuringConnectionHandler } from "./handler.js";
import { Bot } from "../../bot/bot.js";
import { App } from "../../app.js";
import chalk from "chalk";

export class TuringConnectionManager {
    public readonly app: App;

    /* RabbitMQ client */
    public client: RabbitMQClient;
    
    /* Rabbit MQ consumer (API -> bot) */
    public consumer: RabbitMQConsumer;

    /* Rabbit MQ publisher (bot -> API) */
    public publisher: RabbitMQPublisher;

    /* Handler for consuming & publishing messages */
    public readonly handler: TuringConnectionHandler; 

    constructor(app: App) {
        this.app = app;

        this.client = null!;
        this.consumer = null!;
        this.publisher = null!;
        
        this.handler = new TuringConnectionHandler(this);
    }

    /**
     * Wait for the client to connect to the server.
     */
    private async wait(): Promise<void> {
        return new Promise(resolve => {
            this.client.on("connection", () => resolve());
        });
    }

    public async setup(): Promise<void> {
        /* Initialize the RabbitMQ client. */
        this.client = new RabbitMQClient(this.app.config.rabbitMQ.url);

        /* Wait for the client to connect. */
        await this.wait();

        /* Load all packets. */
        await this.handler.setup();

        const exchangeName: string = this.exchangeName();
        const routingKey: string = this.routingKey();

        this.consumer = this.client.createConsumer({
            qos: { prefetchCount: 1 },
            queue: exchangeName,
            
            exchanges: [ { exchange: exchangeName, type: "topic" } ],
            queueBindings: [ { exchange: exchangeName, routingKey: routingKey } ]
        }, message => this.handler.handle(message));

        this.publisher = this.client.createPublisher({
            exchanges: [
                {
                    exchange: exchangeName, type: "topic"
                }
            ],

            maxAttempts: 3
        });

        this.handleErrors(this.consumer);
        this.handleErrors(this.client);
    }

    public async stop(): Promise<void> {
        if (!this.publisher || !this.consumer || !this.client) return;

        /* Wait for pending confirmations and closes the underlying channel. */
        await this.publisher.close();

        /* Stop consuming & wait for any pending message handlers to settle. */
        await this.consumer.close();

        /* Close the client itself. */
        await this.client.close();
    }

    private handleErrors(obj: RabbitMQClient | RabbitMQConsumer) {
        const type = obj instanceof RabbitMQClient ? "client" : "consumer";

        obj.on("error", error => {
            this.app.logger.error(chalk.bold(`RabbitMQ ${type}`), "experienced an error", "->", error);
        });
    }

    private exchangeName(): string {
        return `messages${this.app.dev ? ":dev" : ""}`;
    }

    private routingKey(): string {
        return "message";
    }
}