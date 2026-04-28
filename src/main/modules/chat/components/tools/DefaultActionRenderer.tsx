import React, { useState, useEffect } from "react";
import type { ActionRenderer } from "@/main/modules/chat/components/types";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import {
	extractMermaidContent,
	isMermaidOnly,
	TaskMermaidDiagram,
} from "./TaskMermaidDiagram";
import {
	ToolDetail,
	ToolDetailsGrid,
	ToolItemRawIO,
	getMCPActionMetadata,
} from "./ToolCommon";
import { Badge } from "@/main/components/ui/badge";

const MCPToolInfo: React.FC<{
	serverName: string;
	originalToolName?: string;
}> = ({ serverName, originalToolName }) => (
	<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
		<div className="mb-2 flex items-center gap-2">
			<Badge
				variant="outline"
				className="border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-700"
			>
				MCP
			</Badge>
			<span className="text-xs font-medium text-muted-foreground">
				Model Context Protocol tool
			</span>
		</div>
		<ToolDetailsGrid>
			<ToolDetail label="Server" value={serverName} mono />
			{originalToolName ? (
				<ToolDetail label="MCP Tool" value={originalToolName} mono />
			) : null}
		</ToolDetailsGrid>
	</div>
);

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
	const mcpMetadata = getMCPActionMetadata(item);
	if (isMermaidOnly(trimmedDesc)) {
		return (
			<div className="space-y-3">
				{mcpMetadata ? <MCPToolInfo {...mcpMetadata} /> : null}
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
			{mcpMetadata ? <MCPToolInfo {...mcpMetadata} /> : null}
			<ToolResultImages metadata={item.metadata} />
			<div className="w-full overflow-hidden whitespace-pre-wrap break-words">
				{item.description}
			</div>
			<ToolItemRawIO item={item} />
		</div>
	);
};
interface ToolResultImage {
	path: string;
	mimeType: string;
}
