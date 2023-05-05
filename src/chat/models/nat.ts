import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";
import { NatModel } from "../other/nat.js";

export class NatPlaygroundModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Open Playground",
            type: ModelType.Nat,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const model: NatModel = this.client.session.manager.bot.nat.model(options.settings.options.settings.model!);
        const formattedPrompt: PromptData = await this.client.buildPrompt(options);

        const result = await this.client.session.manager.bot.nat.generate({
            prompt: formattedPrompt.prompt,
            model: model,
            
            parameters: {
                temperature: options.settings.options.settings.temperature ?? 0.5,
                topP: options.settings.options.settings.top_p ?? 1,
                stopSequences: [ "User:" ]
            },
            
            progress: response => options.progress({ text: response.message })
        });

        return {
            text: result.content,

            raw: {
                usage: {
                    prompt: getPromptLength(formattedPrompt.prompt),
                    completion: getPromptLength(result.content)
                },

                finishReason: null
            }
        };
    }
}