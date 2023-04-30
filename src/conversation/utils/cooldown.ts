import { EventEmitter } from "events";

export interface CooldownOptions {
    /* How long the cooldown takes to expire */
    time: number;
}

export interface CooldownState {
    active: boolean;

    startedAt: number | null;
    expiresIn: number | null;
}

export interface CooldownModifier {
    /* Straight-forward duration of the cool-down, in milliseconds */
    time?: number;

    /* Multiplier modifier of the default cooldown */
    multiplier?: number;
}

export class Cooldown extends EventEmitter {
    /* Information about the cooldown */
    public readonly options: CooldownOptions;

    /* Whether the cooldown is active */
    public state: CooldownState;

    /* Timer for the cooldown */
    private timer: NodeJS.Timeout | null;

    constructor(options: CooldownOptions) {
        super();
        this.options = options;

        this.state = { active: false, startedAt: null, expiresIn: null };
        this.timer = null;
    }
    
    /**
     * Activate the cooldown.
     * @param time Expiration time override to use
     * 
     * @returns When the cooldown expires
     */
    public use(time?: number): number {
        /* Set up the time-out. */
        this.timer = setTimeout(() => {
            this.state = {
                active: false,

                startedAt: null,
                expiresIn: null
            };

        }, time ?? this.options.time);

        this.state = {
            active: true,

            startedAt: Date.now(),  
            expiresIn: (time ?? this.options.time)
        };

        return this.state.expiresIn!;
    }

    public get active(): boolean {
        return this.state && this.state.active;
    }

    public get remaining(): number {
        if (!this.state.active) return -1;
        return this.state.startedAt! + (this.state.expiresIn!) - Date.now();
    }

    /**
     * Cancel the currently running cooldown, if there is any in the first place.
     * @returns Whether a cool-down was stopped
     */
    public cancel(): boolean {
        /* Whether a cool-down is currently active. */
        const active: boolean = this.state.active;
        if (!active) return false;

        /* Stop the cool-down. */
        this.state = {
            active: false,

            startedAt: null,
            expiresIn: null
        };

        clearTimeout(this.timer!);
        return true;
    }
}