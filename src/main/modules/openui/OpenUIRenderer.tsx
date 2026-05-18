import React, { useCallback, useMemo, useState } from "react";
import { Renderer, type ActionEvent } from "@openuidev/react-lang";
import { createComponentLibrary } from "./index";
import { MarkdownMessage } from "@/main/modules/chat/components/MarkdownMessage";
import { logError, logWarn } from "@/utils/logger";
import type { OpenUITheme } from "@/services/flows/steps/features/visualize-response";
import {
	dispatchMemorallOpenUIAction,
	isSafeOpenUIUrl,
	parseMemorallOpenUIAction,
	resolveOpenUITemplate,
} from "./actions";

// Theme is the 4th positional arg in: CardBlock("title", "desc", [...], "theme")
const THEME_PATTERN = /\bCardBlock\s*\([\s\S]*?\]\s*,\s*"([^"]+)"\s*\)/;
const KNOWN_THEMES = new Set<OpenUITheme>(["shadcn", "wireframe", "glass"]);

function detectTheme(content: string): OpenUITheme {
	const match = THEME_PATTERN.exec(content);
	if (match) {
		const t = match[1] as OpenUITheme;
		if (KNOWN_THEMES.has(t)) return t;
	}
	return "shadcn";
}

class OpenUIErrorBoundary extends React.Component<
	{ content: string; children: React.ReactNode },
	{ hasError: boolean }
> {
	state = { hasError: false };

	static getDerivedStateFromError() {
		return { hasError: true };
	}

	componentDidCatch(error: unknown) {
		logError("[OpenUIRenderer] Render failed:", error);
	}

	componentDidUpdate(previousProps: { content: string }) {
		if (previousProps.content !== this.props.content && this.state.hasError) {
			this.setState({ hasError: false });
		}
	}

	render() {
		if (this.state.hasError) {
			return <MarkdownMessage>{this.props.content}</MarkdownMessage>;
		}
		return this.props.children;
	}
}

const showOpenUINotice = (message: string) => {
	const existing = document.querySelector("[data-openui-notice]");
	existing?.remove();
	const el = document.createElement("div");
	el.dataset.openuiNotice = "true";
	el.textContent = message;
	el.className =
		"fixed bottom-5 left-1/2 z-[9999] -translate-x-1/2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-lg";
	document.body.appendChild(el);
	window.setTimeout(() => el.remove(), 2200);
};

export function OpenUIRenderer({
	content,
	streaming,
}: {
	content: string;
	streaming: boolean;
}) {
	const theme = useMemo(() => detectTheme(content), [content]);
	const library = useMemo(() => createComponentLibrary(theme), [theme]);
	const [resetKey, setResetKey] = useState(0);

	const handleOpenUIAction = useCallback((event: ActionEvent) => {
		const detail = parseMemorallOpenUIAction(event);
		if (!detail) {
			logWarn("[OpenUIRenderer] Unhandled action:", event);
			return;
		}

		const action = detail.action;

		if (action.type === "open_link") {
			const url = resolveOpenUITemplate(
				action.url,
				detail.formState,
				detail.formName,
			).trim();
			if (isSafeOpenUIUrl(url)) {
				window.open(url, "_blank", "noopener,noreferrer");
			} else {
				logWarn("[OpenUIRenderer] Blocked unsafe URL:", url);
			}
			return;
		}

		if (action.type === "copy_to_clipboard") {
			const text = resolveOpenUITemplate(
				action.text,
				detail.formState,
				detail.formName,
			);
			void navigator.clipboard?.writeText(text).then(
				() => showOpenUINotice("Copied"),
				(error) => logWarn("[OpenUIRenderer] Clipboard copy failed:", error),
			);
			return;
		}

		if (action.type === "download_text") {
			const filename =
				resolveOpenUITemplate(
					action.filename,
					detail.formState,
					detail.formName,
				).trim() || "download.txt";
			const blob = new Blob(
				[
					resolveOpenUITemplate(
						action.content,
						detail.formState,
						detail.formName,
					),
				],
				{ type: "text/plain;charset=utf-8" },
			);
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);
			return;
		}

		if (action.type === "reset_form") {
			setResetKey((value) => value + 1);
			return;
		}

		if (action.type === "show_toast") {
			showOpenUINotice(
				resolveOpenUITemplate(
					action.message,
					detail.formState,
					detail.formName,
				),
			);
			return;
		}

		dispatchMemorallOpenUIAction(detail);
	}, []);

	return (
		<OpenUIErrorBoundary content={content}>
			<Renderer
				key={resetKey}
				response={content}
				library={library}
				isStreaming={streaming}
				onAction={handleOpenUIAction}
				onError={(errors) => {
					if (errors.length > 0) {
						logWarn("[OpenUIRenderer] Parse/runtime errors:", errors);
					}
				}}
			/>
		</OpenUIErrorBoundary>
	);
}
