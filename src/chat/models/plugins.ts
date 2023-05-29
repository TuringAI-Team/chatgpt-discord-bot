import { ChatSettingsPlugin, ChatSettingsPluginIdentifier, ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { TuringChatPluginsModel, TuringChatPluginsResult } from "../../turing/api.js";
import { MultipleChoiceSettingsOption } from "../../db/managers/settings.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class PluginsModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "ChatGPT Plugins",
            type: ModelType.OpenAIPlugins,

            capabilities: [ ModelCapability.ImageViewing ]
        });
    }

    private process(options: ModelGenerationOptions, result: TuringChatPluginsResult): PartialResponseMessage | null {
        if (result.thought !== null && result.result.length === 0) return {
            text: `💬 *\`\`\`${result.thought}\`\`\`*`
        };

        if (result.result.length === 0) return null;

        /* Construct the final, formatted response. */
        let final: string = result.result;
        if (result.tool !== null) final = `${final}\n\n(*used tool \`${result.tool}\`* 🛠️)`;

        return {
            display: final,
            text: result.result,

            raw: {
                cost: result.credits
            }
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);

        const identifiers: ChatSettingsPluginIdentifier[] = MultipleChoiceSettingsOption
            .which(this.client.session.manager.bot.db.settings.get(options.db.user, "plugins:list"));

        /* All of the user's plugins */
        const plugins: ChatSettingsPlugin[] =  identifiers.map(id => 
            ChatSettingsPlugins.find(p => p.id === id)!
        );

        /* Which model to use */
        const model: TuringChatPluginsModel = options.model.settings.name.includes("ChatGPT") ? "chatgpt" : "gpt-4";

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringChatPluginsResult = await this.client.session.manager.bot.turing.chatPlugins({
            messages: Object.values(prompt.parts),
            user: options.db.user,

            progress: async result => {
                const formatted = this.process(options, result);
                if (formatted !== null) options.progress(formatted);
            },

            model, plugins
        });

        return this.process(options, result)!;
    }
}