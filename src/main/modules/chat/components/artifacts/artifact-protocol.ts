export const MEMORALL_ARTIFACT_TAG = "memorall_artifact";
export const MEMORALL_ARTIFACT_OPEN = `<${MEMORALL_ARTIFACT_TAG}`;
export const MEMORALL_ARTIFACT_CLOSE = `</${MEMORALL_ARTIFACT_TAG}>`;

export const ARTIFACT_TYPES = ["html", "url"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export type MessageContentSegment =
	| { kind: "text"; text: string }
	| {
			kind: "artifact";
			type: ArtifactType;
			content: string;
			title?: string;
	  };

const DEFAULT_ARTIFACT_TYPE: ArtifactType = "html";

const isArtifactType = (value: string | undefined): value is ArtifactType =>
	ARTIFACT_TYPES.includes(value as ArtifactType);

const decodeAttributeValue = (value: string): string =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");

const parseArtifactAttributes = (source: string): Record<string, string> => {
	const attrs: Record<string, string> = {};
	const attrPattern = /([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
	let match: RegExpExecArray | null;

	while ((match = attrPattern.exec(source)) !== null) {
		attrs[match[1]] = decodeAttributeValue(match[2] ?? match[3] ?? "");
	}

	return attrs;
};

/**
 * Parses Memorall's assistant-message artifact protocol.
 *
 * Artifacts deliberately live in assistant message content, not tool results.
 * During streaming, incomplete trailing artifact tags are hidden until the
 * closing tag arrives so users never see raw protocol markup flicker.
 */
export const parseArtifactSegments = (
	content: string,
): MessageContentSegment[] => {
	const segments: MessageContentSegment[] = [];
	let cursor = 0;

	while (cursor < content.length) {
		const openIdx = content.indexOf(MEMORALL_ARTIFACT_OPEN, cursor);
		if (openIdx === -1) {
			segments.push({ kind: "text", text: content.slice(cursor) });
			break;
		}

		if (openIdx > cursor) {
			segments.push({ kind: "text", text: content.slice(cursor, openIdx) });
		}

		const openEnd = content.indexOf(">", openIdx);
		if (openEnd === -1) {
			break;
		}

		const closeIdx = content.indexOf(MEMORALL_ARTIFACT_CLOSE, openEnd + 1);
		if (closeIdx === -1) {
			break;
		}

		const attrs = parseArtifactAttributes(
			content.slice(openIdx + MEMORALL_ARTIFACT_OPEN.length, openEnd),
		);
		segments.push({
			kind: "artifact",
			type: isArtifactType(attrs.type) ? attrs.type : DEFAULT_ARTIFACT_TYPE,
			content: content.slice(openEnd + 1, closeIdx),
			title: attrs.title,
		});

		cursor = closeIdx + MEMORALL_ARTIFACT_CLOSE.length;
	}

	return segments;
};
