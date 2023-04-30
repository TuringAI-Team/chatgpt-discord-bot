import { DatabaseUser } from "../managers/user.js";

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
        name: "French", id: "fr-FR", emoji: "🇫🇷"
    },

    {
        name: "German", id: "de-DE", emoji: "🇩🇪"
    },

    {
        name: "Italian", id: "it-IT", emoji: "🇮🇹"
    },

    {
        name: "Russian", id: "ru-RU", emoji: "🇷🇺"
    },

    {
        name: "Japanese", id: "jp-JP", emoji: "🇯🇵"
    },

    {
        name: "Chinese", id: "zh-CN", emoji: "🇨🇳"
    },

    {
        name: "Pirate", modelName: "English pirate speak, very heavy pirate accent", id: "pirate", emoji: "🏴‍☠️"
    }
]

type LanguageIdentifier = string | DatabaseUser

export class LanguageManager {
    public static language(id: LanguageIdentifier): UserLanguage {
        const fields: (keyof UserLanguage)[] = [ "emoji", "id", "modelName", "name" ];
        const value: string = typeof id === "object" ? id.settings.language as string : id;

        /* Try to find the language based on one of the fields. */
        return Languages.find(language => {
            for (const field of fields) {
                if (language[field] === value) return true;
                else continue;
            }
        })!;
    }

    public static languageName(id: LanguageIdentifier): string {
        return this.language(id).name;
    }

    public static modelLanguageName(id: LanguageIdentifier): string {
        const language = this.language(id);
        return language.modelName ?? language.name;
    }

    public static languageEmoji(id: LanguageIdentifier): string {
        return this.language(id).emoji;
    }
}