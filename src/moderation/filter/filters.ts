import { Awaitable } from "discord.js";

import { ModerationFilterWord, ModerationFilterWordOptions, ModerationFilterData, ModerationFilterAction, ModerationFilterOptions, ModerationFilterActionData, ModerationFilterActionType } from "./manager.js";

export class ModerationFilter { 
    /* Description of the filter */
    public readonly description: string;

    constructor({ description }: ModerationFilterOptions) {
        this.description = description;
    }

    /**
     * Execute this filter, and get a possible action to perform.
     * @returns A possible infraction, if content was filtered
     */
    public async execute(options: ModerationFilterData): Promise<ModerationFilterActionData | null> {
        const result = await this.filter(options);
        if (result === null) return null;
        
        return {
            ...result, action: this.id
        };
    }

    /**
     * Callback, that gets set by the specific filters to apply rules
     */
    public filter({ content, db }: ModerationFilterData): Awaitable<ModerationFilterAction | null>;

    /* Stub filter */
    public async filter() { return null; }

    public get id(): string {
        return this.description.toLowerCase().replaceAll(" ", "-");
    }
}

export class ModerationWordFilter extends ModerationFilter {
    /* Words / RegEx's to block */
    private readonly blocked: (ModerationFilterWord & Required<Pick<ModerationFilterWord, "allowed">>)[];

    /* Default action to execute, if no other was specified */
    private readonly action: ModerationFilterAction;

    /* Replacements using for the normalize() function */
    private readonly replacements: Map<RegExp, string>;

    constructor({ description, blocked, action }: ModerationFilterWordOptions) {
        super({ description });

        this.blocked = blocked.map(({ words, action, allowed }) => ({
            words, action,
            allowed: allowed ?? []
        }));

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

    private matches(filter: ModerationFilterWord, input: string): boolean {
        return filter.words.some(w => {
            if (filter.allowed!.some(w => typeof w === "string" ? input.includes(w) : input.match(w) !== null)) return false;
            return typeof w === "string" ? input.includes(w) : input.match(w) !== null;
        });
    }

    public async filter({ content }: ModerationFilterData): Promise<ModerationFilterAction | null> {
        /* Which word was flagged by the filters, if any */
        let flagged: ModerationFilterWord | null = null;
        const cleaned: string = this.normalize(content);

        for (const wordFilter of this.blocked) {
            /* Whether the input message contains this word */
            const matches: boolean = this.matches(wordFilter, cleaned);

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
			.replace(/ +(?= )/g, "")      /* Replace anywhere, where there are more than 2 consecutive spaces. */
			.replace(/[^a-zA-Z\s]/g, ""); /* Remove non-alphabetical characters. */
	}
}

class DeveloperModerationFilter extends ModerationFilter {
    constructor() {
        super({
            description: "Development filter"
        });
    }

    public async filter({ bot, content }: ModerationFilterData): Promise<ModerationFilterAction | null> {
        if (!bot.dev) return null;

        /* Types of actions to take */
        const types: ModerationFilterActionType[] = [ "ban", "warn", "block", "flag" ];

        const parts: string[] = content.split(":");
        if (parts.length === 1 || parts[0] !== "testFlag") return null;

        const type: string = parts[parts.length - 1];
        if (!types.includes(type as ModerationFilterActionType)) return null;

        return {
            type: type as ModerationFilterActionType,
            reason: "Development test flag"
        };
    }
}

class TuringModerationFilter extends ModerationFilter {
    constructor() {
        super({
            description: "Turing API filter"
        });
    }

    public async filter({ bot, content, source }: ModerationFilterData): Promise<ModerationFilterAction | null> {
        if (source !== "image" && source !== "video" && source !== "music") return null;

        const data = await bot.turing.filter(content, [ "nsfw", "cp", "toxicity" ]);
        if (data === null) return null;

        if (data.nsfw || data.toxic) return { type: "flag", reason: "Automatic filter" };
        if (data.cp || data.youth) return { type: "block", reason: "Automatic filter" };

        return null;
    }
}

export const ModerationFilters: ModerationFilter[] = [
    new ModerationWordFilter({
        description: "Block pedophilia words",
        action: { type: "ban", reason: "Sexual content involving children" },

        blocked: [
            { words: [ "child porn", "i love cp", "send cp", "i love child porn", "where can i get child porn", "get child porn", "love child porn", "love cp", "watching child porn", "pornografia infantil", "children porn", "infant porn", "children sex", "child sex", "infant sex", "childporn", "childsex", "childrensex" ] },
            { words: [ "loli" ], allowed: [ "hololive" ], action: { reason: "Content involving underage characters", type: "block" } }
        ]
    }),

    new ModerationWordFilter({
        description: "Block weird words",
        action: { type: "block" },

        blocked: [
            { words: [ "incest"   ], action: { reason: "Incest-related content", type: "block"  } },
            { words: [ "futanari" ], action: { reason: "Weird content", type: "block" }          }
        ]
    }),

    new ModerationWordFilter({
        description: "Block racist words",
        action: { reason: "Racist content", type: "block" },

        blocked: [
            { words: [ "nigger", "n i g g e r", "black african monkey", "african monkey", "kike", "raghead", "wetback", "zipperhead", "slant eye", "porch monkey", "camel jockey", "sand nigger", "pickaninny", "jungle bunny", "tar baby" ] }
        ]
    }),

    new ModerationWordFilter({
        description: "Block homophobic words",
        action: { reason: "Homophobic content", type: "block" },

        blocked: [
            { words: [ "trannie", "tranny", "faggot", "fagget" ] }
        ]
    }),

    new DeveloperModerationFilter(),
    new TuringModerationFilter( )
]