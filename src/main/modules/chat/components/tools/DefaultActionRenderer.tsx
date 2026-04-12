import React, { useState, useEffect } from "react";
import type { ActionRenderer } from "@/main/modules/chat/components/types";
import type { ToolResultImage } from "@/services/flows/interfaces/tool";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import {
	extractMermaidContent,
	isMermaidOnly,
	TaskMermaidDiagram,
} from "./TaskMermaidDiagram";
import { ToolItemRawIO } from "./ToolCommon";

const isToolResultImages = (value: unknown): value is ToolResultImage[] =>
	Array.isArray(value) &&
	value.every(
		(v) =>
			v !== null &&
			typeof v === "object" &&
			typeof (v as ToolResultImage).path === "string" &&
			typeof (v as ToolResultImage).mimeType === "string",
	);

/** Loads and renders a single image stored in document-fs. */
const ToolActionImage: React.FC<{ image: ToolResultImage }> = ({ image }) => {
	const [dataUri, setDataUri] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		documentFileSystemService
			.readFileAsBase64(image.path, image.mimeType)
			.then((uri) => {
				if (!cancelled) setDataUri(uri);
			})
			.catch(() => {
				// silently ignore broken images
			});
		return () => {
			cancelled = true;
		};
	}, [image.path, image.mimeType]);

	if (!dataUri) return null;

	return (
		<img
			src={dataUri}
			alt=""
			className="max-w-full max-h-64 rounded-md object-contain border border-border"
		/>
	);
};

/** Renders all images from a tool result's metadata.images array. */
const ToolResultImages: React.FC<{ metadata?: Record<string, unknown> }> = ({
	metadata,
}) => {
	if (!metadata) return null;
	const images = metadata.images;
	if (!isToolResultImages(images) || images.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-2">
			{images.map((img, i) => (
				<ToolActionImage key={i} image={img} />
			))}
		</div>
	);
};

export const defaultActionRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const trimmedDesc = item.description?.trim() || "";
	if (isMermaidOnly(trimmedDesc)) {
		return (
			<div className="space-y-3">
				<ToolResultImages metadata={item.metadata} />
				<TaskMermaidDiagram
					chart={extractMermaidContent(trimmedDesc)}
					isOpen={isOpen}
				/>
				<ToolItemRawIO item={item} />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<ToolResultImages metadata={item.metadata} />
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
			<ToolItemRawIO item={item} />
		</div>
	);
};
