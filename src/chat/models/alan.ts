import { TuringAlanImageGenerator, TuringAlanImageGenerators, TuringAlanResult } from "../../turing/api.js";
import { ChatResetOptions, GPTImageAnalyzeOptions, ModelGenerationOptions } from "../types/options.js";
import { ChatAnalyzedImage, ChatInputImage, ChatOutputImage } from "../types/image.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { MessageType, PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";
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

    private async process(options: ModelGenerationOptions, result: TuringAlanResult): Promise<PartialResponseMessage> {
        if (result.generating !== null && result.generationPrompt && !result.done) {
            return {
                text: `Generating ${result.generating} with prompt \`${result.generationPrompt}\``,
                type: MessageType.Notice,
            };
        }

        /* Generated images */
        const images: ChatOutputImage[] = [];

        /* Display name of the image generator */
        const imageGenerator: TuringAlanImageGenerator = TuringAlanImageGenerators.find(
            g => g.type === this.client.session.manager.bot.db.settings.get(options.db.user, "alan:imageGenerator")
        )!;
        
        if (result.generated === "image" && result.results && result.generationPrompt) {
            for (const url of result.results) {
                const buffer = await Utils.fetchBuffer(url);
                if (buffer === null) continue;

                images.push({
                    prompt: result.generationPrompt,
                    notice: imageGenerator.name,
                    data: buffer, url
                });
            }
        }

        return {
            text: result.result,
            images,

            raw: {
                cost: result.credits
            }
        };
    }

    public async reset({ conversation }: ChatResetOptions): Promise<void> {
        await this.client.session.manager.bot.turing.resetAlanConversation({ conversation });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Build the formatted prompt for the chat model. */
        const prompt: PromptData = await this.client.buildPrompt(options);

        /* Image to send to Alan */
        const inputImage: ChatInputImage | null = options.images[0] ?? null;

        /* Previously generated output, for editing */
        const outputImage: ChatOutputImage | null = options.conversation.previous ?
            options.conversation.previous.output.images ? options.conversation.previous.output.images[0] : null
        : null;

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringAlanResult = await this.client.session.manager.bot.turing.alan({
            conversation: options.conversation,
            prompt: prompt.prompt,
            user: options.db.user,

            progress: async result => options.progress(await this.process(options, result)),

            image: {
                input: inputImage,
                output: outputImage
            }
        });

        return await this.process(options, result);
    }
}