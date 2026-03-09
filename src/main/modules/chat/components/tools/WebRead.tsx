import React from "react";
import { useTranslation } from "react-i18next";
import { Globe, FileText, ExternalLink } from "lucide-react";
import type { ActionRenderer } from "@/main/modules/chat/components/types";
import type { MessageActionItem } from "@/main/modules/chat/components/types";

interface WebReadPayload {
	url: string;
	requestedUrl?: string;
	html?: string;
	text?: string;
	title?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const extractWebReadPayload = (item: MessageActionItem): WebReadPayload | null => {
	const fromMetadata = item.metadata;
	if (fromMetadata && typeof fromMetadata.url === "string") {
		return {
			requestedUrl:
				typeof fromMetadata.requestedUrl === "string"
					? fromMetadata.requestedUrl
					: undefined,
			url: fromMetadata.url,
			html: typeof fromMetadata.html === "string" ? fromMetadata.html : undefined,
			text: typeof fromMetadata.text === "string" ? fromMetadata.text : undefined,
			title: typeof fromMetadata.title === "string" ? fromMetadata.title : undefined,
		};
	}

	try {
		const parsed = JSON.parse(item.description);
		if (!isRecord(parsed) || typeof parsed.url !== "string") {
			return null;
		}
		return {
			requestedUrl:
				typeof parsed.requestedUrl === "string" ? parsed.requestedUrl : undefined,
			url: parsed.url,
			html: typeof parsed.html === "string" ? parsed.html : undefined,
			text: typeof parsed.text === "string" ? parsed.text : undefined,
			title: typeof parsed.title === "string" ? parsed.title : undefined,
		};
	} catch {
		return null;
	}
};

const isTextPayload = (payload: WebReadPayload): boolean =>
	!!payload.text && !payload.html;

export const webReadRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;
	const payload = extractWebReadPayload(item);
	const { t } = useTranslation("chat");
	if (!payload) {
		return (
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
		);
	}

	const displayUrl = payload.url || payload.requestedUrl || "";
	const htmlContent = payload.html?.trim() || "";

	return (
		<div className="w-full rounded-lg border border-border/60 overflow-hidden bg-background">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 text-xs">
				<Globe className="w-4 h-4 text-muted-foreground shrink-0" />
				<div className="flex-1 font-mono truncate">
					{payload.title ? `${payload.title} • ` : ""}
					{displayUrl}
				</div>
				<button
					type="button"
					title="Open in new tab"
					className="text-muted-foreground hover:text-foreground shrink-0"
					onClick={() => {
						if (!displayUrl) return;
						chrome.tabs.create({ url: displayUrl });
					}}
				>
					<ExternalLink className="w-3.5 h-3.5" />
				</button>
			</div>
			{htmlContent ? (
				<iframe
					title={t("actions.webRead.iframeTitle", {
						defaultValue: "web_read HTML preview",
					})}
					srcDoc={htmlContent}
					className="w-full h-[360px] bg-white"
					sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
				/>
			) : (
				<pre className="max-h-[360px] overflow-auto p-3 text-xs whitespace-pre-wrap break-words bg-muted/20">
					{payload.text || t("actions.webRead.emptyText", {
						defaultValue: "No readable HTML/text found.",
					})}
				</pre>
			)}
			{isTextPayload(payload) ? null : (
				<div className="px-3 py-2 text-xs text-muted-foreground border-t border-border/60">
					{t("actions.webRead.textFallback", {
						defaultValue: "Text preview",
					})}
					:{" "}
					<span className="font-mono">{payload.text?.slice(0, 200) ?? "—"}</span>
				</div>
			)}
		</div>
	);
};
