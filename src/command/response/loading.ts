import { Utils } from "../../util/utils.js";
import { Response } from "../response.js";

const BasePhrases: string[] = [
    "Stealing your job",
    "Thinking"
]

interface LoadingResponseOptions {
    /* Additional phrases to choose from */
    phrases?: string[];
}

export class LoadingResponse extends Response {
    constructor(options: LoadingResponseOptions) {
        super();

        /* Random phrases to display */
        const phrases: string[] = [ ...BasePhrases, ...options.phrases ?? [] ];

        this.addEmbed(builder => builder
            .setTitle(`${Utils.random(phrases)} **...** 🤖`) 
            .setColor("Aqua")
        );
    }
}