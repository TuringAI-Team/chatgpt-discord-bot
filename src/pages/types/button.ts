import { ButtonBuilder } from 'discord.js';

export enum ActionLabel {
    FIRST = '⏪',
    BACK = '◀️',
    STOP = '⏹',
    NEXT = '▶️',
    LAST = '⏩'
}
export type ActionLabelUnion = `${ActionLabel}`;

export enum Action {
    FIRST = 'first',
    BACK = 'back',
    STOP = 'stop',
    NEXT = 'next',
    LAST = 'last'
}
export type ActionUnion = `${Action}`;
export type ActionObject = {
    [key in Action | ActionUnion]: ButtonBuilder;
};

export type Button = Action | ActionUnion | ActionObject;
