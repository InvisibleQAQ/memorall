export type ChatStatus = "ready" | "submitted" | "streaming" | "error";

export type ChatRole = "user" | "assistant" | "system";

export type ToolState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error";

export type GeneratedImage = {
	base64: string;
	uint8Array: Uint8Array;
	mediaType: string;
};
