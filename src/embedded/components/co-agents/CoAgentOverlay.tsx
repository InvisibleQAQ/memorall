import React, { useCallback, useEffect, useRef, useState } from "react";
import { BACKGROUND_EVENTS } from "@/constants/events";
import { AgentCursorOverlay } from "@/components/AgentCursor";
import { useEmbeddedModelStatus } from "@/embedded/hooks/use-embedded-model-status";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { embeddedChatHistoryService } from "@/embedded/chat-history-service";
import { createEmbeddedContextItem } from "@/embedded/context-items";
import {
	EMBEDDED_CHAT_MODAL_STATE_EVENT,
	createEmbeddedChatModal,
} from "@/embedded/pages/EmbeddedChat";
import { coAgentChatService } from "@/embedded/pages/CoAgent/co-agent-chat";
import { CO_AGENT_STATUS_EVENT } from "@/embedded/pages/CoAgent/constants";
import { getPageDescription } from "@/embedded/utils/co-agent/dom-utils";
import {
	refreshContextAnchor,
	type CoAgentContextAnchor,
} from "@/embedded/utils/co-agent/context-anchor";
import { useCoAgentContextAnchor } from "./useCoAgentContextAnchor";
import { CoAgentAnchorTrigger } from "./CoAgentAnchorPrompt";
import { CoAgentDock } from "./CoAgentDock";

interface CoAgentOverlayProps {
	portalRoot: ShadowRoot;
	onDestroy: () => void;
}

