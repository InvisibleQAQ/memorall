import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import type { DocumentTreeNode, DocumentType } from "@/types/document-library";
import { readPDFFile } from "@/main/modules/documents/handlers/pdf-extraction";
import {
	parseExcelFile,
	workbookToMarkdown,
} from "@/main/modules/documents/handlers/excel-extraction";

const TOOL_NAME = "doc_search" as const;

const schema = z.object({
	pattern: z
		.string()
		.optional()
		.describe(
			"Regex pattern to search file content. If omitted, lists files only",
		),
	path: z.string().optional().describe('Directory scope (default: "/")'),
	file_pattern: z
		.string()
		.optional()
		.describe('Glob to filter file names (e.g., "*.md")'),
	case_sensitive: z
		.boolean()
		.optional()
		.describe("Case sensitive search (default: false)"),
	max_results: z
		.number()
		.optional()
		.describe("Max matching lines (default: 50)"),
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

const MAX_PDF_SEARCH_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_EXCEL_SEARCH_BYTES = 3 * 1024 * 1024; // 3MB

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

async function extractPdfText(content: Uint8Array): Promise<string> {
	const arrayBuffer = toArrayBuffer(content);
	const pdfContent = await readPDFFile(arrayBuffer);
	return (
		pdfContent.fullText || pdfContent.pages.map((p) => p.text).join("\n\n")
	);
}

async function extractExcelText(content: Uint8Array): Promise<string> {
	const workbook = await parseExcelFile(content);
	return workbookToMarkdown(workbook);
}

function globToRegex(pattern: string): RegExp {
	const escaped = pattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${escaped}$`, "i");
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const createDocSearchTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Search document files and content. Without a pattern, lists files with size/type info. With a pattern, searches text/PDF/Excel content (best-effort) and returns matching lines in ripgrep format. Large or unsupported binaries fall back to path-only matching with a note.",
	schema,
	execute: async (input) => {
		const {
			pattern,
			path = "/",
			file_pattern,
			case_sensitive = false,
			max_results = 50,
		} = input;

		const dfs = services.documentFileSystem;
		if (!dfs) {
			return "Documents not existe.";
		}

		const tree = await dfs.getTree();
		const allNodes = flattenTree(tree);

		// Filter by path scope
		const scopedNodes = allNodes.filter((n) => n.path.startsWith(path));

		// Filter by file_pattern glob
		const filePatternRegex = file_pattern ? globToRegex(file_pattern) : null;
		const filteredNodes = scopedNodes.filter((n) => {
			if (!filePatternRegex) return true;
			return filePatternRegex.test(n.name);
		});

		// List mode (no pattern)
		if (!pattern) {
			const files = filteredNodes.filter((n) => n.type === "file" && n.file);
			const folders = filteredNodes.filter(
				(n) => n.type === "folder" && n.folder,
			);

			const lines: string[] = [];
			for (const f of folders) {
				lines.push(`${f.path}/`);
			}
			for (const f of files) {
				const file = f.file!;
				lines.push(`${f.path}  (${file.type}, ${formatFileSize(file.size)})`);
			}

			if (lines.length === 0) {
				return `No files found under "${path}"${file_pattern ? ` matching "${file_pattern}"` : ""}`;
			}

			return `${lines.length} items found:\n${lines.join("\n")}`;
		}

		// Grep mode (with pattern)
		let regex: RegExp;
		try {
			regex = new RegExp(pattern, case_sensitive ? "g" : "gi");
		} catch {
			// Invalid regex, fall back to literal match
			const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			regex = new RegExp(escaped, case_sensitive ? "g" : "gi");
		}

		const fileNodes = filteredNodes.filter((n) => n.type === "file" && n.file);

		const matches: string[] = [];
		let matchCount = 0;
		let filesWithMatches = 0;
		const skippedContent: string[] = [];

		for (const node of fileNodes) {
			if (matchCount >= max_results) break;

			try {
				const file = node.file!;
				const content = await dfs.getFileContent(node.path);
				let text: string | null = null;
				let pathOnlyFallback = false;

				if (isTextFile(file.type)) {
					text = new TextDecoder().decode(content);
				} else if (file.type === "pdf") {
					if (file.size > MAX_PDF_SEARCH_BYTES) {
						pathOnlyFallback = true;
						skippedContent.push(
							`${node.path} (pdf too large: ${formatFileSize(file.size)})`,
						);
					} else {
						text = await extractPdfText(content);
					}
				} else if (file.type === "excel") {
					if (file.size > MAX_EXCEL_SEARCH_BYTES) {
						pathOnlyFallback = true;
						skippedContent.push(
							`${node.path} (excel too large: ${formatFileSize(file.size)})`,
						);
					} else {
						text = await extractExcelText(content);
					}
				} else {
					pathOnlyFallback = true;
					skippedContent.push(
						`${node.path} (${file.type} content search not supported)`,
					);
				}

				const lines = text ? text.split("\n") : [];
				let fileHasMatch = false;

				if (lines.length > 0) {
					for (let i = 0; i < lines.length; i++) {
						if (matchCount >= max_results) break;
						regex.lastIndex = 0;
						if (regex.test(lines[i])) {
							if (!fileHasMatch) {
								filesWithMatches++;
								fileHasMatch = true;
							}
							matches.push(`${node.path}:${i + 1}:${lines[i]}`);
							matchCount++;
						}
					}
				} else if (pathOnlyFallback) {
					regex.lastIndex = 0;
					if (regex.test(node.path)) {
						if (!fileHasMatch) {
							filesWithMatches++;
							fileHasMatch = true;
						}
						matches.push(`${node.path}:0:${node.path}`);
						matchCount++;
					}
				}
			} catch {
				skippedContent.push(`${node.path} (failed to read content)`);
			}
		}

		if (matches.length === 0) {
			const note =
				skippedContent.length > 0
					? `\n\nNotes:\n- Content search skipped for: ${skippedContent.join(
							", ",
						)}\n- Path-only matching used for skipped files`
					: "";
			return `No matches found for "${pattern}" in searchable content under "${path}"${note}`;
		}

		const notes =
			skippedContent.length > 0
				? `\n\nNotes:\n- Content search skipped for: ${skippedContent.join(
						", ",
					)}\n- Path-only matching used for skipped files`
				: "";

		return `${matches.join("\n")}\n\n${matchCount} matches in ${filesWithMatches} files${notes}`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createDocSearchTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
