import React from "react";
import { LogOut, Maximize2, MessageCircle, Send, X } from "lucide-react";
import { AgentIcon } from "@/components/AgentIcon";
import { EmbeddedMarkdown } from "@/embedded/components/EmbeddedMarkdown";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";

interface CoAgentDockProps {
	collapsed: boolean;
	showAuthAction: boolean;
	visibleSpeechMessage: string;
	isSubmitting: boolean;
	promptOpen: boolean;
	inputValue: string;
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
	modelAvailable: boolean;
	onExpand: () => void;
	onOpenPrompt: () => void;
	onClosePrompt: () => void;
	onChangeInput: (value: string) => void;
	onSubmitPrompt: (event: React.FormEvent<HTMLFormElement>) => void;
	onOpenConversation: () => void;
	onUnlock: () => void;
	onLeaveCoAgent: () => void;
	onDismissBubble: () => void;
}

export const CoAgentDock: React.FC<CoAgentDockProps> = ({
	collapsed,
	showAuthAction,
	visibleSpeechMessage,
	isSubmitting,
	promptOpen,
	inputValue,
	inputRef,
	modelAvailable,
	onExpand,
	onOpenPrompt,
	onClosePrompt,
	onChangeInput,
	onSubmitPrompt,
	onOpenConversation,
	onUnlock,
	onLeaveCoAgent,
	onDismissBubble,
}) => {
	const t = useEmbeddedTranslation("coAgent");
	const idleHints = React.useMemo(
		() => [
			t("idleHintAnchor"),
			t("idleHintSummarize"),
			t("idleHintFind"),
			t("idleHintAct"),
		],
		[t],
	);
	const [idleHintIndex, setIdleHintIndex] = React.useState(() =>
		Math.floor(Math.random() * 4),
	);
	const [showIdleHint, setShowIdleHint] = React.useState(false);
	const idleHint = idleHints[idleHintIndex] ?? idleHints[0];
	const showingStatusMessage = Boolean(visibleSpeechMessage);
	const visibleDockMessage =
		visibleSpeechMessage ||
		(showIdleHint && !promptOpen && !showAuthAction ? idleHint : "");
	const activateIcon = () => {
		if (collapsed) {
			onExpand();
		}
	};

	React.useEffect(() => {
		if (visibleSpeechMessage || promptOpen || showAuthAction) {
			setShowIdleHint(false);
			return;
		}

		let hideTimer: number | null = null;
		const showTimer = window.setTimeout(
			() => {
				setIdleHintIndex((current) => {
					if (idleHints.length <= 1) return 0;
					let next = Math.floor(Math.random() * idleHints.length);
					if (next === current) next = (next + 1) % idleHints.length;
					return next;
				});
				setShowIdleHint(true);
				hideTimer = window.setTimeout(() => {
					setShowIdleHint(false);
				}, 6200);
			},
			1800 + Math.random() * 2200,
		);

		const interval = window.setInterval(
			() => {
				setIdleHintIndex((current) => {
					if (idleHints.length <= 1) return 0;
					let next = Math.floor(Math.random() * idleHints.length);
					if (next === current) next = (next + 1) % idleHints.length;
					return next;
				});
				setShowIdleHint(true);
				if (hideTimer !== null) window.clearTimeout(hideTimer);
				hideTimer = window.setTimeout(() => {
					setShowIdleHint(false);
				}, 6200);
			},
			15000 + Math.random() * 5000,
		);

		return () => {
			window.clearTimeout(showTimer);
			window.clearInterval(interval);
			if (hideTimer !== null) window.clearTimeout(hideTimer);
		};
	}, [idleHints.length, promptOpen, showAuthAction, visibleSpeechMessage]);

	return (
		<div
			className={`memorall-co-agent-root ${
				collapsed ? "memorall-co-agent-root--collapsed" : ""
			}`}
		>
			<div className="memorall-co-agent-dock">
				<div
					className="memorall-co-agent-icon"
					role="button"
					tabIndex={0}
					aria-label={collapsed ? t("expandCoAgent") : t("coAgentActions")}
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
						ambientScreenContent={{
							value: collapsed ? "?" : "AI",
							kind: "text",
							scale: collapsed ? 0.78 : 0.64,
						}}
						speechBubble={
							visibleDockMessage
								? {
										message: visibleDockMessage,
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
														if (showingStatusMessage) {
															onDismissBubble();
														} else {
															setShowIdleHint(false);
														}
													}}
												>
													<X size={15} strokeWidth={2.4} />
												</button>
												<EmbeddedMarkdown
													content={visibleDockMessage}
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
			{!collapsed && !showAuthAction ? (
				<div
					className="memorall-co-agent-actions"
					aria-label={t("coAgentActions")}
				>
					<button
						type="button"
						className="memorall-co-agent-action"
						aria-label={promptOpen ? t("hideChatInput") : t("showChatInput")}
						title={promptOpen ? t("hideChatInput") : t("showChatInput")}
						onClick={promptOpen ? onClosePrompt : onOpenPrompt}
					>
						<MessageCircle size={15} strokeWidth={2.25} />
						<span className="memorall-co-agent-action-tooltip">
							{promptOpen ? t("hideChatInput") : t("showChatInput")}
						</span>
					</button>
					<button
						type="button"
						className="memorall-co-agent-action"
						aria-label={t("showFullMessage")}
						title={t("showFullMessage")}
						onClick={onOpenConversation}
					>
						<Maximize2 size={15} strokeWidth={2.25} />
						<span className="memorall-co-agent-action-tooltip">
							{t("showFullMessage")}
						</span>
					</button>
					<button
						type="button"
						className="memorall-co-agent-action memorall-co-agent-action--danger"
						aria-label={t("leaveCoAgentMode")}
						title={t("leaveCoAgentMode")}
						onClick={onLeaveCoAgent}
					>
						<LogOut size={15} strokeWidth={2.25} />
						<span className="memorall-co-agent-action-tooltip">
							{t("leaveCoAgentMode")}
						</span>
					</button>
				</div>
			) : null}
			{promptOpen && !collapsed && !showAuthAction ? (
				<form
					className="memorall-co-agent-dock-prompt"
					onSubmit={onSubmitPrompt}
				>
					<textarea
						ref={inputRef}
						value={inputValue}
						onChange={(event) => onChangeInput(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								event.preventDefault();
								onClosePrompt();
								return;
							}
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								event.currentTarget.form?.requestSubmit();
							}
						}}
						placeholder={
							modelAvailable
								? t("askAboutThisPlaceholder")
								: t("noModelAvailable")
						}
						disabled={!modelAvailable || isSubmitting}
						rows={1}
					/>
					<button
						type="submit"
						aria-label={t("send")}
						title={t("send")}
						disabled={!inputValue.trim() || !modelAvailable || isSubmitting}
					>
						<Send size={15} strokeWidth={2.2} />
					</button>
				</form>
			) : null}
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
