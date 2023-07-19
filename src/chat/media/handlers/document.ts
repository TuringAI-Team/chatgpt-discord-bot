import { ChatMediaHandler, ChatMediaHandlerHasOptions, ChatMediaHandlerRunOptions } from "../handler.js";
import { ChatDocument, ChatDocumentExtractors } from "../types/document.js";
import { ChatMediaType } from "../types/media.js";
import { ChatClient } from "../../client.js";

export class DocumentChatHandler extends ChatMediaHandler<ChatDocument> {
    constructor(client: ChatClient) {
        super(client, {
            type: ChatMediaType.Documents, message: "Viewing your documents"
        });
    }

    public has(options: ChatMediaHandlerHasOptions): boolean {
        for (const extractor of ChatDocumentExtractors) {
            const condition: boolean = extractor.condition(options.message);
            if (condition) return true;
        }

        return false;
    }

    public async run(options: ChatMediaHandlerRunOptions): Promise<ChatDocument[]> {
        const total: ChatDocument[] = [];

        for (const extractor of ChatDocumentExtractors) {
            const condition: boolean = extractor.condition(options.message);
            if (!condition) continue;

            const results: ChatDocument[] | null = await extractor.extract(options.message);
            if (results === null || results.length === 0) continue;

            total.push(...results);
        }

        return total;
    }

    public prompt(document: ChatDocument): string {
        return `[Document = name "${document.name}": """\n${document.content}\n"""]`;
    }

    public initialPrompt(): string {
        return `
To attach text documents, users may use the format: '[Document <document type> #<index> = <file name>: """<file content>"""]'.
You must incorporate the content of the attached documents as if the user directly included them in their message, but you may answer follow-up questions about the document appropriately.
You must pretend to "view" these text attachments, do not talk about the format used.
`;
    }
}