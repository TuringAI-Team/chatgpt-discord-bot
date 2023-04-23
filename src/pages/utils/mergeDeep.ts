import { isObject } from './isObject.js';

export function mergeDeep(target: Record<any, any>, ...sources: Record<any, any>[]): Record<any, any> {
    if (!sources.length) {
        return target;
    }

    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            const targetField = target[key];
            const sourceField = source[key];

            if (isObject(sourceField)) {
                if (!targetField) {
                    Object.assign(target, {
                        [key]: {}
                    });
                }

                mergeDeep(target[key], sourceField);
            } else if (Array.isArray(sourceField)) {
                Object.assign(target, {
                    [key]: [...(targetField || []), ...sourceField]
                });
            } else {
                Object.assign(target, {
                    [key]: sourceField
                });
            }
        }
    }

    return mergeDeep(target, ...sources);
}
