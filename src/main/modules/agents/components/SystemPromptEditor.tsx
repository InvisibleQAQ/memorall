import React from "react";
import { useTranslation } from "react-i18next";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import TurndownService from "turndown";
import {
	useAgentConfigStore,
	getDefaultSystemPromptForGraph,
} from "@/main/stores/agent-config";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Singleton — never recreated across renders
// ---------------------------------------------------------------------------
const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });

// ---------------------------------------------------------------------------
// Inner WYSIWYG editor — pure presentational, no store awareness
// Typing "## " at line start immediately renders as H2, etc.
// ---------------------------------------------------------------------------
const PromptEditorContent = React.memo<{
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
}>(({ value, onChange, placeholder }) => {
	// Tracks last markdown we produced to skip no-op external syncs
	const currentMdRef = React.useRef(value);

	const editor = useEditor({
		extensions: [StarterKit, Placeholder.configure({ placeholder })],
		content: marked.parse(value || "") as string,
		onUpdate: ({ editor }) => {
			const md = td.turndown(editor.getHTML());
			currentMdRef.current = md;
			onChange(md);
		},
	});

	// Sync when value changes externally (preset switch, reset, revert…)
	React.useEffect(() => {
		if (!editor || currentMdRef.current === value) return;
		currentMdRef.current = value;
		editor.commands.setContent(marked.parse(value || "") as string, {
			emitUpdate: false,
		});
	}, [editor, value]);

	return (
		<EditorContent
			editor={editor}
			className={cn(
				"prose dark:prose-invert max-w-none",
				"[&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:cursor-text [&_.ProseMirror]:text-sm",
				"[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
				"[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
				"[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
				"[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
				"[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
			)}
		/>
	);
});
PromptEditorContent.displayName = "PromptEditorContent";

// ---------------------------------------------------------------------------
// Smart wrapper — reads store, owns local state, renders section label
// ---------------------------------------------------------------------------
export const SystemPromptEditor: React.FC = () => {
	const { t } = useTranslation("agents");
	const { draftConfig, currentGraphType, updateField } = useAgentConfigStore();

	const defaultPrompt = React.useMemo(
		() => getDefaultSystemPromptForGraph(currentGraphType),
		[currentGraphType],
	);

	const [value, setValue] = React.useState(
		draftConfig.systemPrompt || defaultPrompt,
	);

	// Keep in sync when the preset changes externally
	React.useEffect(() => {
		setValue(draftConfig.systemPrompt || defaultPrompt);
	}, [defaultPrompt, draftConfig.systemPrompt]);

	const handleChange = (next: string) => {
		setValue(next);
		updateField("systemPrompt", next === defaultPrompt ? "" : next);
	};

	return (
		<div className="space-y-3">
			<span className="text-sm text-muted-foreground">
				{t("instructions.label")}
			</span>
			<PromptEditorContent
				value={value}
				onChange={handleChange}
				placeholder={t("instructions.placeholder")}
			/>
		</div>
	);
};
