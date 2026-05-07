import React from "react";
import type {
	ActionRenderer,
	MessageActionItem,
} from "@/main/modules/chat/components/types";
import { Badge } from "@/main/components/ui/badge";
import { defaultActionRenderer } from "./DefaultActionRenderer";
import {
	getString,
	getToolCallArguments,
	ToolCodeBlock,
	ToolDetail,
	ToolDetailsGrid,
	ToolItemRawIO,
	ToolSection,
	ToolStateBadge,
} from "./ToolCommon";

type DescriptionParts = {
	inputText?: string;
	outputText: string;
};

type PdfMetadataView = {
	source?: string;
	totalPages?: string;
	hasImages?: boolean;
	imagePages?: string;
	imagePageCount?: string;
	documentInfo: Array<{ label: string; value: string }>;
	pages: string[];
};

type PdfTextView = {
	title: string;
	source?: string;
	output?: string;
	totalPages?: string;
	pages?: string;
	format?: string;
	characters?: string;
	text?: string;
};

const splitActionDescription = (description: string): DescriptionParts => {
	const normalized = description.replace(/\r\n/g, "\n");
	const match = normalized.match(/^input:\n([\s\S]*?)\noutput:\n([\s\S]*)$/);

	if (!match) {
		return { outputText: normalized };
	}

	return {
		inputText: match[1],
		outputText: match[2],
	};
};

const getLineValue = (lines: string[], label: string): string | undefined => {
	const prefix = `${label}:`;
	const line = lines.find((candidate) => candidate.startsWith(prefix));
	return line?.slice(prefix.length).trim();
};

const parsePdfMetadataOutput = (outputText: string): PdfMetadataView | null => {
	const lines = outputText.split(/\r?\n/);
	if (lines[0] !== "PDF metadata") return null;

	const documentInfoStart = lines.indexOf("Document info");
	const pagesStart = lines.indexOf("Pages");
	const documentInfoLines =
		documentInfoStart >= 0
			? lines
					.slice(
						documentInfoStart + 1,
						pagesStart >= 0 ? pagesStart : undefined,
					)
					.filter(Boolean)
			: [];

	return {
		source: getLineValue(lines, "Source"),
		totalPages: getLineValue(lines, "Total pages"),
		hasImages: getLineValue(lines, "Has images") === "yes",
		imagePages: getLineValue(lines, "Image pages"),
		imagePageCount: getLineValue(lines, "Image page count"),
		documentInfo: documentInfoLines.map((line) => {
			const [label, ...rest] = line.split(":");
			return {
				label: label.trim(),
				value: rest.join(":").trim(),
			};
		}),
		pages:
			pagesStart >= 0
				? lines
						.slice(pagesStart + 1)
						.map((line) => line.trim())
						.filter(Boolean)
				: [],
	};
};

const parsePdfTextOutput = (outputText: string): PdfTextView | null => {
	const lines = outputText.split(/\r?\n/);
	const title = lines[0];
	if (
		title !== "PDF text extraction" &&
		title !== "PDF text extraction saved"
	) {
		return null;
	}

	const blankIndex = lines.indexOf("");
	const headerLines = blankIndex >= 0 ? lines.slice(0, blankIndex) : lines;
	const bodyLines = blankIndex >= 0 ? lines.slice(blankIndex + 1) : [];

	return {
		title,
		source: getLineValue(headerLines, "Source"),
		output: getLineValue(headerLines, "Output"),
		totalPages: getLineValue(headerLines, "Total pages"),
		pages: getLineValue(headerLines, "Pages"),
		format: getLineValue(headerLines, "Format"),
		characters: getLineValue(headerLines, "Characters"),
		text: bodyLines.join("\n").trim() || undefined,
	};
};

const renderError = (
	item: MessageActionItem,
	input: unknown,
	outputText: string,
): React.ReactNode => (
	<div className="space-y-3">
		<ToolSection title="PDF Error">
			<div className="flex items-center gap-2">
				<ToolStateBadge ok={false} />
				<Badge variant="outline" className="text-[10px] font-mono">
					{item.name}
				</Badge>
			</div>
			<div className="mt-3 rounded-md border border-red-600/20 bg-red-600/5 px-3 py-2 text-xs text-red-700">
				{outputText.replace(/^PDF (?:metadata|text extraction) error:\s*/, "")}
			</div>
		</ToolSection>
		<ToolItemRawIO item={item} input={input} output={outputText} />
	</div>
);