export const CoAgentOverlay: React.FC<CoAgentOverlayProps> = ({
	portalRoot,
	onDestroy,
}) => {
	const [message, setMessage] = useState("");
	const [anchoredInputValue, setAnchoredInputValue] = useState("");
	const [collapsed, setCollapsed] = useState(false);
	const [bubbleDismissed, setBubbleDismissed] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [anchorPromptOpen, setAnchorPromptOpen] = useState(false);
	const [chatPopupOpen, setChatPopupOpen] = useState(false);
	const [externalChatModalOpen, setExternalChatModalOpen] = useState(() =>
		Boolean(document.getElementById("memorall-embedded-chat-modal")),
	);
	const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
	const { modelAvailable, selectedModel } = useEmbeddedModelStatus();
	const t = useEmbeddedTranslation("coAgent");
	const showAuthAction = false;
	const speechMessage = showAuthAction
		? t("unlockRequired")
		: isSubmitting
			? message.trim() || t("working")
			: message.trim();
	const visibleSpeechMessage = bubbleDismissed ? "" : speechMessage;

	const openPromptUi = useCallback(() => {
		setCollapsed(false);
		setBubbleDismissed(false);
		setAnchorPromptOpen(true);
	}, []);

	const { activeAnchor, freshAnchor, setActiveAnchor } =
		useCoAgentContextAnchor({
			disabled: showAuthAction,
			promptOpen: anchorPromptOpen,
			onOpenPrompt: openPromptUi,
		});

	const openPrompt = useCallback(
		(anchor?: CoAgentContextAnchor | null) => {
			if (anchor && !anchor.isStale) setActiveAnchor(anchor);
			openPromptUi();
		},
		[openPromptUi, setActiveAnchor],
	);

	const showAnchorTrigger =
		Boolean(freshAnchor && !freshAnchor.isStale) &&
		!anchorPromptOpen &&
		!chatPopupOpen &&
		!collapsed &&
		!showAuthAction;

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
		const handleEmbeddedChatState = (event: Event) => {
			const detail = (
				event as CustomEvent<{ mounted?: boolean; minimized?: boolean }>
			).detail;
			setExternalChatModalOpen(Boolean(detail?.mounted));
		};

		window.addEventListener(
			EMBEDDED_CHAT_MODAL_STATE_EVENT,
			handleEmbeddedChatState,
		);
		return () =>
			window.removeEventListener(
				EMBEDDED_CHAT_MODAL_STATE_EVENT,
				handleEmbeddedChatState,
			);
	}, []);

	useEffect(() => {
		const bubbleContent = portalRoot.querySelector<HTMLElement>(
			".memorall-co-agent-icon .agent-speech-bubble-content",
		);
		if (bubbleContent) {
			bubbleContent.scrollTop = bubbleContent.scrollHeight;
		}
	}, [message, portalRoot]);

	useEffect(() => {
		if (!anchorPromptOpen) return;
		window.requestAnimationFrame(() => {
			promptInputRef.current?.focus();
		});
	}, [anchorPromptOpen]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape" || !anchorPromptOpen) return;
			event.preventDefault();
			setAnchorPromptOpen(false);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [anchorPromptOpen]);

	const leaveCoAgentMode = () => {
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.HIDE_CO_AGENT });
		onDestroy();
	};

	const unlockExtension = () => {
		leaveCoAgentMode();
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.OPEN_FULL_PAGE });
	};

	const openFullConversation = async () => {
		try {
			document.getElementById("memorall-embedded-chat-modal")?.remove();
			setChatPopupOpen(true);
			await createEmbeddedChatModal({
				mode: "general",
				coAgentEnabled: true,
				pageUrl: window.location.href,
				pageTitle: document.title,
				contextOptions: [
					createEmbeddedContextItem({
						kind: "viewport",
						label: t("visibleContent"),
						content: document.body?.innerText?.slice(0, 6_000) ?? "",
					}),
				],
				onCoAgentToggle: (enabled) => {
					void chrome.runtime.sendMessage({
						type: enabled
							? BACKGROUND_EVENTS.CO_AGENT_SET_ACTIVE
							: BACKGROUND_EVENTS.HIDE_CO_AGENT,
						url: window.location.href,
					});
					if (!enabled) onDestroy();
				},
				onClose: () => {
					setChatPopupOpen(false);
				},
			});
		} catch (error) {
			setChatPopupOpen(false);
			setBubbleDismissed(false);
			setMessage(error instanceof Error ? error.message : t("errorMessage"));
		}
	};

	const submitPrompt = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const prompt = anchoredInputValue.trim();
		if (!prompt || isSubmitting || showAuthAction || !modelAvailable) return;
		const anchor = activeAnchor
			? refreshContextAnchor(activeAnchor)
			: undefined;

		setAnchoredInputValue("");
		setAnchorPromptOpen(false);
		setCollapsed(false);
		setBubbleDismissed(false);
		setIsSubmitting(true);
		setMessage(t("thinking"));

		let assistantMessageId: string | null = null;
		let currentContent = "";
		let latestActions: Awaited<
			ReturnType<typeof coAgentChatService.chatStream>
		>["actions"] = [];
		let latestToolCalls:
			| Awaited<ReturnType<typeof coAgentChatService.chatStream>>["toolCalls"]
			| undefined;
		const startTime = Date.now();

		try {
			await embeddedChatHistoryService.addMessage({
				role: "user",
				content: prompt,
				metadata: {
					source: "co-agent",
					pageUrl: window.location.href,
					pageTitle: document.title || "",
					anchor,
				},
			});
			const assistantMessage = await embeddedChatHistoryService.addMessage({
				role: "assistant",
				content: "",
				metadata: {
					source: "co-agent",
					pageUrl: window.location.href,
					pageTitle: document.title || "",
					model: selectedModel,
				},
			});
			assistantMessageId = assistantMessage.id;

			const result = await coAgentChatService.chatStream({
				prompt,
				model: selectedModel,
				pageContext: {
					url: window.location.href,
					title: document.title || "",
					description: getPageDescription(),
				},
				anchorContext: anchor && !anchor.isStale ? anchor : undefined,
				onExecuteStart: (executeState) => {
					setMessage(
						typeof executeState.node === "string"
							? executeState.node.replace(/[_-]+/g, " ")
							: t("working"),
					);
				},
				onProgress: (content) => {
					if (content.trim()) {
						currentContent = content.trim();
						setMessage(content.trim());
					}
				},
				onAction: (actions) => {
					latestActions = actions;
				},
				onToolCalls: (toolCalls) => {
					latestToolCalls = toolCalls;
				},
				onError: (error) => {
					setMessage(error || t("failedMessage"));
				},
			});

			if (result.content.trim()) {
				currentContent = result.content.trim();
				latestActions = result.actions;
				latestToolCalls = result.toolCalls;
				setMessage(result.content.trim());
			}
		} catch (error) {
			currentContent =
				error instanceof Error ? error.message : t("errorMessage");
			setMessage(currentContent);
		} finally {
			const timeToAnswer = (Date.now() - startTime) / 1000;
			try {
				if (assistantMessageId) {
					await embeddedChatHistoryService.finalizeMessage(assistantMessageId, {
						content: currentContent || message || t("failedMessage"),
						metadata: {
							source: "co-agent",
							actions: latestActions,
							tool_calls: latestToolCalls,
							model: selectedModel,
							timeToAnswer,
						},
					});
				}
			} catch {
				// The dock response is still useful even if history persistence fails.
			}
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<AgentCursorOverlay portalRoot={portalRoot} />
			{showAnchorTrigger && freshAnchor ? (
				<CoAgentAnchorTrigger
					anchor={freshAnchor}
					onOpen={() => openPrompt(freshAnchor)}
				/>
			) : null}
			{!chatPopupOpen && !externalChatModalOpen ? (
				<CoAgentDock
					collapsed={collapsed}
					showAuthAction={showAuthAction}
					visibleSpeechMessage={visibleSpeechMessage}
					isSubmitting={isSubmitting}
					promptOpen={anchorPromptOpen}
					inputValue={anchoredInputValue}
					inputRef={promptInputRef}
					modelAvailable={modelAvailable}
					onExpand={() => setCollapsed(false)}
					onOpenPrompt={() => openPrompt(freshAnchor)}
					onClosePrompt={() => setAnchorPromptOpen(false)}
					onChangeInput={setAnchoredInputValue}
					onSubmitPrompt={submitPrompt}
					onOpenConversation={() => {
						void openFullConversation();
					}}
					onUnlock={unlockExtension}
					onLeaveCoAgent={leaveCoAgentMode}
					onDismissBubble={() => setBubbleDismissed(true)}
				/>
			) : null}
		</>
	);
};
