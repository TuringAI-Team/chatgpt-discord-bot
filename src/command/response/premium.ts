import { Response } from "../response.js";

export enum PremiumUpsellType {
    /** Stable Diffusion */
    SDSize, SDSteps, SDChatGPT
}

const PremiumUpsells: Record<PremiumUpsellType, string> = {
    [PremiumUpsellType.SDSteps]: "**Premium** increases the maximum amount of steps you can use for image generation",
    [PremiumUpsellType.SDSize]: "**Premium** allows you to generate way bigger images",
    [PremiumUpsellType.SDChatGPT]: "This feature is only available to **Premium** users for now"
}

interface PremiumUpsellResponseOptions {
    /* Which upsell to display */
    type: PremiumUpsellType;
}

export class PremiumUpsellResponse extends Response {
    constructor(options: PremiumUpsellResponseOptions) {
        super();

        this.addEmbed(builder => builder
            .setDescription(`${PremiumUpsells[options.type]}. **Premium ✨** also gives you many additional benefits; view \`/premium\` for more.`) 
            .setColor("Orange")
        );

        this.setEphemeral(true);
    }
}