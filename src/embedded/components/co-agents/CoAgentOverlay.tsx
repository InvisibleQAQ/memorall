import React, { useCallback, useEffect, useRef, useState } from "react";
import { BACKGROUND_EVENTS } from "@/constants/events";
import { AgentCursorOverlay } from "@/components/AgentCursor";
import { useEmbeddedModelStatus } from "@/embedded/hooks/use-embedded-model-status";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { createEmbeddedContextItem } from "@/embedded/context-items";
import { createEmbeddedChatModal } from "@/embedded/pages/EmbeddedChat";
import { coAgentChatService } from "@/embedded/pages/CoAgent/co-agent-chat";
import { CO_AGENT_STATUS_EVENT } from "@/embedded/pages/CoAgent/constants";
import { getPageDescription } from "@/embedded/utils/co-agent/dom-utils";
import {
	refreshContextAnchor,
	type CoAgentContextAnchor,
} from "@/embedded/utils/co-agent/context-anchor";
import { useCoAgentContextAnchor } from "./useCoAgentContextAnchor";
import {
	CoAgentAnchorPrompt,
	CoAgentAnchorTrigger,
} from "./CoAgentAnchorPrompt";
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
	const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
	const { needsPasskey, modelAvailable, selectedModel } =
		useEmbeddedModelStatus();
	const t = useEmbeddedTranslation("coAgent");
	const showAuthAction = needsPasskey;
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

	const unlockExtension = () => {
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.HIDE_CO_AGENT });
		onDestroy();
		void chrome.runtime.sendMessage({ type: BACKGROUND_EVENTS.OPEN_FULL_PAGE });
	};

	const openFullConversation = async () => {
		try {
			document.getElementById("memorall-embedded-chat-modal")?.remove();
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
					// Chat modal owns its own cleanup.
				},
			});
		} catch (error) {
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

		try {
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
						setMessage(content.trim());
					}
				},
				onError: (error) => {
					setMessage(error || t("failedMessage"));
				},
			});

			if (result.content.trim()) {
				setMessage(result.content.trim());
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("errorMessage"));
		} finally {
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
			{anchorPromptOpen && freshAnchor && !showAuthAction ? (
				<CoAgentAnchorPrompt
					anchor={freshAnchor}
					value={anchoredInputValue}
					inputRef={promptInputRef}
					modelAvailable={modelAvailable}
					isSubmitting={isSubmitting}
					onChange={setAnchoredInputValue}
					onClose={() => setAnchorPromptOpen(false)}
					onSubmit={submitPrompt}
				/>
			) : null}
			<CoAgentDock
				collapsed={collapsed}
				showAuthAction={showAuthAction}
				visibleSpeechMessage={visibleSpeechMessage}
				isSubmitting={isSubmitting}
				canOpenPrompt={Boolean(freshAnchor && !showAuthAction)}
				onExpand={() => setCollapsed(false)}
				onOpenPrompt={() => {
					if (freshAnchor) openPrompt(freshAnchor);
				}}
				onOpenConversation={() => {
					void openFullConversation();
				}}
				onUnlock={unlockExtension}
				onDismissBubble={() => setBubbleDismissed(true)}
			/>
		</>
	);
};
