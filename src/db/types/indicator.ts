import { DatabaseUser } from "../managers/user.js";
import { Bot } from "../../bot/bot.js";

export interface LoadingEmoji {
    name: string;
    id: string;

    animated?: boolean;
}

export interface LoadingIndicator {
    /* Name of the loading indicator */
    name: string;

    /* Discord emoji */
    emoji: LoadingEmoji;
}

type LoadingIdentifier = string

export const LoadingIndicators: LoadingIndicator[] = [
    {
        name: "Discord Loading #1",
        emoji: {
            name: "loading", id: "1051419341914132554", animated: true
        }
    },

    {
        name: "Discord Loading #2",
        emoji: {
            name: "discord_loading", id: "1103039423806976021", animated: true
        }
    },

    {
        name: "Orb",
        emoji: {
            name: "orb", id: "1102556034276528238", animated: true
        }
    },

    {
        name: "Vibe Rabbit",
        emoji: {
            name: "rabbit", id: "1078943805316812850", animated: true
        }
    },

    {
        name: "Spinning Skull",
        emoji: {
            name: "spinning_skull", id: "1102635532258906224", animated: true
        }
    }, 

    {
        name: "Spinning Tux",
        emoji: {
            name: "tux_spin", id: "1103014814135099573", animated: true
        }
    },

    {
        name: "Discord Typing",
        emoji: {
            name: "discord_typing", id: "1103039408728445071", animated: true
        }
    },

    {
        name: "Turing Spin",
        emoji: {
            name: "turing_spin", id: "1104867917436289065", animated: true
        }
    },

    {
        name: "Loading Bars",
        emoji: {
            name: "loading2", id: "1104458865224990780", animated: true
        }
    },

    {
        name: "Spinning Cat #1",
        emoji: {
            name: "spinning_maxwell", id: "1104458871642259506", animated: true
        }
    },

    {
        name: "Spinning Cat #2",
        emoji: {
            name: "spinning_cat", id: "1104458868546867424", animated: true
        }
    },

    {
        name: "SpongeBob",
        emoji: {
            name: "spunchbob", id: "1104869247290716201", animated: true
        }
    },

    {
        name: "LEGO",
        emoji: {
            name: "lego", id: "1105171703170076744", animated: true
        }
    }
]

export class LoadingIndicatorManager {
    public static get(id: LoadingIdentifier): LoadingIndicator {
        return LoadingIndicators.find(indicator => indicator.emoji.id === id)!;
    }

    public static getFromUser(bot: Bot, user: DatabaseUser): LoadingIndicator {
        const id: string = bot.db.settings.get(user, "general:loadingIndicator");
        return LoadingIndicators.find(indicator => indicator.emoji.id === id)!;
    }

    public static toString(id: LoadingIdentifier | LoadingIndicator): string {
        const indicator: LoadingIndicator = typeof id === "string" ? this.get(id) : id;
        return `<${indicator.emoji.animated ? "a" : ""}:${indicator.emoji.name}:${indicator.emoji.id}>`;
    }
}