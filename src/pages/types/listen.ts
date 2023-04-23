export interface ResetListenTimeoutOptions {
    isFirstBuild?: boolean;
}

export enum EndMethod {
    NONE = 'none',
    EDIT = 'edit',
    DELETE = 'delete',
    REMOVE_COMPONENTS = 'remove_components',
    REMOVE_EMBEDS = 'remove_embeds'
}
export type EndMethodUnion = `${EndMethod}`;
