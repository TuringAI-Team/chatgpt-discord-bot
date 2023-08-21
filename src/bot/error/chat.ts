export enum ChatErrorType {
	/** The chat input is too long */
	Length
}

export class ChatError extends Error {
	/** Which error occurred */
	public readonly type: ChatErrorType;

	constructor(type: ChatErrorType) {
		super(`Chat error -> ${ChatErrorType[type]}`);
		this.type = type;
	}
}