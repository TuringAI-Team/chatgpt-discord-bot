export interface UserLanguage {
    /* Name of the language */
    name: string;

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
]