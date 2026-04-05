import z from "zod";
import type {
	Tool,
	ToolFactory,
	AllServices,
} from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { normalizeDocumentPath } from "../documents/util";
import { captureWebSessionScreenshot } from "./web-tool-registry";
import {
	createDefaultWebErrorResult,
	createWebResult,
	requireWebBrowserService,
} from "./web-tool-utils";

const TOOL_NAME = "web_screenshot" as const;

const schema = z.object({
	sessionId: z
		.string()
		.optional()
		.describe(
			"Active web session to capture. Use this when a session is already open.",
		),
	url: z
		.string()
		.url()
		.optional()
		.describe(
			"Open this URL first, then capture. Use when no sessionId is available.",
		),
	browserMode: z
		.enum(["iframe", "tab", "window"])
		.optional()
		.describe("Open mode when opening by URL. Default: tab."),
	file_path: z
		.string()
		.optional()
		.describe(
			"Where to save the PNG in /documents. Default: /screenshots/screenshot-<timestamp>.png",
		),
	timeoutMs: z
		.number()
		.int()
		.optional()
		.describe("Navigation timeout in milliseconds when opening by URL."),
});

type Input = z.infer<typeof schema>;
type Services = Pick<AllServices, "webBrowser" | "documentFileSystem">;

const ensureFolderExists = async (
	dfs: NonNullable<AllServices["documentFileSystem"]>,
	folderPath: string,
): Promise<void> => {
	if (folderPath === "/" || !folderPath) return;
	const segments = folderPath.split("/").filter(Boolean);
	let currentPath = "/";
	for (const segment of segments) {
		const nextPath = `${currentPath === "/" ? "" : currentPath}/${segment}`;
		try {
			await dfs.createFolder(segment, currentPath);
		} catch {
			// Folder likely already exists — continue.
		}
		currentPath = nextPath;
	}
};

export const createWebScreenshotTool: ToolFactory<Input, Services> = (
	services,
): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Capture a PNG screenshot of an active web session or a URL and save it to /documents. Returns the saved file path and image dimensions.",
	schema,
	execute: async (input) => {
		const webBrowser = requireWebBrowserService(services);
		const dfs = services.documentFileSystem;
		if (!dfs) {
			return createDefaultWebErrorResult(
				new Error("Document filesystem service is not available."),
			);
		}

		let disposableSessionId: string | undefined;

		try {
			const { session, disposable } = await webBrowser.getOrOpenSession({
				sessionId: input.sessionId,
				url: input.url,
				browserMode: input.browserMode ?? "tab",
				timeoutMs: input.timeoutMs ?? 15_000,
			});

			if (disposable) {
				disposableSessionId = session.id;
			}

			const { dataUrl, width, height } = await captureWebSessionScreenshot(
				session.id,
			);

			// Decode base64 data URL → Uint8Array
			const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
			const binaryStr = atob(base64);
			const bytes = new Uint8Array(binaryStr.length);
			for (let i = 0; i < binaryStr.length; i++) {
				bytes[i] = binaryStr.charCodeAt(i);
			}

			// Resolve output path
			const rawPath =
				input.file_path ?? `/screenshots/screenshot-${Date.now()}.png`;
			const filePath = normalizeDocumentPath(rawPath);
			const lastSlash = filePath.lastIndexOf("/");
			const parentPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : "/";
			const fileName =
				filePath.substring(lastSlash + 1) || `screenshot-${Date.now()}.png`;

			await ensureFolderExists(dfs, parentPath);

			const file = new File([bytes], fileName, { type: "image/png" });
			await dfs.uploadFile(file, parentPath);

			return createWebResult({
				actionType: "web_screenshot",
				success: true,
				sessionId: session.id,
				file_path: filePath,
				width,
				height,
				url: session.currentUrl,
				title: session.title,
			});
		} catch (error) {
			return createDefaultWebErrorResult(error);
		} finally {
			if (disposableSessionId) {
				await webBrowser.closeSession(disposableSessionId);
			}
		}
	},
});

toolRegistry.register(TOOL_NAME, createWebScreenshotTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: Services;
		};
	}
}
