import React, { useEffect, useRef, useState } from "react";
import type { ChatMessage, EmbeddedContextItem } from "@/embedded/types";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { logWarn } from "@/utils/logger";
import { createFolderPickerOverlay } from "@/embedded/components/FolderPickerOverlay";

export const MessageActions: React.FC<{
	message: ChatMessage;
	allMessages: ChatMessage[];
	selectedTopic?: string;
}> = ({ message, allMessages }) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const [copied, setCopied] = useState(false);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const folderPickerCleanupRef = useRef<(() => void) | null>(null);

	useEffect(
		() => () => {
			folderPickerCleanupRef.current?.();
			folderPickerCleanupRef.current = null;
		},
		[],
	);

	const handleCopy = async () => {
		try {
			const textToCopy =
				typeof message.content === "string"
					? message.content
					: message.content
							.filter((part) => part.type === "text")
							.map((part) => part.text)
							.join("\n");
			await navigator.clipboard.writeText(textToCopy);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			logWarn("Failed to copy message:", error);
		}
	};

	const handleSaveToRemembered = async () => {
		if (saving) return;

		setSaving(true);
		try {
			const conversationText = allMessages
				.map((msg) => {
					const content =
						typeof msg.content === "string"
							? msg.content
							: msg.content
									.filter((part) => part.type === "text")
									.map((part) => part.text)
									.join("\n");
					const role = msg.role === "user" ? t("userRole") : t("assistantRole");
					return `${role}: ${content}`;
				})
				.join("\n\n");

			const conversationId = `conversation-${Date.now()}-${Math.random().toString(36).substring(7)}`;
			const sourceInfo = `${t("directContentSave")}\n${t("webTitle")}: ${
				document.title || t("untitled")
			}\n${t("webUrl")}: ${window.location.href}\n\n`;
			const fullContent = sourceInfo + conversationText;

			const item: EmbeddedContextItem = {
				id: conversationId,
				kind: "smart_text",
				label: t("conversationSaveLabel"),
				content: fullContent,
			};

			folderPickerCleanupRef.current = createFolderPickerOverlay(
				item,
				() => {
					folderPickerCleanupRef.current = null;
					setSaving(false);
					setSaved(true);
					setTimeout(() => setSaved(false), 3000);
				},
				() => {
					folderPickerCleanupRef.current = null;
					setSaving(false);
				},
			);
		} catch (error) {
			logWarn("Failed to save to remembered content:", error);
			setSaving(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<button
				onClick={handleCopy}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/copy"
				title={copied ? t("copiedTitle") : t("copyMessage")}
			>
				{copied ? (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
						/>
					</svg>
				)}
				<span className="hidden group-hover/copy:inline">
					{copied ? t("copied") : t("copy")}
				</span>
			</button>

			<button
				onClick={handleSaveToRemembered}
				className="h-8 px-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2 group/save"
				title={
					saved ? t("savedTitle") : saving ? t("saving") : t("saveToRemembered")
				}
				disabled={saving}
			>
				{saved ? (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : (
					<svg
						className="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
						/>
					</svg>
				)}
				<span className="hidden group-hover/save:inline">
					{saving ? t("saving") : saved ? t("saved") : t("remember")}
				</span>
			</button>
		</div>
	);
};
