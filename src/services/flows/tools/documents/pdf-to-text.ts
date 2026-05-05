import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode } from "@/types/document-library";
import { readPDFFile } from "@/main/modules/documents/handlers/pdf-extraction";
import { formatPDFAsText, formatPDFAsMarkdown } from "@/lib/pdf-utils";
import { normalizeDocumentPath } from "./util";
import { ensureFolderExists } from "@/services/filesystem/document-fs-utils";

const TOOL_NAME = "pdf_to_text" as const;

const schema = z.object({
	source_path: z
		.string()
		.describe("Path to the PDF file in /documents. Must end with .pdf."),
	output_path: z
		.string()
		.optional()
		.describe(
			"Optional path to save the extracted text in /documents. If omitted, the text is returned directly.",
		),
	format: z
		.enum(["text", "markdown"])
		.optional()
		.describe(
			"Output format: `text` (default) for plain text with page separators, `markdown` for Markdown with frontmatter and headings.",
		),
	page_range: z
		.object({
			start: z.number().describe("First page to extract (1-based)."),
			end: z.number().describe("Last page to extract (1-based, inclusive)."),
		})
		.optional()
		.describe("Optional page range to extract. Defaults to all pages."),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

function flattenTree(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
	const result: DocumentTreeNode[] = [];
	for (const node of nodes) {
		result.push(node);
		if (node.children?.length) result.push(...flattenTree(node.children));
	}
	return result;
}

function toArrayBuffer(content: Uint8Array): ArrayBuffer {
	if (content.buffer instanceof ArrayBuffer) {
		return content.buffer.slice(
			content.byteOffset,
			content.byteOffset + content.byteLength,
		);
	}
	const copy = new Uint8Array(content.byteLength);
	copy.set(content);
	return copy.buffer;
}

export const createPdfToTextTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Extract text from a PDF file in /documents and return it or save it to a new file. Supports plain text or Markdown output and optional page range extraction.",
	schema,
	execute: async (input) => {
		const dfs = services.documentFileSystem;
		if (!dfs) {
			return JSON.stringify({
				actionType: "pdf_to_text",
				success: false,
				error: "Document filesystem service is not available.",
			});
		}

		const sourcePath = normalizeDocumentPath(input.source_path);
		if (!sourcePath.toLowerCase().endsWith(".pdf")) {
			return JSON.stringify({
				actionType: "pdf_to_text",
				success: false,
				error: `source_path must end with .pdf, got: ${input.source_path}`,
			});
		}

		try {
			const tree = await dfs.getTree();
			const allNodes = flattenTree(tree);
			const node = allNodes.find(
				(n) => n.path === sourcePath && n.type === "file",
			);

			if (!node || !node.file) {
				return JSON.stringify({
					actionType: "pdf_to_text",
					success: false,
					error: `File not found: ${input.source_path}`,
				});
			}

			const content = await dfs.getFileContent(sourcePath);
			const pdfData = await readPDFFile(toArrayBuffer(content));

			const fmt = input.format ?? "text";
			let extractedText: string;

			if (input.page_range) {
				const { start, end } = input.page_range;
				const actualStart = Math.max(1, start);
				const actualEnd = Math.min(pdfData.numPages, end);
				const pages = pdfData.pages.filter(
					(p) => p.pageNumber >= actualStart && p.pageNumber <= actualEnd,
				);
				extractedText = pages.map((p) => p.text).join("\n\n");
			} else {
				extractedText =
					fmt === "markdown"
						? formatPDFAsMarkdown(pdfData)
						: formatPDFAsText(pdfData);
			}

			if (!input.output_path) {
				return JSON.stringify(
					{
						actionType: "pdf_to_text",
						success: true,
						source_path: sourcePath,
						num_pages: pdfData.numPages,
						format: fmt,
						text: extractedText,
					},
					null,
					2,
				);
			}

			// Save to output_path
			const outputPath = normalizeDocumentPath(input.output_path);
			const lastSlash = outputPath.lastIndexOf("/");
			const parentPath =
				lastSlash > 0 ? outputPath.substring(0, lastSlash) : "/";
			const fileName = outputPath.substring(lastSlash + 1);

			if (!fileName) {
				return JSON.stringify({
					actionType: "pdf_to_text",
					success: false,
					error: "Invalid output_path — no filename provided.",
				});
			}

			await ensureFolderExists(dfs, parentPath);

			const existingNode = allNodes.find(
				(n) => n.path === outputPath && n.type === "file",
			);
			if (existingNode) {
				const encoded = new TextEncoder().encode(extractedText);
				await dfs.updateFileContent(outputPath, encoded);
			} else {
				const mimeType = fmt === "markdown" ? "text/markdown" : "text/plain";
				const file = new File([extractedText], fileName, { type: mimeType });
				await dfs.uploadFile(file, parentPath);
			}

			return JSON.stringify(
				{
					actionType: "pdf_to_text",
					success: true,
					source_path: sourcePath,
					output_path: outputPath,
					num_pages: pdfData.numPages,
					format: fmt,
					characters: extractedText.length,
				},
				null,
				2,
			);
		} catch (error) {
			return JSON.stringify({
				actionType: "pdf_to_text",
				success: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	},
});

toolRegistry.register(TOOL_NAME, createPdfToTextTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
