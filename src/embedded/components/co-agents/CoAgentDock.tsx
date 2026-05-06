import React from "react";
import { MessageSquare, X } from "lucide-react";
import { AgentIcon } from "@/components/AgentIcon";
import { EmbeddedMarkdown } from "@/embedded/components/EmbeddedMarkdown";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";

interface CoAgentDockProps {
	collapsed: boolean;
	showAuthAction: boolean;
	visibleSpeechMessage: string;
	isSubmitting: boolean;
	canOpenPrompt: boolean;
	onExpand: () => void;
	onOpenPrompt: () => void;
	onOpenConversation: () => void;
	onUnlock: () => void;
	onDismissBubble: () => void;
}

export const CoAgentDock: React.FC<CoAgentDockProps> = ({
	collapsed,
	showAuthAction,
	visibleSpeechMessage,
	isSubmitting,
	canOpenPrompt,
	onExpand,
	onOpenPrompt,
	onOpenConversation,
	onUnlock,
	onDismissBubble,
}) => {
	const t = useEmbeddedTranslation("coAgent");
	const activateIcon = () => {
		if (collapsed) {
			onExpand();
			return;
		}
		if (canOpenPrompt) onOpenPrompt();
	};

	return (
		<div
			className={`memorall-co-agent-root ${
				collapsed ? "memorall-co-agent-root--collapsed" : ""
			}`}
		>
			<div className="memorall-co-agent-dock">
				<button
					type="button"
					className="memorall-co-agent-conversation-button"
					aria-label={t("openFullConversation")}
					title={t("openFullConversation")}
					onClick={onOpenConversation}
				>
					<MessageSquare size={17} strokeWidth={2.25} />
				</button>
				<div
					className="memorall-co-agent-icon"
					role="button"
					tabIndex={0}
					aria-label={collapsed ? t("expandCoAgent") : t("openCoAgentPrompt")}
					onClick={activateIcon}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						activateIcon();
					}}
				>
					<AgentIcon
						size={54}
						reactive
						speechBubble={
							visibleSpeechMessage
								? {
										message: visibleSpeechMessage,
										tone: showAuthAction ? "thinking" : "neutral",
										placement: "top",
										variant: "manga",
										renderContent: (
											<div className="memorall-co-agent-bubble-content">
												<button
													type="button"
													className="memorall-co-agent-bubble-close"
													aria-label={t("closeBubble")}
													title={t("closeBubble")}
													onClick={(event) => {
														event.stopPropagation();
														onDismissBubble();
													}}
												>
													<X size={15} strokeWidth={2.4} />
												</button>
												<EmbeddedMarkdown
													content={visibleSpeechMessage}
													isStreaming={isSubmitting}
												/>
											</div>
										),
									}
								: undefined
						}
					/>
				</div>
			</div>
			{!collapsed && showAuthAction ? (
				<button
					type="button"
					className="memorall-co-agent-auth"
					onClick={onUnlock}
				>
					{t("unlockExtension")}
				</button>
			) : null}
		</div>
	);
};
