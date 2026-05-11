import React, { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, File, BookOpen, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocumentFile, DocumentTreeNode } from "@/types/document-library";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function collectFiles(nodes: DocumentTreeNode[]): DocumentFile[] {
	const files: DocumentFile[] = [];
	for (const node of nodes) {
		if (node.type === "file" && node.file) files.push(node.file);
		if (node.children?.length) files.push(...collectFiles(node.children));
	}
	return files;
}

// ---------------------------------------------------------------------------
// Unified mention item
// ---------------------------------------------------------------------------

export type MentionItemKind = "document" | "skill";

export interface MentionItem {
	id: string;
	name: string;
	kind: MentionItemKind;
	/** Present when kind === "document" */
	docType?: DocumentFile["type"];
	/** Present when kind === "skill" */
	description?: string;
}

export function documentFileToMentionItem(file: DocumentFile): MentionItem {
	return {
		id: file.id,
		name: file.name,
		kind: "document",
		docType: file.type,
	};
}

function getMentionIcon(item: MentionItem): React.ReactNode {
	if (item.kind === "skill") return <BookOpen size={14} />;
	if (item.docType === "image") return <ImageIcon size={14} />;
	if (item.docType === "pdf") return <File size={14} />;
	return <FileText size={14} />;
}

function getMentionBadge(item: MentionItem): string {
	if (item.kind === "skill") return "skill";
	return item.docType ?? "doc";
}

// ---------------------------------------------------------------------------
// MentionPopup
// ---------------------------------------------------------------------------

export interface MentionPopupProps {
	isOpen: boolean;
	items: MentionItem[];
	highlightIndex: number;
	title: string;
	searchText: string;
	onClose: () => void;
	onSelect: (item: MentionItem) => void;
}

export const MentionPopup: React.FC<MentionPopupProps> = ({
	isOpen,
	items,
	highlightIndex,
	title,
	searchText,
	onClose,
	onSelect,
}) => {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

	useEffect(() => {
		if (!isOpen) return;
		itemRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (event: MouseEvent | TouchEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (containerRef.current?.contains(target)) return;
			onClose();
		};

		document.addEventListener("mousedown", handlePointerDown);
		document.addEventListener("touchstart", handlePointerDown);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown);
			document.removeEventListener("touchstart", handlePointerDown);
		};
	}, [isOpen, onClose]);

	if (!isOpen || items.length === 0) return null;

	return (
		<div
			ref={containerRef}
			className="absolute bottom-full left-0 right-0 z-[80] mb-2 flex max-h-[min(22rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl"
		>
			<div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
				<span>{title}</span>
				<div className="flex min-w-0 items-center gap-2">
					{searchText ? (
						<span className="truncate text-[11px] text-foreground/80">
							@{searchText}
						</span>
					) : null}
					<button
						type="button"
						onClick={onClose}
						className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition hover:text-foreground"
						aria-label="Close mention popup"
					>
						<X size={12} />
					</button>
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background">
				{items.map((item, idx) => (
					<button
						key={item.id}
						ref={(node) => {
							itemRefs.current[idx] = node;
						}}
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(item);
						}}
						className={cn(
							"flex w-full items-center gap-2 bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
							idx === highlightIndex && "bg-accent",
						)}
					>
						<span className="text-muted-foreground shrink-0">
							{getMentionIcon(item)}
						</span>
						<span className="truncate flex-1">{item.name}</span>
						{item.kind === "skill" && item.description ? (
							<span className="truncate max-w-[120px] text-[11px] text-muted-foreground/70 shrink-0">
								{item.description}
							</span>
						) : null}
						<span className="text-xs text-muted-foreground shrink-0 capitalize">
							{getMentionBadge(item)}
						</span>
					</button>
				))}
			</div>
		</div>
	);
};
