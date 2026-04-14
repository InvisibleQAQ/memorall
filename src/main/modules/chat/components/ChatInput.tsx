import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
	PromptInput,
	PromptInputTextarea,
} from "@/main/components/ui/shadcn-io/ai/prompt-input";
import { TooltipProvider } from "@/main/components/ui/tooltip";
import type { ChatStatus, AttachedDocumentRef } from "@/types/chat";
import type { DocumentFile } from "@/types/document-library";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import { AttachmentList } from "@/main/modules/chat/components/input/AttachmentList";
import {
	collectFiles,
	MentionPopup,
} from "@/main/modules/chat/components/input/MentionPopup";
import { ChatInputControls } from "@/main/modules/chat/components/input/ChatInputControls";

export interface ChatInputProps {
	inputValue: string;
	setInputValue: (value: string) => void;
	onSubmit: (
		e: React.FormEvent,
		attachedImages: File[],
		attachedDocumentRefs: AttachedDocumentRef[],
	) => void;
	isLoading: boolean;
	model: string;
	status: ChatStatus;
	selectedTopic: string;
	setSelectedTopic: (topicId: string) => void;
	onInsertSeparator: () => void;
	onStop: () => void;
	abortController: AbortController | null;
	isLoadingTopics: boolean;
	topics: Array<{ id: string; name: string }>;
	agentFlows: Array<{ id: string; name: string }>;
	selectedAgentFlowId: string | null;
	setSelectedAgentFlowId: (flowId: string) => void;
	onCreateAgentFlow?: () => void;
	onDeleteChat: () => void;
	onOpenAgentSettings?: () => void;
	attachedImages: File[];
	onAttachedImagesChange: (images: File[]) => void;
	attachedDocumentRefs: AttachedDocumentRef[];
	onAttachedDocumentRefsChange: (refs: AttachedDocumentRef[]) => void;
	isModelReady?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
	inputValue,
	setInputValue,
	onSubmit,
	isLoading,
	model,
	status,
	selectedTopic,
	setSelectedTopic,
	onInsertSeparator,
	onStop,
	abortController,
	isLoadingTopics,
	onDeleteChat,
	topics,
	agentFlows,
	selectedAgentFlowId,
	setSelectedAgentFlowId,
	onCreateAgentFlow,
	onOpenAgentSettings,
	attachedImages,
	onAttachedImagesChange,
	attachedDocumentRefs,
	onAttachedDocumentRefsChange,
	isModelReady = true,
}) => {
	const { t } = useTranslation("chat");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const isKnowledgeMode = selectedAgentFlowId !== "chat";

	const [mentionQuery, setMentionQuery] = useState<string | null>(null);
	const mentionAtIndexRef = useRef<number>(-1);
	const [mentionFiles, setMentionFiles] = useState<DocumentFile[]>([]);
	const [mentionHighlight, setMentionHighlight] = useState(0);
	const isMentionOpen = mentionQuery !== null;

	useEffect(() => {
		if (!isMentionOpen) return;
		documentFileSystemService
			.getTree()
			.then((tree) => setMentionFiles(collectFiles(tree)))
			.catch(() => setMentionFiles([]));
	}, [isMentionOpen]);

	const filteredMentionFiles = useMemo(() => {
		if (mentionQuery === null) return [];
		const q = mentionQuery.toLowerCase();
		return mentionFiles
			.filter((f) => !q || f.name.toLowerCase().includes(q))
			.slice(0, 8);
	}, [mentionFiles, mentionQuery]);

	useEffect(() => {
		setMentionHighlight(0);
	}, [filteredMentionFiles.length]);

	const handleAttachClick = () => {
		fileInputRef.current?.click();
	};

	const handleOpenDocumentPicker = () => {
		setMentionQuery("");
		requestAnimationFrame(() => {
			textareaRef.current?.focus();
		});
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		if (files.length === 0) return;
		e.target.value = "";

		const imageFiles = files.filter((file) => file.type.startsWith("image/"));
		const documentFiles = files.filter(
			(file) => !file.type.startsWith("image/"),
		);

		if (imageFiles.length > 0) {
			onAttachedImagesChange([...attachedImages, ...imageFiles]);
		}

		if (documentFiles.length > 0) {
			void Promise.all(
				documentFiles.map(async (file) => {
					const uploaded = await documentFileSystemService.uploadFile(file);
					return {
						path: uploaded.path,
						mimeType: uploaded.mimeType || file.type,
						name: uploaded.name,
						docType: uploaded.type,
					} satisfies AttachedDocumentRef;
				}),
			).then((uploadedRefs) => {
				onAttachedDocumentRefsChange([
					...attachedDocumentRefs,
					...uploadedRefs,
				]);
			});
		}
	};

	const handleRemoveImage = (index: number) => {
		onAttachedImagesChange(attachedImages.filter((_, i) => i !== index));
	};

	const handleRemoveDocRef = (index: number) => {
		onAttachedDocumentRefsChange(
			attachedDocumentRefs.filter((_, i) => i !== index),
		);
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		setInputValue(value);

		const cursorPos = e.target.selectionStart ?? value.length;
		const textBefore = value.slice(0, cursorPos);
		const lastAt = textBefore.lastIndexOf("@");

		if (lastAt !== -1) {
			const candidate = textBefore.slice(lastAt + 1);
			if (!candidate.includes(" ") && !candidate.includes("\n")) {
				mentionAtIndexRef.current = lastAt;
				setMentionQuery(candidate);
				return;
			}
		}

		setMentionQuery(null);
	};

	const handleSelectMention = (file: DocumentFile) => {
		onAttachedDocumentRefsChange([
			...attachedDocumentRefs,
			{
				path: file.path,
				mimeType: file.mimeType,
				name: file.name,
				docType: file.type,
			},
		]);

		const atIdx = mentionAtIndexRef.current;
		const queryLen = mentionQuery?.length ?? 0;
		setInputValue(
			inputValue.slice(0, atIdx) + inputValue.slice(atIdx + 1 + queryLen),
		);
		setMentionQuery(null);
	};

	const handleTextareaKeyDown = (
		e: React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		if (isMentionOpen && filteredMentionFiles.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionHighlight((h) =>
					Math.min(h + 1, filteredMentionFiles.length - 1),
				);
				return;
			}

			if (e.key === "ArrowUp") {
				e.preventDefault();
				setMentionHighlight((h) => Math.max(h - 1, 0));
				return;
			}

			if (e.key === "Enter") {
				e.preventDefault();
				handleSelectMention(filteredMentionFiles[mentionHighlight]);
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				setMentionQuery(null);
				return;
			}
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			const form = e.currentTarget.form;
			if (form) form.requestSubmit();
		}
	};

	const handleSubmitWithImages = (e: React.FormEvent) => {
		onSubmit(e, attachedImages, attachedDocumentRefs);
	};

	const hasAttachments =
		attachedImages.length > 0 || attachedDocumentRefs.length > 0;

	return (
		<TooltipProvider>
			<div className="px-4 py-2 w-full flex-shrink-0">
				<div className="max-w-3xl mx-auto relative">
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*,text/*,.md,.markdown,.txt"
						multiple
						className="hidden"
						onChange={handleFileChange}
					/>

					<MentionPopup
						isOpen={isMentionOpen}
						files={filteredMentionFiles}
						highlightIndex={mentionHighlight}
						title={t("mention.documents")}
						searchText={mentionQuery ?? ""}
						onClose={() => setMentionQuery(null)}
						onSelect={handleSelectMention}
					/>

					<PromptInput onSubmit={handleSubmitWithImages}>
						<div>
							{hasAttachments && (
								<AttachmentList
									attachedImages={attachedImages}
									attachedDocumentRefs={attachedDocumentRefs}
									onRemoveImage={handleRemoveImage}
									onRemoveDocRef={handleRemoveDocRef}
								/>
							)}

							<PromptInputTextarea
								ref={textareaRef}
								value={inputValue}
								onChange={handleInputChange}
								onKeyDown={handleTextareaKeyDown}
								placeholder={
									isModelReady ? t("input.placeholder") : t("model.notLoaded")
								}
								disabled={isLoading || !isModelReady}
								className="!border-0 !border-t-0 !shadow-none focus:!border-0 focus:!ring-0 focus:!ring-offset-0 focus-visible:!border-0 focus-visible:!ring-0 focus-visible:!ring-offset-0"
							/>
						</div>

						<ChatInputControls
							isLoading={isLoading}
							model={model}
							status={status}
							selectedTopic={selectedTopic}
							setSelectedTopic={setSelectedTopic}
							onInsertSeparator={onInsertSeparator}
							onStop={onStop}
							abortController={abortController}
							isLoadingTopics={isLoadingTopics}
							topics={topics}
							agentFlows={agentFlows}
							selectedAgentFlowId={selectedAgentFlowId}
							setSelectedAgentFlowId={setSelectedAgentFlowId}
							onCreateAgentFlow={onCreateAgentFlow}
							onDeleteChat={onDeleteChat}
							onOpenAgentSettings={onOpenAgentSettings}
							isKnowledgeMode={isKnowledgeMode}
							onAttachFileClick={handleAttachClick}
							onAttachDocumentClick={handleOpenDocumentPicker}
							canSubmit={!!inputValue.trim() && isModelReady}
						/>
					</PromptInput>
				</div>
			</div>
		</TooltipProvider>
	);
};
