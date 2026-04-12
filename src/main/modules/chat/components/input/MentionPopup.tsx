import React, { useEffect, useRef } from "react";
import { FileText, Image as ImageIcon, File, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DocumentFile, DocumentTreeNode } from "@/types/document-library";

function getMentionIcon(type: DocumentFile["type"]) {
	if (type === "image") return <ImageIcon size={14} />;
	if (type === "pdf") return <File size={14} />;
	return <FileText size={14} />;
}

export function collectFiles(nodes: DocumentTreeNode[]): DocumentFile[] {
	const files: DocumentFile[] = [];
	for (const node of nodes) {
		if (node.type === "file" && node.file) files.push(node.file);
		if (node.children?.length) files.push(...collectFiles(node.children));
	}
	return files;
}

export interface MentionPopupProps {
	isOpen: boolean;
	files: DocumentFile[];
	highlightIndex: number;
	title: string;
	searchText: string;
	onClose: () => void;
	onSelect: (file: DocumentFile) => void;
}

export const MentionPopup: React.FC<MentionPopupProps> = ({
	isOpen,
	files,
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
		itemRefs.current[highlightIndex]?.scrollIntoView({
			block: "nearest",
		});
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

	if (!isOpen || files.length === 0) return null;

	return (
		<div
			ref={containerRef}
			className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-md overflow-hidden z-50"
		>
			<div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
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
						aria-label="Close documents popup"
					>
						<X size={12} />
					</button>
				</div>
			</div>
			<div className="max-h-48 overflow-y-auto">
				{files.map((file, idx) => (
					<button
						key={file.id}
						ref={(node) => {
							itemRefs.current[idx] = node;
						}}
						type="button"
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(file);
						}}
						className={cn(
							"w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
							idx === highlightIndex && "bg-accent",
						)}
					>
						<span className="text-muted-foreground shrink-0">
							{getMentionIcon(file.type)}
						</span>
						<span className="truncate flex-1">{file.name}</span>
						<span className="text-xs text-muted-foreground shrink-0 capitalize">
							{file.type}
						</span>
					</button>
				))}
			</div>
		</div>
	);
};
