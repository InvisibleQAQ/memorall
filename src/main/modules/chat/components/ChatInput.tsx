import React, { useRef, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { PromptInput } from "@/main/components/ui/shadcn-io/ai/prompt-input";
import {
	MentionRichTextarea,
	type MentionRichTextareaHandle,
} from "@/main/modules/chat/components/input/MentionRichTextarea";
import { TooltipProvider } from "@/main/components/ui/tooltip";
import type { ChatStatus, AttachedDocumentRef } from "@/types/chat";
import type { DocumentFile } from "@/types/document-library";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import { AttachmentList } from "@/main/modules/chat/components/input/AttachmentList";
import {
	collectFiles,
	documentFileToMentionItem,
	MentionPopup,
	type MentionItem,
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
	topics: Array<{ id: string; name: string; agentId?: string | null }>;
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
	const textareaRef = useRef<MentionRichTextareaHandle>(null);
	const isKnowledgeMode = selectedAgentFlowId !== "chat";

	const [mentionQuery, setMentionQuery] = useState<string | null>(null);
	const mentionAtIndexRef = useRef<number>(-1);
	const [mentionDocFiles, setMentionDocFiles] = useState<DocumentFile[]>([]);
	const [mentionSkillItems, setMentionSkillItems] = useState<MentionItem[]>([]);
	const [mentionHighlight, setMentionHighlight] = useState(0);
	const isMentionOpen = mentionQuery !== null;

	useEffect(() => {
		if (!isMentionOpen) return;
		Promise.all([
			documentFileSystemService.getTree().catch(() => []),
			import("@/services/filesystem/skill-filesystem")
				.then((m) => m.skillFileSystemService.listSkills())
				.catch(() => []),
		]).then(([tree, skills]) => {
			setMentionDocFiles(collectFiles(tree));
			setMentionSkillItems(
				skills.map((s) => ({
					id: `skill:${s.name}`,
					name: s.name,
					kind: "skill" as const,
					description: s.description,
				})),
			);
		});
	}, [isMentionOpen]);

	const filteredMentionItems = useMemo((): MentionItem[] => {
		if (mentionQuery === null) return [];

		// Support namespace prefixes: @skill:query or @doc:query
		let q = mentionQuery.toLowerCase();
		let kindFilter: "skill" | "document" | null = null;
		if (q.startsWith("skill:")) {
			kindFilter = "skill";
			q = q.slice("skill:".length);
		} else if (q.startsWith("doc:")) {
			kindFilter = "document";
			q = q.slice("doc:".length);
		}

		const docItems =
			kindFilter === "skill"
				? []
				: mentionDocFiles
						.filter((f) => !q || f.name.toLowerCase().includes(q))
						.map(documentFileToMentionItem);

		const skillItems =
			kindFilter === "document"
				? []
				: mentionSkillItems.filter(
						(s) => !q || s.name.toLowerCase().includes(q),
					);

		return [...skillItems, ...docItems].slice(0, 8);
	}, [mentionDocFiles, mentionSkillItems, mentionQuery]);

	useEffect(() => {
		setMentionHighlight(0);
	}, [filteredMentionItems.length]);

	const handleAttachClick = () => {
		fileInputRef.current?.click();
	};

	const handleOpenDocumentPicker = () => {
		setMentionQuery("");
		requestAnimationFrame(() => textareaRef.current?.focus());
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

	const handleInputChange = (value: string, cursorPos: number) => {
		setInputValue(value);

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

	const handleSelectMention = (item: MentionItem) => {
		const atIdx = mentionAtIndexRef.current;
		const queryLen = mentionQuery?.length ?? 0;
		setMentionQuery(null);

		const prefix =
			item.kind === "skill" ? `@skill:${item.name} ` : `@doc:${item.name} `;
		const newValue =
			inputValue.slice(0, atIdx) +
			prefix +
			inputValue.slice(atIdx + 1 + queryLen);
		const cursorAfter = atIdx + prefix.length;

		// Signal where the cursor should land before the DOM re-renders
		textareaRef.current?.setPendingCursor(cursorAfter);
		setInputValue(newValue);

		if (item.kind === "document") {
			onAttachedDocumentRefsChange([
				...attachedDocumentRefs,
				{
					path: item.id,
					mimeType: "",
					name: item.name,
					docType: item.docType ?? "other",
				},
			]);
		}
	};

	const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (isMentionOpen && filteredMentionItems.length > 0) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setMentionHighlight((h) =>
					Math.min(h + 1, filteredMentionItems.length - 1),
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
				handleSelectMention(filteredMentionItems[mentionHighlight]);
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				setMentionQuery(null);
				return;
			}
		}
		// Enter-to-submit is handled inside MentionRichTextarea itself
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
						items={filteredMentionItems}
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

							<MentionRichTextarea
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
