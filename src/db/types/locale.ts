import { DatabaseUser } from "../schemas/user.js";
import { Bot } from "../../bot/bot.js";

export interface UserLanguage {
    /* Name of the language */
    name: string;

    /* Name of the language, for the chat model */
    modelName?: string;

    /* ISO code of the language */
    id: string;

    /* Display emoji of the language */
    emoji: string;
}

export const Languages: UserLanguage[] = [
    {
        name: "English", id: "en-US", emoji: "🇬🇧"
    },

    {
        name: "Spanish", id: "es-ES", emoji: "🇪🇸"
    },

    {
        name: "Brazilian Portuguese", id: "pt-BR", emoji: "🇧🇷"
    },

    {
        name: "Portuguese", id: "pt-PT", emoji: "🇵🇹", modelName: "European Portuguese"
    },

    {
        name: "French", id: "fr-FR", emoji: "🇫🇷"
    },

    {
        name: "German", id: "de-DE", emoji: "🇩🇪"
    },

    {
        name: "Italian", id: "it-IT", emoji: "🇮🇹"
    },

    {
        name: "Polish", id: "pl", emoji: "🇵🇱"
    },

    {
        name: "Russian", id: "ru-RU", emoji: "🇷🇺"
    },

    {
        name: "Bulgarian", id: "bg", emoji: "🇧🇬"
    },

    {
        name: "Czech", id: "cs", emoji: "🇨🇿"
    },

    {
        name: "Japanese", id: "jp-JP", emoji: "🇯🇵"
    },

    {
        name: "Chinese", id: "zh-CN", emoji: "🇨🇳"
    },

    {
        name: "Vietnamese", id: "vn", emoji: "🇻🇳"
    },

    {
        name: "Pirate", modelName: "English pirate speak, very heavy pirate accent", id: "pirate", emoji: "🏴‍☠️"
    }
]

type LanguageIdentifier = string | DatabaseUser

export class LanguageManager {
    public static get(bot: Bot, id: LanguageIdentifier): UserLanguage {
        const fields: (keyof UserLanguage)[] = [ "emoji", "id", "modelName", "name" ];
        const value: string = typeof id === "object" ? bot.db.settings.get(id, "general:language") : id;

        /* Try to find the language based on one of the fields. */
        return Languages.find(language => {
            for (const field of fields) {
                if (language[field] === value) return true;
                else continue;
            }

            return false;
        }) ?? Languages.find(l => l.id === "en-US")!;
    }

    public static languageName(bot: Bot, id: LanguageIdentifier): string {
        return this.get(bot, id).name;
    }

    public static modelLanguageName(bot: Bot, id: LanguageIdentifier): string {
        const language = this.get(bot, id);
        return language.modelName ?? language.name;
    }

    public static languageEmoji(bot: Bot, id: LanguageIdentifier): string {
        return this.get(bot, id).emoji;
    }
}