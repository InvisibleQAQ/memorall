import React from "react";
import type { ChatMessage } from "@/embedded/types";
import {
	getEmbeddedTranslation,
	useEmbeddedTranslation,
} from "@/embedded/hooks/use-embedded-language";
import {
	translateActionName,
	formatJsonPreview,
	getToolCallSummary,
} from "./utils";

export const EmbeddedToolSummaries: React.FC<{
	message: ChatMessage;
}> = ({ message }) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const { actions: actionTranslations } =
		getEmbeddedTranslation("messageRenderer");
	const actions = message.metadata?.actions || [];
	const toolCalls = message.metadata?.tool_calls || [];
	const executeState = message.metadata?.executeState;

	if (!actions.length && !toolCalls.length && !executeState) {
		return null;
	}

	return (
		<div className="memorall-tool-summary-list">
			{executeState?.node && (
				<div className="memorall-tool-summary">
					<div className="memorall-tool-summary-main">
						<span className="memorall-tool-summary-dot memorall-tool-summary-dot--active" />
						<span className="memorall-tool-summary-title">
							{translateActionName(executeState.node, actionTranslations)}
						</span>
						<span className="memorall-tool-summary-status">{t("running")}</span>
					</div>
					{executeState.metadata && (
						<div className="memorall-tool-summary-description">
							{formatJsonPreview(executeState.metadata)}
						</div>
					)}
				</div>
			)}

			{actions.map((action, index) => (
				<div className="memorall-tool-summary" key={`${action.id}-${index}`}>
					<div className="memorall-tool-summary-main">
						<span className="memorall-tool-summary-dot" />
						<span className="memorall-tool-summary-title">
							{translateActionName(action.name, actionTranslations)}
						</span>
						<span className="memorall-tool-summary-status">{t("done")}</span>
					</div>
					{action.description && (
						<div className="memorall-tool-summary-description">
							{action.description}
						</div>
					)}
				</div>
			))}

			{toolCalls.map((toolCall, index) => {
				const summary = getToolCallSummary(toolCall, index);
				const title = summary.name || t("toolLabel", { index: index + 1 });
				return (
					<details className="memorall-tool-summary" key={summary.id}>
						<summary className="memorall-tool-summary-main">
							<span className="memorall-tool-summary-dot" />
							<span className="memorall-tool-summary-title">{title}</span>
							<span className="memorall-tool-summary-status">
								{t("toolCall")}
							</span>
						</summary>
						{summary.argumentsText && (
							<pre className="memorall-tool-summary-code">
								{summary.argumentsText}
							</pre>
						)}
					</details>
				);
			})}
		</div>
	);
};
