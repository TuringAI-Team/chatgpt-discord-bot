import { AsyncMessage as RabbitMQMessage, Envelope, MessageBody } from "rabbitmq-client";
import { Collection } from "discord.js";
import chalk from "chalk";

import { Packet, PacketData, PacketDirection, PacketMetadata, PacketName, PacketSendOptions, RawPacketData } from "./packet/packet.js";
import { TuringConnectionManager } from "./connection.js";
import { LogType } from "../../util/logger.js";
import { Packets } from "./packets/index.js";

type RabbitMQReplyCallback = (body: MessageBody, envelope?: Envelope) => Promise<void>

export class TuringConnectionHandler {
    private readonly manager: TuringConnectionManager;

    /* All kinds of packets */
    private readonly packets: Collection<PacketName, Packet>;

    constructor(manager: TuringConnectionManager) {
        this.manager = manager;

        this.packets = new Collection();

        /* Initialize the packets. */
        for (const packet of Packets) {
            /* Create an instance of the packet. */
            const instance = new packet(this.manager);
            this.packets.set(instance.options.name, instance);
        }
    }

	public get<T extends Packet = Packet>(name: PacketName, type: PacketDirection = PacketDirection.Both): T | null {
		/* Search for the specified command. */
		const found: T | null = this.packets.get(name) as T ?? null;
		if (found === null) return null;

        /* If the given direction doesn't match the packet's direction, abort. */
        if (type !== PacketDirection.Both && found.options.direction !== type) return null;

		return found;
	}

    /**
     * Handle an incoming (API -> bot) RabbitMQ message.
     * 
     * @param message The received message
     * @param reply Callback to reply to the received message
     */
    public async handle(message: RabbitMQMessage, reply: RabbitMQReplyCallback): Promise<void> {
        try {
            /* Convert the message buffer into a string. */
            const data: string = message.body.toString();

            /* Try to parse the message data. */
            try {
                JSON.parse(data);
            } catch (error) {
                return this.log(message, "invalid JSON");
            }

            /* Parse the message data now. */
            const raw: RawPacketData = JSON.parse(data);
            if (!raw.id) return this.log(message, "invalid packet data");

            /* Find the corresponding packet. */
            const packet: Packet | null = this.get(raw.id, PacketDirection.Incoming);
            if (packet === null) return this.log(message, "invalid packet");

            if (this.manager.app.dev) this.manager.app.logger.debug(chalk.bold(chalk.italic("RabbitMQ")), "->", "packet", chalk.bold(packet.options.name));

            /* Metadata for the packet */
            const metadata: PacketMetadata = this.metadata(packet, message);

            /* Execute the packet handler. */
            const response: PacketSendOptions | void = await packet.handle(raw.data, metadata);

            /* If a response was returned, send that back. */
            if (response) await this.send(response);

        } catch (error) {
            this.log(message, "Failed to handle", "->", error);
        }
    }

    /**
     * Send the given packet to the exchange channel.
     * @param options Packet sending options
     */
    public async send(options: PacketSendOptions): Promise<void> {
        /* Find the corresponding packet. */
        const packet: Packet | null = this.get(options.name, PacketDirection.Outgoing);
        if (packet === null) throw new Error("Invalid packet");

        /* Try to format the outgoing packet data. */
        const data: PacketData = await packet.send(options.data);

        /* Send the message. */
        await this.manager.publisher.send({
            exchange: "messages"
        }, this.serialize(packet, data));
    }

    private metadata(packet: Packet, message: RabbitMQMessage): PacketMetadata {
        return {
            id: message.deliveryTag
        };
    }

    private serialize(packet: Packet, data: PacketData): RawPacketData {
        return {
            id: packet.options.name, data
        };
    }

    private log(data: RabbitMQMessage, ...message: LogType[]): void {
        this.manager.app.logger.error(chalk.bold(chalk.italic("RabbitMQ")), "->", "ID", chalk.bold(data.deliveryTag), "->", ...message);
    }
}