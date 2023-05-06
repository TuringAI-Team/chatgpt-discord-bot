import { GPTImageAnalyzeOptions, ModelGenerationOptions } from "../types/options.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { MessageType, PartialResponseMessage } from "../types/message.js";
import { TuringAlanResult } from "../../turing/api.js";
import { ChatClient, PromptData } from "../client.js";
import { ChatAnalyzedImage, ChatOutputImage } from "../types/image.js";
import { Utils } from "../../util/utils.js";

export class TuringAlanModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Alan",
            type: ModelType.TuringAlan,

            capabilities: [ ModelCapability.ImageViewing ]
        });
    }

    public async analyze(options: GPTImageAnalyzeOptions): Promise<ChatAnalyzedImage> {
        /* The images will be analyzed server-side using the Turing API. */
        return {
            description: "", text: ""
        };
    }

    private async process(result: TuringAlanResult): Promise<PartialResponseMessage> {
        if (result.generating !== null && !result.done) {
            return {
                text: `Generating ${result.generating}`,
                type: MessageType.Notice,
            };
        }

        /* Generated images */
        const images: ChatOutputImage[] = [];
        
        if (result.generated === "image" && result.results && result.generationPrompt) {
            for (const url of result.results) {
                const buffer = await Utils.fetchBuffer(url);
                if (buffer === null) continue;

                images.push({
                    data: buffer
                });
            }
        }

        return {
            text: result.result,
            images
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Build the formatted prompt for the chat model. */
        const prompt: PromptData = await this.client.buildPrompt(options);

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringAlanResult = await this.client.session.manager.bot.turing.alan({
            conversation: options.conversation,
            prompt: prompt.prompt,
            user: options.db.user,

            progress: async result => options.progress(await this.process(result))
        });

        return await this.process(result);
    }
}