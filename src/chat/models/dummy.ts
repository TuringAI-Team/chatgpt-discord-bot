import { GPTImageAnalyzeOptions, ModelGenerationOptions } from "../types/options.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatAnalyzedImage } from "../types/image.js";
import { ChatClient } from "../client.js";

export class DummyModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Dummy", type: ModelType.Dummy,
            capabilities: [ ModelCapability.GuildOnly, ModelCapability.ImageViewing ]
        });
    }

    public async analyze(options: GPTImageAnalyzeOptions): Promise<ChatAnalyzedImage> {
        return {
            text: "cool thing text OCR yeah",
            description: "cool description"
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const p = await this.client.buildPrompt(options);

        return {
            text: options.images.map(i => `${i.name}, ${i.description}, ${i.text}, ${i.type}`).join("\n") + `\n\n${p.parts.Initial.content}\n\n${p.parts.Other?.content}`
        };
    }
}