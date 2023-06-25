import { ComponentEmojiResolvable } from "discord.js";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier, ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { TuringChatPluginsModel, TuringChatPluginsResult } from "../../turing/api.js";
import { MultipleChoiceSettingsOption } from "../../db/managers/settings.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { Utils } from "../../util/utils.js";
import { Emoji } from "../../util/emoji.js";
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
        if (result.result.length === 0) return null;

        /* Which plugin was used, if applicable */
        const plugin: ChatSettingsPlugin | null = result.tool !== null
            ? ChatSettingsPlugins.find(p => p.id === result.tool) ?? null : null;

        return {
            text: result.result,

            raw: {
                cost: result.credits
            },

            buttons: result.tool !== null ? [
                {
                    label: "Used plugin", emoji: "🛠️",
                    disabled: true
                },

                {
                    label: plugin !== null ? plugin.options.name : Utils.titleCase(result.tool),
                    emoji: plugin !== null && plugin.options.emoji !== null ? Emoji.display(plugin.options.emoji, true) as ComponentEmojiResolvable : undefined,
                    id: "settings:menu:user:plugins"
                }
            ] : []
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);

        const identifiers: ChatSettingsPluginIdentifier[] = MultipleChoiceSettingsOption
            .which(this.client.session.manager.bot.db.settings.get(options.db.user, "plugins:list"));

        /* All of the user's plugins */
        const plugins: ChatSettingsPlugin[] = identifiers.map(id => 
            ChatSettingsPlugins.find(p => p.id === id)!
        );

        /* Which model to use */
        const model: TuringChatPluginsModel = options.model.settings.name.includes("ChatGPT") ? "gpt-3.5-turbo-0613" : "gpt-4-0613";

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringChatPluginsResult = await this.client.session.manager.bot.turing.chatPlugins({
            messages: Object.values(prompt.parts),
            tokens: prompt.max,

            user: options.db.user,

            progress: result => {
                const formatted = this.process(options, result);
                if (formatted !== null) options.progress(formatted);
            },

            model, plugins
        });

        const final = this.process(options, result);
        if (final === null) throw new GPTGenerationError({ type: GPTGenerationErrorType.Empty });

        return final;
    }
}