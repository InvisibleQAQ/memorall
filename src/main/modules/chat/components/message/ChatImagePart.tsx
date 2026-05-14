import React from "react";
import type { ComplexContent, ComplexContentPartImageUrl } from "@/types/chat";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";

export const ChatImagePart: React.FC<{ part: ComplexContentPartImageUrl }> = ({
	part,
}) => {
	const [resolvedUrl, setResolvedUrl] = React.useState(part.image_url.url);
	const url = part.image_url.url;

	React.useEffect(() => {
		let mounted = true;
		const mimeType = part.image_url.mimeType;

		if (!url || url.startsWith("data:") || !mimeType) {
			setResolvedUrl(url);
			return;
		}

		documentFileSystemService
			.readFileAsBase64(url, mimeType)
			.then((dataUrl) => {
				if (mounted) setResolvedUrl(dataUrl);
			})
			.catch(() => {
				if (mounted) setResolvedUrl(url);
			});

		return () => {
			mounted = false;
		};
	}, [part.image_url.mimeType, url]);

	if (!url) return null;

	return (
		<img
			src={resolvedUrl}
			alt=""
			className="max-h-48 rounded-md object-contain border border-border mt-1"
		/>
	);
};

export const MessageComplexImages: React.FC<{
	complexContent: ComplexContent;
}> = ({ complexContent }) => {
	const imageParts = complexContent.filter(
		(p) => p.type === "image_url",
	) as ComplexContentPartImageUrl[];
	if (imageParts.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2 mb-2">
			{imageParts.map((part, i) => (
				<ChatImagePart key={i} part={part} />
			))}
		</div>
	);
};
