/**
 * Markdown Editor Component
 * Production-ready Tiptap-based editor with markdown shortcuts
 * Stores as pure markdown, edits as WYSIWYG HTML
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import { Button } from "@/main/components/ui/button";
import {
	Save,
	Loader2,
	Bold,
	Italic,
	List,
	ListOrdered,
	Code,
	Quote,
} from "lucide-react";
import { logInfo, logError } from "@/utils/logger";
import type { DocumentEditorProps } from "./types";
import { cn } from "@/lib/utils";
import "./tiptap-editor.css";

// Configure markdown parser
marked.setOptions({
	gfm: true,
	breaks: true,
});

// Configure HTML to Markdown converter
const turndownService = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
});

export const MarkdownEditor: React.FC<DocumentEditorProps> = ({
	file,
	initialContent,
	onContentChange,
	onSave,
	readOnly = false,
	className,
}) => {
	const { t } = useTranslation("documents");
	const [isSaving, setIsSaving] = useState(false);
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

	// Convert markdown to HTML for initial content
	const initialHtmlContent = useMemo(() => {
		try {
			return marked.parse(initialContent) as string;
		} catch (error) {
			logError("[MARKDOWN_EDITOR] Failed to parse markdown:", error);
			return initialContent;
		}
	}, [initialContent]);

	// Initialize Tiptap editor
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				heading: {
					levels: [1, 2, 3, 4, 5, 6],
				},
			}),
			Placeholder.configure({
				placeholder: t("editor.markdownPlaceholder", {
					defaultValue:
						"Start writing... (Type # for heading, * for list, etc.)",
				}),
			}),
		],
		content: initialHtmlContent,
		editable: !readOnly,
		editorProps: {
			attributes: {
				class:
					"prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none p-4 min-h-[500px]",
			},
		},
		onUpdate: ({ editor }) => {
			const html = editor.getHTML();
			const markdown = turndownService.turndown(html);
			setHasUnsavedChanges(markdown !== initialContent);
			onContentChange?.(markdown);
		},
	});

	// Update editor content when initialContent changes
	useEffect(() => {
		if (!editor || !initialContent) return;

		// Get current content as markdown to compare
		const currentHtml = editor.getHTML();
		const currentMarkdown = turndownService.turndown(currentHtml);

		// Only update if the markdown content actually changed
		// This prevents unnecessary resets after save
		if (currentMarkdown.trim() !== initialContent.trim()) {
			const newHtml = marked.parse(initialContent) as string;
			editor.commands.setContent(newHtml);
			setHasUnsavedChanges(false);
		}
	}, [initialContent, editor]);

	// Handle save - convert HTML to Markdown before saving
	const handleSave = useCallback(async () => {
		if (!editor || !hasUnsavedChanges || isSaving || readOnly) return;

		try {
			setIsSaving(true);
			const html = editor.getHTML();
			// Convert HTML back to Markdown
			const markdown = turndownService.turndown(html);
			await onSave(markdown);
			setHasUnsavedChanges(false);
			logInfo(`[MARKDOWN_EDITOR] Saved ${file.name} as markdown`);
		} catch (error) {
			logError("[MARKDOWN_EDITOR] Failed to save:", error);
		} finally {
			setIsSaving(false);
		}
	}, [editor, file.name, hasUnsavedChanges, isSaving, onSave, readOnly]);

	// Keyboard shortcut: Ctrl+S / Cmd+S
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key === "s") {
				event.preventDefault();
				handleSave();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleSave]);

	// Cleanup editor on unmount
	useEffect(() => {
		return () => {
			editor?.destroy();
		};
	}, [editor]);

	if (!editor) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className={cn("flex flex-col h-full", className)}>
			{/* Toolbar */}
			<div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-card">
				<div className="flex items-center gap-2 flex-wrap">
					<h3 className="text-sm font-medium truncate">{file.name}</h3>
					{hasUnsavedChanges && (
						<span className="text-xs text-muted-foreground">
							{t("editor.unsavedChanges", {
								defaultValue: "(Unsaved changes)",
							})}
						</span>
					)}
				</div>

				{/* Formatting toolbar */}
				<div className="flex items-center gap-1">
					<Button
						variant={editor.isActive("bold") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleBold().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Bold (Ctrl+B)"
					>
						<Bold className="h-4 w-4" />
					</Button>
					<Button
						variant={editor.isActive("italic") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleItalic().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Italic (Ctrl+I)"
					>
						<Italic className="h-4 w-4" />
					</Button>
					<Button
						variant={editor.isActive("code") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleCode().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Code (Ctrl+E)"
					>
						<Code className="h-4 w-4" />
					</Button>
					<div className="w-px h-6 bg-border mx-1" />
					<Button
						variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleBulletList().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Bullet List"
					>
						<List className="h-4 w-4" />
					</Button>
					<Button
						variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Numbered List"
					>
						<ListOrdered className="h-4 w-4" />
					</Button>
					<Button
						variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
						size="sm"
						onClick={() => editor.chain().focus().toggleBlockquote().run()}
						disabled={readOnly}
						className="h-8 w-8 p-0"
						title="Quote"
					>
						<Quote className="h-4 w-4" />
					</Button>
					<div className="w-px h-6 bg-border mx-1" />
					<Button
						size="sm"
						onClick={handleSave}
						disabled={!hasUnsavedChanges || isSaving || readOnly}
						className="gap-2"
					>
						{isSaving ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								{t("editor.saving", { defaultValue: "Saving..." })}
							</>
						) : (
							<>
								<Save className="h-4 w-4" />
								{t("editor.save", { defaultValue: "Save" })}
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Editor */}
			<div className="flex-1 overflow-auto bg-background">
				<EditorContent editor={editor} className="h-full" />
			</div>

			{/* Status Bar */}
			<div className="px-4 py-1 border-t bg-card text-xs text-muted-foreground flex items-center justify-between">
				<span>
					{t("editor.characterCount", {
						count:
							editor.storage.characterCount?.characters() ||
							editor.getText().length,
						defaultValue: `${editor.getText().length} characters`,
					})}
				</span>
				<span className="text-xs">
					{t("editor.saveHint", {
						defaultValue:
							"Markdown shortcuts: ## for heading, * for list | Ctrl+S to save",
					})}
				</span>
			</div>
		</div>
	);
};
