import { Response } from "../response.js";

export enum PremiumUpsellType {
    /** /imagine */
    ImagineSize, ImagineSteps
}

const PremiumUpsells: Record<PremiumUpsellType, string> = {
    [PremiumUpsellType.ImagineSteps]: "**Premium** increases the maximum amount of steps you can use for image generation",
    [PremiumUpsellType.ImagineSize]: "**Premium** allows you to generate way bigger images",
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