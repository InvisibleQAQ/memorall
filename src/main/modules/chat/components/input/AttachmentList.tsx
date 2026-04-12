import React, { useEffect, useState } from "react";
import { X, FileText, Image as ImageIcon, File } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AttachedDocumentRef } from "@/types/chat";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

const RemoveAttachmentButton: React.FC<{
	label: string;
	onClick: () => void;
	className?: string;
}> = ({ label, onClick, className }) => (
	<button
		type="button"
		onClick={onClick}
		className={cn(
			"inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent text-muted-foreground shadow-none transition hover:text-foreground",
			className,
		)}
		aria-label={label}
	>
		<X size={11} />
	</button>
);

const AttachmentBox: React.FC<{
	name: string;
	preview: React.ReactNode;
	onRemove: () => void;
}> = ({ name, preview, onRemove }) => (
	<div className="group relative w-[92px] shrink-0">
		<div className="rounded-xl border border-border/70 bg-muted/10 p-1.5">
			<div className="relative flex h-[58px] items-center justify-center overflow-hidden rounded-lg bg-muted/20">
				{preview}
				<RemoveAttachmentButton
					label={`Remove ${name}`}
					onClick={onRemove}
					className="absolute right-1 top-1"
				/>
			</div>
			<div
				className="mt-1.5 truncate px-0.5 text-[11px] leading-4 text-foreground"
				title={name}
			>
				{name}
			</div>
		</div>
	</div>
);

const UploadedImageThumbnail: React.FC<{
	file: File;
	onRemove: () => void;
}> = ({ file, onRemove }) => {
	const [previewUrl, setPreviewUrl] = useState<string>("");

	useEffect(() => {
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => {
			URL.revokeObjectURL(url);
		};
	}, [file]);

	return (
		<AttachmentBox
			name={file.name}
			onRemove={onRemove}
			preview={
				previewUrl ? (
					<img
						src={previewUrl}
						alt={file.name}
						className="h-full w-full object-cover"
					/>
				) : (
					<ImageIcon size={16} className="text-muted-foreground" />
				)
			}
		/>
	);
};

const DocRefThumbnail: React.FC<{
	docRef: AttachedDocumentRef;
	onRemove: () => void;
}> = ({ docRef, onRemove }) => {
	const [dataUrl, setDataUrl] = useState<string | null>(null);
	const isImage = docRef.mimeType.startsWith("image/");

	useEffect(() => {
		if (!isImage) return;
		documentFileSystemService
			.readFileAsBase64(docRef.path, docRef.mimeType)
			.then(setDataUrl)
			.catch(() => {});
	}, [docRef.path, docRef.mimeType, isImage]);

	if (isImage && dataUrl) {
		return (
			<AttachmentBox
				name={docRef.name}
				onRemove={onRemove}
				preview={
					<img
						src={dataUrl}
						alt={docRef.name}
						className="h-full w-full object-cover"
					/>
				}
			/>
		);
	}

	return (
		<AttachmentBox
			name={docRef.name}
			onRemove={onRemove}
			preview={
				<span className="text-muted-foreground">
					{docRef.docType === "pdf" ? (
						<File size={18} />
					) : (
						<FileText size={18} />
					)}
				</span>
			}
		/>
	);
};

export interface AttachmentListProps {
	attachedImages: File[];
	attachedDocumentRefs: AttachedDocumentRef[];
	onRemoveImage: (index: number) => void;
	onRemoveDocRef: (index: number) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
	attachedImages,
	attachedDocumentRefs,
	onRemoveImage,
	onRemoveDocRef,
}) => (
	<div className="flex max-w-full flex-wrap items-start gap-2 px-3 pt-2">
		{attachedImages.map((file, index) => (
			<UploadedImageThumbnail
				key={`img-${index}`}
				file={file}
				onRemove={() => onRemoveImage(index)}
			/>
		))}
		{attachedDocumentRefs.map((ref, index) => (
			<DocRefThumbnail
				key={`ref-${index}`}
				docRef={ref}
				onRemove={() => onRemoveDocRef(index)}
			/>
		))}
	</div>
);
