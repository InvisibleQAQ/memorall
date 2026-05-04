import React, { useEffect, useState } from "react";
import { ChevronRight, Send, X } from "lucide-react";
import { BACKGROUND_EVENTS } from "@/constants/events";
import { AgentCursorOverlay } from "@/components/AgentCursor";
import { AgentIcon } from "@/components/AgentIcon";
import { EmbeddedMarkdown } from "@/embedded/components/EmbeddedMarkdown";
import { useEmbeddedModelStatus } from "@/embedded/hooks/use-embedded-model-status";
import { coAgentChatService } from "@/embedded/pages/CoAgent/co-agent-chat";
import { CO_AGENT_STATUS_EVENT } from "@/embedded/pages/CoAgent/constants";
import { getPageDescription } from "@/embedded/utils/co-agent/dom-utils";

interface CoAgentOverlayProps {
	portalRoot: ShadowRoot;
	onDestroy: () => void;
}

export const CoAgentOverlay: React.FC<CoAgentOverlayProps> = ({
	portalRoot,
	onDestroy,
}) => {
	const [message, setMessage] = useState("");
	const [inputValue, setInputValue] = useState("");
	const [collapsed, setCollapsed] = useState(false);
	const [bubbleDismissed, setBubbleDismissed] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { needsPasskey, modelAvailable, selectedModel } =
		useEmbeddedModelStatus();
	const showAuthAction = needsPasskey;
	const speechMessage = showAuthAction
		? "Unlock required"
		: isSubmitting
			? message.trim() || "Working"
			: message.trim();
	const visibleSpeechMessage = bubbleDismissed ? "" : speechMessage;

	useEffect(() => {
		const handleStatus = (event: Event) => {
			const detail = (event as CustomEvent<{ message?: string }>).detail;
			setMessage(detail?.message?.trim() ?? "");
		};
		window.addEventListener(CO_AGENT_STATUS_EVENT, handleStatus);
		return () =>
			window.removeEventListener(CO_AGENT_STATUS_EVENT, handleStatus);
	}, []);

	useEffect(() => {
		if (!speechMessage) {
			setBubbleDismissed(false);
		}
	}, [speechMessage]);

	useEffect(() => {
		const bubbleContent = portalRoot.querySelector<HTMLElement>(
			".memorall-co-agent-icon .agent-speech-bubble-content",
		);
		if (bubbleContent) {
			bubbleContent.scrollTop = bubbleContent.scrollHeight;
		}
	}, [message, portalRoot]);

	const unlockExtension = () => {
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.HIDE_CO_AGENT });
		onDestroy();
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.OPEN_FULL_PAGE });
	};

	const submitPrompt = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const prompt = inputValue.trim();
		if (!prompt || isSubmitting || showAuthAction || !modelAvailable) return;

		setInputValue("");
		setCollapsed(false);
		setBubbleDismissed(false);
		setIsSubmitting(true);
		setMessage("Thinking");

		try {
			const result = await coAgentChatService.chatStream({
				prompt,
				model: selectedModel,
				pageContext: {
					url: window.location.href,
					title: document.title || "",
					description: getPageDescription(),
				},
				onExecuteStart: (executeState) => {
					setMessage(
						typeof executeState.node === "string"
							? executeState.node.replace(/[_-]+/g, " ")
							: "Working",
					);
				},
				onProgress: (content) => {
					if (content.trim()) {
						setMessage(content.trim());
					}
				},
				onError: (error) => {
					setMessage(error || "Co-agent failed");
				},
			});

			if (result.content.trim()) {
				setMessage(result.content.trim());
			}
		} catch (error) {
			setMessage(
				error instanceof Error ? error.message : "Co-agent request failed",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<AgentCursorOverlay portalRoot={portalRoot} />
			<div
				className={`memorall-co-agent-root ${
					collapsed ? "memorall-co-agent-root--collapsed" : ""
				}`}
			>
				<div className="memorall-co-agent-dock">
					<div
						className="memorall-co-agent-icon"
						role={collapsed ? "button" : undefined}
						tabIndex={collapsed ? 0 : undefined}
						aria-label={collapsed ? "Expand co-agent" : undefined}
						onClick={() => {
							if (collapsed) setCollapsed(false);
						}}
						onKeyDown={(event) => {
							if (!collapsed) return;
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								setCollapsed(false);
							}
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
														aria-label="Close co-agent bubble"
														title="Close"
														onClick={(event) => {
															event.stopPropagation();
															setBubbleDismissed(true);
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
						onClick={unlockExtension}
					>
						Unlock Extension
					</button>
				) : null}
				{!collapsed && !showAuthAction ? (
					<form className="memorall-co-agent-input" onSubmit={submitPrompt}>
						<button
							type="button"
							className="memorall-co-agent-input-collapse"
							aria-label="Collapse co-agent input"
							title="Collapse"
							onClick={() => setCollapsed(true)}
						>
							<ChevronRight size={17} strokeWidth={2.35} />
						</button>
						<input
							value={inputValue}
							onChange={(event) => setInputValue(event.currentTarget.value)}
							placeholder={
								modelAvailable ? "Ask co-agent..." : "No model available"
							}
							disabled={!modelAvailable || isSubmitting}
						/>
						<button
							type="submit"
							className="memorall-co-agent-input-send"
							aria-label="Send to co-agent"
							disabled={!inputValue.trim() || !modelAvailable || isSubmitting}
						>
							<Send size={15} strokeWidth={2.2} />
						</button>
					</form>
				) : null}
			</div>
		</>
	);
};
