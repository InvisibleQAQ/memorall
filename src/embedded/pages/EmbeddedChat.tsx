import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANGUAGE, type Language } from "@/constants/language";
import { ChatHeader } from "@/embedded/components/MessageControl";
import { EmbeddedChatConversation } from "@/embedded/components/EmbeddedChatConversation";
import { EmbeddedChatInput } from "@/embedded/components/EmbeddedChatInput";
import { EmbeddedCloseConfirmation } from "@/embedded/components/EmbeddedCloseConfirmation";
import { EmbeddedContextRevealButton } from "@/embedded/components/EmbeddedContextRevealButton";
import { EmbeddedContextSections } from "@/embedded/components/ContextSections";
import { EmbeddedSmartSelectNotice } from "@/embedded/components/EmbeddedSmartSelectNotice";
import { useConversationAutoScroll } from "@/embedded/hooks/use-conversation-auto-scroll";
import { useEmbeddedChatDisplayMode } from "@/embedded/hooks/use-embedded-chat-display-mode";
import { useEmbeddedChatSession } from "@/embedded/hooks/use-embedded-chat-session";
import { useEmbeddedContextAttachments } from "@/embedded/hooks/use-embedded-context-attachments";
import { useEmbeddedKnowledgeOptions } from "@/embedded/hooks/use-embedded-knowledge-options";
import { useEmbeddedModelStatus } from "@/embedded/hooks/use-embedded-model-status";
import { useEmbeddedSmartSelect } from "@/embedded/hooks/use-embedded-smart-select";
import {
	EMBEDDED_TRANSLATIONS,
	loadLanguageFromStorage,
} from "@/embedded/language";
import { customStyles } from "@/embedded/styles/customStyles";
import type { ChatModalProps } from "@/embedded/types";
import { createShadowPage } from "@/embedded/utils/create-shadow-page";

interface EmbeddedChatProps extends ChatModalProps {
	language?: Language;
}

const getPageHost = (pageUrl: string): string => {
	try {
		return new URL(pageUrl).hostname.replace(/^www\./, "");
	} catch {
		return pageUrl;
	}
};

const openFullPage = () => {
	chrome.runtime.sendMessage({
		type: "OPEN_FULL_PAGE",
	});
};