const renderPdfMetadata = (
	view: PdfMetadataView,
	item: MessageActionItem,
	input: unknown,
	outputText: string,
): React.ReactNode => (
	<div className="space-y-3">
		<ToolSection title="PDF Metadata">
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<ToolStateBadge ok />
				<Badge
					variant="outline"
					className={
						view.hasImages
							? "border-amber-600/30 bg-amber-600/10 text-[10px] text-amber-700"
							: "text-[10px]"
					}
				>
					{view.hasImages ? "contains images" : "text-only"}
				</Badge>
			</div>
			<ToolDetailsGrid>
				{view.source ? (
					<ToolDetail label="Source" value={view.source} mono />
				) : null}
				{view.totalPages ? (
					<ToolDetail label="Total pages" value={view.totalPages} mono />
				) : null}
				<ToolDetail
					label="Has images"
					value={view.hasImages ? "yes" : "no"}
					mono
				/>
				{view.imagePages ? (
					<ToolDetail label="Image pages" value={view.imagePages} mono />
				) : null}
				{view.imagePageCount ? (
					<ToolDetail
						label="Image page count"
						value={view.imagePageCount}
						mono
					/>
				) : null}
			</ToolDetailsGrid>
		</ToolSection>

		{view.documentInfo.length ? (
			<ToolSection title="Document Info">
				<ToolDetailsGrid>
					{view.documentInfo.map((entry) => (
						<ToolDetail
							key={entry.label}
							label={entry.label}
							value={entry.value || "Not available"}
						/>
					))}
				</ToolDetailsGrid>
			</ToolSection>
		) : null}

		{view.pages.length ? (
			<ToolSection title="Pages">
				<ToolCodeBlock>{view.pages.join("\n")}</ToolCodeBlock>
			</ToolSection>
		) : null}

		<ToolItemRawIO item={item} input={input} output={outputText} />
	</div>
);

const renderPdfText = (
	view: PdfTextView,
	item: MessageActionItem,
	input: unknown,
	outputText: string,
): React.ReactNode => (
	<div className="space-y-3">
		<ToolSection
			title={
				view.title === "PDF text extraction saved"
					? "PDF Text Saved"
					: "PDF Text"
			}
		>
			<div className="mb-3">
				<ToolStateBadge ok />
			</div>
			<ToolDetailsGrid>
				{view.source ? (
					<ToolDetail label="Source" value={view.source} mono />
				) : null}
				{view.output ? (
					<ToolDetail label="Output" value={view.output} mono />
				) : null}
				{view.totalPages ? (
					<ToolDetail label="Total pages" value={view.totalPages} mono />
				) : null}
				{view.pages ? (
					<ToolDetail label="Pages" value={view.pages} mono />
				) : null}
				{view.format ? (
					<ToolDetail label="Format" value={view.format} mono />
				) : null}
				{view.characters ? (
					<ToolDetail label="Characters" value={view.characters} mono />
				) : null}
			</ToolDetailsGrid>
			{view.text ? (
				<div className="mt-3">
					<ToolCodeBlock>{view.text}</ToolCodeBlock>
				</div>
			) : null}
		</ToolSection>
		<ToolItemRawIO item={item} input={input} output={outputText} />
	</div>
);

const renderPdfImage = (
	item: MessageActionItem,
	input: Record<string, unknown> | null,
	outputText: string,
): React.ReactNode => (
	<div className="space-y-3">
		<ToolSection title="PDF Image Render">
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<ToolStateBadge ok />
				<Badge variant="outline" className="text-[10px]">
					image content returned to model
				</Badge>
			</div>
			<ToolDetailsGrid>
				{getString(input ?? {}, "source_path") ? (
					<ToolDetail
						label="Source"
						value={getString(input ?? {}, "source_path")}
						mono
					/>
				) : null}
				{input?.page_range && typeof input.page_range === "object" ? (
					<ToolDetail
						label="Pages"
						value={`${(input.page_range as Record<string, unknown>).start ?? "?"}-${(input.page_range as Record<string, unknown>).end ?? "?"}`}
						mono
					/>
				) : null}
				{typeof input?.scale === "number" ? (
					<ToolDetail label="Scale" value={String(input.scale)} mono />
				) : null}
				{getString(input ?? {}, "mode") ? (
					<ToolDetail
						label="Mode"
						value={getString(input ?? {}, "mode")}
						mono
					/>
				) : null}
				{getString(input ?? {}, "detail") ? (
					<ToolDetail
						label="Detail"
						value={getString(input ?? {}, "detail")}
						mono
					/>
				) : null}
			</ToolDetailsGrid>
			{outputText.trim() ? (
				<div className="mt-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
					{outputText.trim()}
				</div>
			) : null}
		</ToolSection>
		<ToolItemRawIO item={item} input={input} output={outputText} />
	</div>
);

export const documentConvertRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const { inputText, outputText } = splitActionDescription(item.description);
	const rawInput = args ?? inputText;

	if (
		outputText.startsWith("PDF metadata error:") ||
		outputText.startsWith("PDF text extraction error:")
	) {
		return renderError(item, rawInput, outputText);
	}

	if (item.name === "pdf_metadata") {
		const view = parsePdfMetadataOutput(outputText);
		return view
			? renderPdfMetadata(view, item, rawInput, outputText)
			: defaultActionRenderer(item, isOpen);
	}

	if (item.name === "pdf_to_text") {
		const view = parsePdfTextOutput(outputText);
		return view
			? renderPdfText(view, item, rawInput, outputText)
			: defaultActionRenderer(item, isOpen);
	}

	if (item.name === "pdf_to_image") {
		return renderPdfImage(item, args, outputText);
	}

	return defaultActionRenderer(item, isOpen);
};
