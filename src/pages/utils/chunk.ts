export function chunk<T>(collection: T[], size: number): T[][] {
    const chunked: T[][] = [];

    for (let x = 0; x < Math.ceil(collection.length / size); x++) {
        const start = x * size;
        const end = start + size;

        chunked.push(
            collection.slice(start, end)
        );
    }

    return chunked;
}
