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

// ==================== COMPLEX CONTENT ====================

/** Text part of a complex (multipart) message */
export interface ComplexContentPartText {
	type: "text";
	text: string;
}

/** Image part of a complex (multipart) message — stores path in document-fs, not raw bytes */
export interface ComplexContentPartImage {
	type: "image";
	/** Path in document filesystem (e.g. /home/images/<uuid>.png) */
	path: string;
	mimeType: string;
}

export type ComplexContentPart =
	| ComplexContentPartText
	| ComplexContentPartImage;

/** Stored in messages.complexContent (jsonb) when the message has multipart content */
export type ComplexContent = ComplexContentPart[];

/** A skill selected from the mention popup — content is injected directly into the message */
export interface AttachedSkillRef {
	name: string;
	description: string;
}

/** A reference to a file already stored in the document filesystem */
export interface AttachedDocumentRef {
	/** Relative path in document filesystem (e.g. /myphoto.png) */
	path: string;
	mimeType: string;
	name: string;
	/** Document type — determines how the file is sent to the LLM */
	docType: "pdf" | "text" | "markdown" | "image" | "excel" | "other";
}
