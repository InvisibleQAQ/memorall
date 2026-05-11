import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	FileText,
	Image as ImageIcon,
	File,
	BookOpen,
	Search,
	X,
} from "lucide-react";

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
	path?: string;
	/** Present when kind === "skill" */
	description?: string;
}

export function documentFileToMentionItem(file: DocumentFile): MentionItem {
	return {
		id: file.id,
		name: file.name,
		kind: "document",
		docType: file.type,
		path: file.path,
		description: file.metadata?.description,
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
	anchorRef?: React.RefObject<HTMLElement | null>;
	searchPlaceholder?: string;
	emptyText?: string;
	onSearchTextChange?: (value: string) => void;
	onHighlightChange?: (index: number) => void;
	onClose: () => void;
	onSelect: (item: MentionItem) => void;
}

export const MentionPopup: React.FC<MentionPopupProps> = ({
	isOpen,
	items,
	highlightIndex,
	title,
	searchText,
	anchorRef,
	searchPlaceholder = "Search documents...",
	emptyText = "No matches",
	onSearchTextChange,
	onHighlightChange,
	onClose,
	onSelect,
}) => {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const [portalRect, setPortalRect] = useState<{
		bottom: number;
		left: number;
		width: number;
	} | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		itemRefs.current[highlightIndex]?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex, isOpen]);

	useEffect(() => {
		if (!isOpen || !onSearchTextChange) return;
		requestAnimationFrame(() => searchInputRef.current?.focus());
	}, [isOpen, onSearchTextChange]);

	useLayoutEffect(() => {
		if (!isOpen || !anchorRef?.current) {
			setPortalRect(null);
			return;
		}

		const updatePosition = () => {
			const rect = anchorRef.current?.getBoundingClientRect();
			if (!rect) return;
			setPortalRect({
				bottom: window.innerHeight - rect.top + 8,
				left: rect.left,
				width: rect.width,
			});
		};

		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [anchorRef, isOpen]);

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

	if (!isOpen) return null;

	const popup = (
		<div
			ref={containerRef}
			className="isolate flex max-h-[min(22rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
			style={
				portalRect
					? {
							bottom: portalRect.bottom,
							left: portalRect.left,
							position: "fixed",
							width: portalRect.width,
							zIndex: 1000,
						}
					: undefined
			}
		>
			<div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground">
				{onSearchTextChange ? (
					<div className="flex min-w-0 flex-1 items-center gap-2">
						<Search size={13} className="shrink-0 text-muted-foreground" />
						<input
							ref={searchInputRef}
							value={searchText}
							onChange={(event) => onSearchTextChange(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "ArrowDown" && items.length > 0) {
									event.preventDefault();
									onHighlightChange?.(
										Math.min(highlightIndex + 1, items.length - 1),
									);
									return;
								}
								if (event.key === "ArrowUp" && items.length > 0) {
									event.preventDefault();
									onHighlightChange?.(Math.max(highlightIndex - 1, 0));
									return;
								}
								if (event.key === "Escape") {
									event.preventDefault();
									onClose();
									return;
								}
								if (event.key === "Enter" && items[highlightIndex]) {
									event.preventDefault();
									onSelect(items[highlightIndex]);
								}
							}}
							placeholder={searchPlaceholder}
							className="h-7 min-w-0 flex-1 bg-transparent text-sm text-popover-foreground outline-none placeholder:text-muted-foreground"
						/>
					</div>
				) : (
					<>
						<span>{title}</span>
						<div className="flex min-w-0 items-center gap-2">
							{searchText ? (
								<span className="truncate text-[11px] text-foreground/80">
									@{searchText}
								</span>
							) : null}
						</div>
					</>
				)}
				<div className="flex shrink-0 items-center gap-2">
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
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-popover">
				{items.length === 0 ? (
					<div className="px-3 py-5 text-center text-sm text-muted-foreground">
						{emptyText}
					</div>
				) : null}
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
							"flex w-full items-center gap-2 bg-popover px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
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

	if (anchorRef && portalRect && typeof document !== "undefined") {
		return createPortal(popup, document.body);
	}

	return (
		<div className="absolute bottom-full left-0 right-0 z-[100] mb-2">
			{popup}
		</div>
	);
};
