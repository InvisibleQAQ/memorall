export const MEMORALL_ARTIFACT_TAG = "memorall_artifact";
export const MEMORALL_ARTIFACT_OPEN = `<${MEMORALL_ARTIFACT_TAG}`;
export const MEMORALL_ARTIFACT_CLOSE = `</${MEMORALL_ARTIFACT_TAG}>`;
export const STANDARD_ARTIFACT_TAG = "artifact";
export const STANDARD_ARTIFACT_OPEN = `<${STANDARD_ARTIFACT_TAG}`;
export const STANDARD_ARTIFACT_CLOSE = `</${STANDARD_ARTIFACT_TAG}>`;

export const ARTIFACT_TYPES = ["html", "url"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export type MessageContentSegment =
	| { kind: "text"; text: string }
	| {
			kind: "artifact";
			type: ArtifactType;
			content: string;
			identifier?: string;
			title?: string;
	  };

const DEFAULT_ARTIFACT_TYPE: ArtifactType = "html";

const isArtifactType = (value: string | undefined): value is ArtifactType =>
	ARTIFACT_TYPES.includes(value as ArtifactType);

const normalizeArtifactType = (value: string | undefined): ArtifactType => {
	switch (value) {
		case "text/html":
		case "html":
			return "html";
		case "text/uri-list":
		case "url":
			return "url";
		default:
			return isArtifactType(value) ? value : DEFAULT_ARTIFACT_TYPE;
	}
};

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
		const standardOpenIdx = content.indexOf(STANDARD_ARTIFACT_OPEN, cursor);
		const legacyOpenIdx = content.indexOf(MEMORALL_ARTIFACT_OPEN, cursor);
		const openIdx =
			standardOpenIdx === -1
				? legacyOpenIdx
				: legacyOpenIdx === -1
					? standardOpenIdx
					: Math.min(standardOpenIdx, legacyOpenIdx);

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

		const isLegacy = content.startsWith(MEMORALL_ARTIFACT_OPEN, openIdx);
		const openTag = isLegacy ? MEMORALL_ARTIFACT_OPEN : STANDARD_ARTIFACT_OPEN;
		const closeTag = isLegacy
			? MEMORALL_ARTIFACT_CLOSE
			: STANDARD_ARTIFACT_CLOSE;
		const closeIdx = content.indexOf(closeTag, openEnd + 1);
		if (closeIdx === -1) {
			break;
		}

		const attrs = parseArtifactAttributes(
			content.slice(openIdx + openTag.length, openEnd),
		);
		segments.push({
			kind: "artifact",
			type: normalizeArtifactType(attrs.type),
			content: content.slice(openEnd + 1, closeIdx),
			identifier: attrs.identifier,
			title: attrs.title,
		});

		cursor = closeIdx + closeTag.length;
	}

	return segments;
};
