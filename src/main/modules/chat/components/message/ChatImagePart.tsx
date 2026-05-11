import React, { useState, useEffect } from "react";
import type { ComplexContent, ComplexContentPartImage } from "@/types/chat";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

export const ChatImagePart: React.FC<{ part: ComplexContentPartImage }> = ({
	part,
}) => {
	const [dataUri, setDataUri] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		documentFileSystemService
			.readFileAsBase64(part.path, part.mimeType)
			.then((uri) => {
				if (!cancelled) setDataUri(uri);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [part.path, part.mimeType]);

	if (!dataUri) return null;

	return (
		<img
			src={dataUri}
			alt=""
			className="max-h-48 rounded-md object-contain border border-border mt-1"
		/>
	);
};

export const MessageComplexImages: React.FC<{
	complexContent: ComplexContent;
}> = ({ complexContent }) => {
	const imageParts = complexContent.filter(
		(p) => p.type === "image",
	) as ComplexContentPartImage[];
	if (imageParts.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 mb-2">
			{imageParts.map((part, i) => (
				<ChatImagePart key={i} part={part} />
			))}
		</div>
	);
};
