import React, { useMemo } from "react";
import {
	BuiltinActionType,
	Renderer,
	type ActionEvent,
} from "@openuidev/react-lang";
import { createComponentLibrary } from "./index";
import { MarkdownMessage } from "@/main/modules/chat/components/MarkdownMessage";
import { logError, logWarn } from "@/utils/logger";
import type { OpenUITheme } from "@/services/flows/steps/features/visualize-response";

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

const handleOpenUIAction = (event: ActionEvent) => {
	if (event.type === BuiltinActionType.OpenUrl) {
		const url = event.params.url;
		if (typeof url === "string" && url.trim()) {
			window.open(url, "_blank", "noopener,noreferrer");
		}
		return;
	}

	if (event.type === BuiltinActionType.ContinueConversation) {
		window.dispatchEvent(
			new CustomEvent("memorall:openui-action", { detail: event }),
		);
		return;
	}

	logWarn("[OpenUIRenderer] Unhandled action:", event);
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

	return (
		<OpenUIErrorBoundary content={content}>
			<Renderer
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
