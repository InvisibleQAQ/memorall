import type {
	ChatMessage,
	EmbeddedContextItem,
	EmbeddedContextKind,
} from "./types";

type EmbeddedContextDisplayType = "text" | "html" | "screenshot";

export const EMBEDDED_CONTEXT_KIND_CONFIG: Record<
	EmbeddedContextKind,
	{ tag: string; renderLabel: string; displayType: EmbeddedContextDisplayType }
> = {
	selection: {
		tag: "selected_text",
		renderLabel: "Selected Text",
		displayType: "text",
	},
	viewport: {
		tag: "viewport_content",
		renderLabel: "Visible Content",
		displayType: "text",
	},
	viewport_html: {
		tag: "viewport_html_structure",
		renderLabel: "Visible HTML",
		displayType: "html",
	},
	full_page: {
		tag: "full_page_content",
		renderLabel: "Page Text",
		displayType: "text",
	},
	full_page_html: {
		tag: "full_page_html_structure",
		renderLabel: "Page HTML",
		displayType: "html",
	},
	viewport_screenshot: {
		tag: "viewport_screenshot",
		renderLabel: "Viewport Screenshot",
		displayType: "screenshot",
	},
	screenshot: {
		tag: "screenshot",
		renderLabel: "Full Page Screenshot",
		displayType: "screenshot",
	},
	selected_image: {
		tag: "selected_image",
		renderLabel: "Selected Region",
		displayType: "screenshot",
	},
	smart_text: {
		tag: "smart_selected_text",
		renderLabel: "Smart Text",
		displayType: "text",
	},
	smart_clean_html: {
		tag: "smart_selected_clean_html",
		renderLabel: "Smart Clean HTML",
		displayType: "html",
	},
	smart_html: {
		tag: "smart_selected_html",
		renderLabel: "Smart HTML",
		displayType: "html",
	},
};

export const EMBEDDED_CONTEXT_TAG_CONFIG = Object.fromEntries(
	Object.entries(EMBEDDED_CONTEXT_KIND_CONFIG).map(([kind, config]) => [
		config.tag,
		{
			kind: kind as EmbeddedContextKind,
			renderLabel: config.renderLabel,
			displayType: config.displayType,
		},
	]),
) as Record<
	string,
	{
		kind: EmbeddedContextKind;
		renderLabel: string;
		displayType: EmbeddedContextDisplayType;
	}
>;

const generateContextId = (): string => {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `context-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createEmbeddedContextItem = (
	item: Omit<EmbeddedContextItem, "id"> & { id?: string },
): EmbeddedContextItem => ({
	id: item.id ?? generateContextId(),
	kind: item.kind,
	label: item.label,
	content: item.content,
});

export const isImageContextKind = (kind: EmbeddedContextKind): boolean =>
	kind === "viewport_screenshot" ||
	kind === "screenshot" ||
	kind === "selected_image";

export const buildEmbeddedContextMessageContent = ({
	userMessage,
	contexts,
	pageTitle,
	pageUrl,
}: {
	userMessage: string;
	contexts: EmbeddedContextItem[];
	pageTitle: string;
	pageUrl: string;
}): ChatMessage["content"] => {
	if (contexts.length === 0) {
		return userMessage;
	}

	const contextParts: string[] = [];
	const contentArray: Array<
		| { type: "text"; text: string }
		| {
				type: "image_url";
				image_url: { url: string; detail?: "low" | "high" | "auto" };
		  }
	> = [];

	contexts.forEach((context) => {
		const config = EMBEDDED_CONTEXT_KIND_CONFIG[context.kind];

		if (!config) {
			return;
		}

		if (context.kind === "viewport_screenshot") {
			contentArray.push({
				type: "image_url",
				image_url: { url: context.content, detail: "high" },
			});
			contextParts.push(
				`<${config.tag}>
Screenshot of the visible portion of the page is attached as an image.
</${config.tag}>`,
			);
			return;
		}

		if (context.kind === "screenshot") {
			const chunks = context.content.split("|||CHUNK|||");
			chunks.forEach((chunk) => {
				contentArray.push({
					type: "image_url",
					image_url: { url: chunk, detail: "high" },
				});
			});
			contextParts.push(
				`<${config.tag}>
Screenshot of the full page is attached as ${chunks.length} image${chunks.length > 1 ? "s" : ""} (split into chunks for readability).
</${config.tag}>`,
			);
			return;
		}

		if (context.kind === "selected_image") {
			contentArray.push({
				type: "image_url",
				image_url: { url: context.content, detail: "high" },
			});
			contextParts.push(
				`<${config.tag}>
A selected region from the page is attached as an image.
</${config.tag}>`,
			);
			return;
		}

		contextParts.push(
			`<${config.tag}>
${context.content}
</${config.tag}>`,
		);
	});

	const text = `${userMessage}

<context>
<website>
  <title>${pageTitle}</title>
  <url>${pageUrl}</url>
</website>
${contextParts.join("\n")}
</context>`;

	contentArray.unshift({ type: "text", text });
	return contentArray;
};
