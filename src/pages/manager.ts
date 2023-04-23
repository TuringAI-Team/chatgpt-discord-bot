import { PagesBuilder } from './builder.js';

import { PagesInteraction, Middleware } from './types/index.js';

export class PagesManager {

    get middleware(): Middleware {
        return (interaction: PagesInteraction) => {
            interaction.pagesBuilder = () => (
                new PagesBuilder(interaction)
            );
        };
    }
}

export * from './types/index.js';
export * from './builder.js';
