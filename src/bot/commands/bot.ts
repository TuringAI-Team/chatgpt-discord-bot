import { createCommand } from "../helpers/command.js";

export default createCommand({
    name: "bot",
    description: "View information & statistics about the bot",

    cooldown: {
        time: 10 * 1000
    },

    handler: () => {
        throw new Error("testing");
    }
});