const EmbeddedChat: React.FC<EmbeddedChatProps> = ({
	context,
	mode = "general",
	displayMode,
	pageUrl,
	pageTitle,
	contextOptions,
	language = DEFAULT_LANGUAGE,
	onClose,
}) => {
	const texts = EMBEDDED_TRANSLATIONS[language];
	const [inputValue, setInputValue] = useState("");
	const [showConfirmClose, setShowConfirmClose] = useState(false);

	const { currentDisplayMode, toggleDisplayMode } =
		useEmbeddedChatDisplayMode(displayMode);
	const {
		selectedModel,
		selectedProvider,
		modelAvailable,
		needsPasskey,
		noModelConfig,
		encryptedProviders,
	} = useEmbeddedModelStatus();
	const {
		topics,
		agentFlows,
		selectedTopic,
		setSelectedTopic,
		topicsLoading,
		selectedAgentFlowId,
		setSelectedAgentFlowId,
		hasTopics,
	} = useEmbeddedKnowledgeOptions();
	const {
		availableContexts,
		attachedContexts,
		showContextSection,
		setShowContextSection,
		attachContext,
		attachSmartContext,
		removeAttachedContext,
		clearAttachedContexts,
		resetContexts,
		toggleContextSection,
	} = useEmbeddedContextAttachments(contextOptions);

	const pageHost = useMemo(() => getPageHost(pageUrl), [pageUrl]);
	const suggestedPrompts = useMemo(
		() => [
			texts.chat.suggestSummary,
			texts.chat.suggestFindFacts,
			texts.chat.suggestRecallLinks,
		],
		[
			texts.chat.suggestFindFacts,
			texts.chat.suggestRecallLinks,
			texts.chat.suggestSummary,
		],
	);
	const primaryPageContext = useMemo(
		() =>
			availableContexts.find(
				(contextItem) => contextItem.kind === "viewport",
			) ??
			availableContexts.find(
				(contextItem) => contextItem.kind === "full_page",
			) ??
			availableContexts[0],
		[availableContexts],
	);

	const {
		conversationRef,
		shouldAutoScroll,
		scrollToBottom,
		handleScroll,
		handleWheel,
		setShouldAutoScroll,
	} = useConversationAutoScroll();
	const { messages, isTyping, submit, stop, deleteChat, newChat } =
		useEmbeddedChatSession({
			context,
			mode,
			pageTitle,
			pageUrl,
			texts: texts.chat,
			inputValue,
			setInputValue,
			attachedContexts,
			resetContexts,
			modelAvailable,
			selectedModel,
			selectedAgentFlowId,
			selectedTopic,
			scrollToBottom,
			setShouldAutoScroll,
		});
	const { isSmartSelectMode, startSmartSelect } = useEmbeddedSmartSelect({
		texts: texts.contextSection,
		onAttachContext: attachSmartContext,
		onSelected: () => setShowContextSection(false),
	});

	useEffect(() => {
		if (shouldAutoScroll) {
			scrollToBottom();
		}
	}, [messages, shouldAutoScroll, scrollToBottom]);

	const hasUnsavedContent = useCallback(
		() =>
			messages.length > 0 ||
			inputValue.trim().length > 0 ||
			attachedContexts.length > 0,
		[attachedContexts.length, inputValue, messages.length],
	);

	const closeWithConfirmation = useCallback(() => {
		if (hasUnsavedContent()) {
			setShowConfirmClose(true);
			return;
		}
		onClose();
	}, [hasUnsavedContent, onClose]);

	const handleConfirmedClose = useCallback(() => {
		setShowConfirmClose(false);
		onClose();
	}, [onClose]);

	const handleCancelClose = useCallback(() => {
		setShowConfirmClose(false);
	}, []);

	const handleOpenFullPageAndClose = useCallback(() => {
		openFullPage();
		onClose();
	}, [onClose]);

	return (
		<div
			className="memorall-embedded-root"
			onClick={closeWithConfirmation}
			onKeyDown={(event) => event.stopPropagation()}
			onKeyUp={(event) => event.stopPropagation()}
			onKeyPress={(event) => event.stopPropagation()}
		>
			<div
				className={`memorall-chat-shell memorall-chat-shell--${currentDisplayMode} ${
					isSmartSelectMode ? "memorall-chat-shell--smart" : ""
				}`}
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => event.stopPropagation()}
				onKeyUp={(event) => event.stopPropagation()}
				onKeyPress={(event) => event.stopPropagation()}
			>
				<ChatHeader
					mode={mode}
					displayMode={currentDisplayMode}
					onToggleDisplayMode={toggleDisplayMode}
					onNewChat={newChat}
					onOpenFullVersion={openFullPage}
					onClose={closeWithConfirmation}
					modelId={selectedModel}
					provider={selectedProvider}
					modelAvailable={modelAvailable}
					texts={texts.messageControl}
				/>

				{isSmartSelectMode ? (
					<EmbeddedSmartSelectNotice texts={texts.contextSection} />
				) : (
					<EmbeddedChatConversation
						conversationRef={conversationRef}
						onScroll={handleScroll}
						onWheel={handleWheel}
						needsPasskey={needsPasskey}
						noModelConfig={noModelConfig}
						encryptedProviders={encryptedProviders}
						selectedProvider={selectedProvider}
						messages={messages}
						selectedTopic={selectedTopic}
						pageHost={pageHost}
						suggestedPrompts={suggestedPrompts}
						primaryPageContext={primaryPageContext}
						texts={texts.chat}
						onAttachContext={attachContext}
						onSelectPrompt={setInputValue}
						onOpenMainApp={handleOpenFullPageAndClose}
					/>
				)}

				{!isSmartSelectMode &&
					!showContextSection &&
					attachedContexts.length === 0 && (
						<EmbeddedContextRevealButton
							label={texts.chat.context}
							smartSelectLabel={texts.contextSection.smartSelect}
							onClick={toggleContextSection}
							onSmartSelect={startSmartSelect}
						/>
					)}

				{!isSmartSelectMode && (
					<div
						className="overflow-hidden transition-all duration-300 ease-in-out"
						style={{
							maxHeight:
								showContextSection || attachedContexts.length > 0
									? "500px"
									: "0px",
							opacity:
								showContextSection || attachedContexts.length > 0 ? 1 : 0,
						}}
					>
						<EmbeddedContextSections
							availableContexts={availableContexts}
							attachedContexts={attachedContexts}
							onAttachContext={attachContext}
							onRemoveAttachedContext={removeAttachedContext}
							onClearAttachedContexts={clearAttachedContexts}
							onStartSmartSelect={startSmartSelect}
							showContextSection={showContextSection}
							onToggleContextSection={toggleContextSection}
							texts={texts.contextSection}
						/>
					</div>
				)}

				{!isSmartSelectMode && (
					<EmbeddedChatInput
						inputValue={inputValue}
						setInputValue={setInputValue}
						onSubmit={submit}
						isTyping={isTyping}
						modelAvailable={modelAvailable}
						selectedAgentFlowId={selectedAgentFlowId}
						setSelectedAgentFlowId={setSelectedAgentFlowId}
						agentFlows={agentFlows}
						selectedTopic={selectedTopic}
						setSelectedTopic={setSelectedTopic}
						topics={topics}
						topicsLoading={topicsLoading}
						hasTopics={hasTopics}
						messages={messages}
						onDeleteChat={deleteChat}
						onStop={stop}
						onOpenSettings={handleOpenFullPageAndClose}
						language={language}
					/>
				)}

				{showConfirmClose && (
					<EmbeddedCloseConfirmation
						texts={texts.chat}
						onCancel={handleCancelClose}
						onConfirm={handleConfirmedClose}
					/>
				)}
			</div>
		</div>
	);
};

// Function to create and mount the shadcn-style chat modal with Shadow DOM isolation
export async function createEmbeddedChatModal(
	props: ChatModalProps,
): Promise<() => void> {
	const language = await loadLanguageFromStorage();
	const { root, container } = createShadowPage({
		customStyles,
	});

	const cleanupModal = () => {
		root.unmount();
		container.remove();
	};

	const modalProps = {
		...props,
		language,
		onClose: () => {
			props.onClose();
			cleanupModal();
		},
	};

	root.render(<EmbeddedChat {...modalProps} />);
	document.body.appendChild(container);

	return cleanupModal;
}

export default EmbeddedChat;
