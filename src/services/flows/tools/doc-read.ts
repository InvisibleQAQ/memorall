import z from "zod";
import type { Tool, ToolFactory, AllServices } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode, DocumentType } from "@/types/document-library";
import { readPDFFile } from "@/main/modules/documents/handlers/pdf-extraction";
import {
	parseExcelFile,
	workbookToMarkdown,
} from "@/main/modules/documents/handlers/excel-extraction";

const TOOL_NAME = "doc_read" as const;

const schema = z.object({
	file_path: z.string().describe("Document path to read"),
	offset: z
		.number()
		.optional()
		.describe("Start line, 1-based (default: 1)"),
	limit: z.number().optional().describe("Max lines to return"),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "documentFileSystem">;

function flattenTree(nodes: DocumentTreeNode[]): DocumentTreeNode[] {
	const result: DocumentTreeNode[] = [];
	for (const node of nodes) {
		result.push(node);
		if (node.children?.length) {
			result.push(...flattenTree(node.children));
		}
	}
	return result;
}

function isTextFile(type: DocumentType): boolean {
	return type === "text" || type === "markdown" || type === "other";
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

async function extractReadableText(
	fileType: DocumentType,
	content: Uint8Array,
): Promise<string | null> {
	if (isTextFile(fileType)) {
		return new TextDecoder().decode(content);
	}

	if (fileType === "pdf") {
		const pdfContent = await readPDFFile(toArrayBuffer(content));
		return pdfContent.fullText || pdfContent.pages.map((p) => p.text).join("\n\n");
	}

	if (fileType === "excel") {
		const workbook = await parseExcelFile(content);
		return workbookToMarkdown(workbook);
	}

	return null;
}

export const createDocReadTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Read document file content with line numbers. Returns cat -n style output with a header showing total lines and range. Supports text/markdown/other and best-effort text extraction for PDF/Excel.",
	schema,
	execute: async (input) => {
		const { file_path, offset = 1, limit } = input;

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return 'Documents not existe.'
		}
		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);
		const node = allNodes.find(
			(n) => n.path === file_path && n.type === "file",
		);

		if (!node || !node.file) {
			return `Error: File not found: ${file_path}`;
		}

		const content = await dfs.getFileContent(file_path);
		const text = await extractReadableText(node.file.type, content);

		if (!text) {
			return `Error: Cannot read binary file (${node.file.type}): ${file_path}. Only text, markdown, excel, and pdf files can be read.`;
		}
		const allLines = text.split("\n");
		const totalLines = allLines.length;

		const startIdx = Math.max(0, offset - 1);
		const endIdx = limit ? Math.min(startIdx + limit, totalLines) : totalLines;
		const selectedLines = allLines.slice(startIdx, endIdx);

		const maxLineNum = endIdx;
		const padWidth = String(maxLineNum).length;

		const numberedLines = selectedLines.map((line, i) => {
			const lineNum = String(startIdx + i + 1).padStart(padWidth);
			return `${lineNum}\t${line}`;
		});

		const rangeInfo =
			startIdx > 0 || endIdx < totalLines
				? ` (showing lines ${startIdx + 1}-${endIdx})`
				: "";

		return `File: ${file_path} (${totalLines} lines)${rangeInfo}\n${numberedLines.join("\n")}`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocReadTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
