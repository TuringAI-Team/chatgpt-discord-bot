import { Awaitable } from "discord.js";

import { AutoModerationWord, AutoModerationWordFilterOptions, AutoModerationFilterData, AutoModerationAction, AutoModerationFilterOptions, AutoModerationActionData } from "./automod.js";

export class AutoModerationFilter { 
    /* Description of the filter */
    public readonly description: string;

    constructor({ description, filter }: AutoModerationFilterOptions) {
        this.description = description;
        if (filter) this.filter = filter;
    }

    /**
     * Execute this filter, and get a possible action to perform.
     * @returns A possible infraction, if content was filtered
     */
    public async execute(options: AutoModerationFilterData): Promise<AutoModerationActionData | null> {
        const result = await this.filter(options);
        if (result === null) return null;
        
        return {
            ...result,
            action: this.id
        }
    }

    /**
     * Callback, that gets set by the specific filters to apply rules
     */
    public filter({ content, db }: AutoModerationFilterData): Awaitable<AutoModerationAction | null>;

    /* Stub filter */
    public async filter() { return null; }

    public get id(): string {
        return this.description.toLowerCase().replaceAll(" ", "-");
    }
}

export class AutoModerationWordFilter extends AutoModerationFilter {
    /* Words / RegEx's to block */
    private readonly blocked: AutoModerationWord[];

    /* Default action to execute, if no other was specified */
    private readonly action: AutoModerationAction;

    /* Replacements using for the normalize() function */
    private readonly replacements: Map<RegExp, string>;

    constructor({ description, blocked, action }: AutoModerationWordFilterOptions) {
        super({ description });

        this.blocked = blocked;
        this.action = action;

		this.replacements = new Map([
			[/@/g,  "a"],
			[/\$/g, "s"],
			[/3/g,  "e"],
			[/8/g,  "b"],
			[/1/g,  "i"],
			[/¡/g,  "i"],
			[/5/g,  "s"],
			[/0/g,  "o"],
			[/4/g,  "h"],
			[/7/g,  "t"],
			[/9/g,  "g"],
			[/6/g,  "b"],
			[/8/g,  "b"]
		]);
    }

    public async filter({ content }: AutoModerationFilterData): Promise<AutoModerationAction | null> {
        /* Which word was flagged by the filters, if any */
        let flagged: AutoModerationWord | null = null;
        const cleaned: string = this.normalize(content);

        for (const wordFilter of this.blocked) {
            /* Whether the input message contains this word */
            const matches: boolean = wordFilter.words.some(w => cleaned.includes(w));

            if (matches) {
                flagged = wordFilter;
                break;
            }
        }

        /* If no filter was triggered, return nothing. */
        if (flagged === null) return null;

        return flagged.action ? {
            ...this.action,
            ...flagged.action
        } : this.action;
    }

    private normalize(content: string): string {
        /* Rermove all accented characters, and make the string lower-case. */
		content = content
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");

        /* Fix some attempts at bypassing the filters. */
		this.replacements.forEach((replacement, target) => (content = content.replace(target, replacement)));

		return content
			.replace(/ +(?= )/g, "")      /* Replace any where where there are more than 2 consecutive spaces. */
			.replace(/[^a-zA-Z\s]/g, ""); /* Remove non-alphabetical characters. */
	}
}

export const AutoModerationFilters: AutoModerationFilter[] = [
    new AutoModerationWordFilter({
        description: "Block pedophilia words",
        action: { type: "ban", reason: "Sexual content involving children" },

        blocked: [
            { words: [ "child porn", "i love cp", "send cp", "i love child porn", "where can i get child porn", "get child porn", "love child porn", "love cp", "watching child porn", "pornografia infantil", "children porn", "infant porn", "children sex", "child sex", "infant sex", "childporn", "childsex", "childrensex" ] },
            { words: [ "loli " ], action: { type: "warn", reason: "Possibly sexual content involving underage characters" } }
        ]
    }),

    new AutoModerationWordFilter({
        description: "Block weird words",
        action: { type: "block" },

        blocked: [
            { words: [ "incest"   ], action: { reason: "Incest-related content", type: "warn"  } },
            { words: [ "loli"     ], action: { reason: "Content involving underage characters" } },
            { words: [ "futanari" ], action: { reason: "Weird content", type: "block" }          }
        ]
    }),

    new AutoModerationWordFilter({
        description: "Block racist words",
        action: { reason: "Racist content", type: "block" },

        blocked: [
            { words: [ "nigger", "black african monkey", "african monkey", "chink", "kike", "raghead", "wetback", "zipperhead", "slant eye", "porch monkey", "camel jockey", "sand nigger", "pickaninny", "jungle bunny", "tar baby" ] }
        ]
    }),

    new AutoModerationWordFilter({
        description: "Block homophobic words",
        action: { reason: "Homophobic content", type: "block" },

        blocked: [
            { words: [ "trannie", "tranny", "faggot" ] }
        ]
    })
]