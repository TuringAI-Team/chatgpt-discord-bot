import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class DummyModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Dummy",
            type: ModelType.Dummy,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.GuildOnly ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        return {
            text: `${options.guild?.guild.name} = guild, ${options.guild?.member.nickname} = nickname`
        };
    }
}