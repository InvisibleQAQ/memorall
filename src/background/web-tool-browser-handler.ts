import { logError } from "@/utils/logger";
import {
	WEB_BROWSER_COMMAND_SOURCE,
	WEB_BROWSER_SURFACE_STORAGE_KEY,
	WEB_CONTENT_COMMAND_SOURCE,
	isWebBrowserCommandRequest,
	isWebContentCommandResponse,
	type WebBrowserCommandRequest,
	type WebBrowserCommandResponse,
	type WebBrowserSurface,
	type WebContentCommandRequest,
	type WebContentCommandResponse,
} from "@/services/flows/tools/web/web-browser-protocol";

interface StoredWebBrowserSurface extends WebBrowserSurface {
	sessionId: string;
}

type SuccessfulWebContentCommandResponse = Extract<
	WebContentCommandResponse,
	{ success: true }
>;

let cachedSurface: StoredWebBrowserSurface | null = null;

const RETRY_INTERVAL_MS = 250;
const FULL_WEB_SNAPSHOT_MAX_HTML_CHARS = Number.MAX_SAFE_INTEGER;

const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

const isTransientLoadingUrl = (url?: string | null): boolean =>
	!url || url === "about:blank" || url.startsWith("about:blank#");

const isRestrictedUrl = (url?: string | null): boolean =>
	typeof url === "string" &&
	(url.startsWith("chrome://") ||
		url.startsWith("chrome-extension://") ||
		url.startsWith("edge://") ||
		(url.startsWith("about:") && !isTransientLoadingUrl(url)));

const getSessionStorage = () => chrome.storage?.session;

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const createErrorResponse = (
	request: WebBrowserCommandRequest,
	error: unknown,
): WebBrowserCommandResponse => ({
	source: WEB_BROWSER_COMMAND_SOURCE,
	command: request.command,
	success: false,
	sessionId: request.sessionId,
	error: toErrorMessage(error),
});

const parseStoredSurface = (value: unknown): StoredWebBrowserSurface | null => {
	if (!value || typeof value !== "object") {
		return null;
	}

	const candidate = value as Record<string, unknown>;
	if (
		typeof candidate.sessionId !== "string" ||
		typeof candidate.tabId !== "number" ||
		(candidate.mode !== "tab" && candidate.mode !== "window")
	) {
		return null;
	}

	return {
		sessionId: candidate.sessionId,
		tabId: candidate.tabId,
		mode: candidate.mode,
		windowId:
			typeof candidate.windowId === "number" ? candidate.windowId : undefined,
	};
};

const loadStoredSurface = async (): Promise<StoredWebBrowserSurface | null> => {
	if (cachedSurface) {
		return cachedSurface;
	}

	const storage = getSessionStorage();
	if (!storage) {
		return null;
	}

	const value = await storage.get(WEB_BROWSER_SURFACE_STORAGE_KEY);
	const parsed = parseStoredSurface(value[WEB_BROWSER_SURFACE_STORAGE_KEY]);
	cachedSurface = parsed;
	return parsed;
};

const saveStoredSurface = async (
	surface: StoredWebBrowserSurface | null,
): Promise<void> => {
	cachedSurface = surface;
	const storage = getSessionStorage();
	if (!storage) {
		return;
	}

	if (surface) {
		await storage.set({ [WEB_BROWSER_SURFACE_STORAGE_KEY]: surface });
		return;
	}

	await storage.remove(WEB_BROWSER_SURFACE_STORAGE_KEY);
};

const closeSurfaceArtifacts = async ({
	tabId,
	windowId,
}: {
	tabId?: number;
	windowId?: number;
}): Promise<void> => {
	if (typeof windowId === "number") {
		await chrome.windows.remove(windowId).catch(() => {});
		return;
	}

	if (typeof tabId === "number") {
		await chrome.tabs.remove(tabId).catch(() => {});
	}
};

const clearStoredSurface = async (): Promise<void> => {
	const storedSurface = await loadStoredSurface();
	if (!storedSurface) {
		return;
	}

	await closeSurfaceArtifacts(storedSurface);
	await saveStoredSurface(null);
};

const openBrowserTab = async (url: string): Promise<WebBrowserSurface> => {
	const tab = await chrome.tabs.create({
		url,
		active: false,
	});
	if (typeof tab.id !== "number") {
		throw new Error("Failed to open browser tab for web session.");
	}

	return {
		mode: "tab",
		tabId: tab.id,
	};
};

const openBrowserWindow = async (url: string): Promise<WebBrowserSurface> => {
	const previousFocusedWindowId = await chrome.windows
		.getLastFocused()
		.then((window) => window?.id)
		.catch(() => undefined);

	const browserWindow = await chrome.windows.create({
		url,
		focused: false,
		state: "normal",
		type: "normal",
	});

	const windowId = browserWindow?.id;
	if (typeof windowId !== "number") {
		throw new Error("Failed to open browser window for web session.");
	}

	let tabId = browserWindow?.tabs?.[0]?.id;
	if (typeof tabId !== "number") {
		const tabs = await chrome.tabs.query({ windowId });
		tabId = tabs.find((tab) => typeof tab.id === "number")?.id;
	}

	if (typeof tabId !== "number") {
		throw new Error("Failed to resolve browser tab for web window session.");
	}

	if (
		typeof previousFocusedWindowId === "number" &&
		previousFocusedWindowId !== windowId
	) {
		await chrome.windows
			.update(previousFocusedWindowId, { focused: true })
			.catch(() => {});
	}

	return {
		mode: "window",
		tabId,
		windowId,
	};
};

const getTabOrThrow = async (tabId: number): Promise<chrome.tabs.Tab> => {
	try {
		return await chrome.tabs.get(tabId);
	} catch {
		throw new Error("The browser web session tab was closed.");
	}
};

const waitForTabReady = async (
	tabId: number,
	timeoutMs: number,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const tab = await getTabOrThrow(tabId);
		if (isRestrictedUrl(tab.url)) {
			throw new Error(
				`Unsupported page for browser-backed web tools: ${tab.url ?? "unknown URL"}`,
			);
		}
		if (tab.status === "complete" && !isTransientLoadingUrl(tab.url)) {
			return;
		}
		await delay(RETRY_INTERVAL_MS);
	}

	throw new Error(`Timed out waiting for browser tab ${tabId} to load.`);
};

const normalizeContentCommandError = (
	error: unknown,
	pageUrl?: string,
): string => {
	const message = toErrorMessage(error);
	if (
		message.includes("Receiving end does not exist") ||
		message.includes("Could not establish connection") ||
		message.includes("The message port closed before")
	) {
		return pageUrl
			? `Content script unavailable for ${pageUrl}. The page may be restricted or not ready yet.`
			: "Content script unavailable for this page. The page may be restricted or not ready yet.";
	}
	return message;
};

const sendContentCommand = async (
	tabId: number,
	request: WebContentCommandRequest,
	timeoutMs: number,
): Promise<SuccessfulWebContentCommandResponse> => {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;

	while (Date.now() < deadline) {
		const tab = await getTabOrThrow(tabId);
		if (isRestrictedUrl(tab.url)) {
			throw new Error(
				`Unsupported page for browser-backed web tools: ${tab.url ?? "unknown URL"}`,
			);
		}
		if (tab.status !== "complete" || isTransientLoadingUrl(tab.url)) {
			await delay(RETRY_INTERVAL_MS);
			continue;
		}

		try {
			const rawResponse = await chrome.tabs.sendMessage(tabId, request);
			if (!isWebContentCommandResponse(rawResponse)) {
				throw new Error("Invalid content-script response.");
			}
			if (!rawResponse.success) {
				throw new Error(rawResponse.error);
			}
			return rawResponse;
		} catch (error) {
			lastError = error;
			const message = toErrorMessage(error);
			if (
				!message.includes("Receiving end does not exist") &&
				!message.includes("Could not establish connection") &&
				!message.includes("The message port closed before")
			) {
				throw new Error(normalizeContentCommandError(error, tab.url));
			}

			await delay(RETRY_INTERVAL_MS);
		}
	}

	const finalTab = await chrome.tabs.get(tabId).catch(() => null);
	throw new Error(normalizeContentCommandError(lastError, finalTab?.url));
};

const requestSnapshot = async (
	tabId: number,
	timeoutMs: number,
): Promise<SuccessfulWebContentCommandResponse> =>
	sendContentCommand(
		tabId,
		{
			source: WEB_CONTENT_COMMAND_SOURCE,
			type: "web-tool:snapshot",
			maxHtmlChars: FULL_WEB_SNAPSHOT_MAX_HTML_CHARS,
		},
		timeoutMs,
	);

const openSurfaceForMode = async (
	mode: "tab" | "window",
	url: string,
): Promise<WebBrowserSurface> => {
	if (mode === "window") {
		try {
			return await openBrowserWindow(url);
		} catch {
			return openBrowserTab(url);
		}
	}

	return openBrowserTab(url);
};

const handleOpenCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "open" }>,
): Promise<WebBrowserCommandResponse> => {
	await clearStoredSurface();

	let surface: WebBrowserSurface | null = null;
	try {
		surface = await openSurfaceForMode(request.mode, request.url);
		await waitForTabReady(surface.tabId, request.timeoutMs);

		const snapshotResponse = await requestSnapshot(
			surface.tabId,
			request.timeoutMs,
		);
		if (snapshotResponse.type !== "web-tool:snapshot-result") {
			throw new Error("Invalid browser snapshot response.");
		}

		await saveStoredSurface({
			sessionId: request.sessionId,
			tabId: surface.tabId,
			windowId: surface.windowId,
			mode: surface.mode,
		});

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "open",
			success: true,
			sessionId: request.sessionId,
			surface,
			snapshot: snapshotResponse.snapshot,
		};
	} catch (error) {
		if (surface) {
			await closeSurfaceArtifacts(surface);
		}
		await saveStoredSurface(null);
		return createErrorResponse(request, error);
	}
};

const handleSnapshotCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "snapshot" }>,
): Promise<WebBrowserCommandResponse> => {
	try {
		const response = await requestSnapshot(request.tabId, request.timeoutMs);
		if (response.type !== "web-tool:snapshot-result") {
			throw new Error("Invalid browser snapshot response.");
		}

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "snapshot",
			success: true,
			sessionId: request.sessionId,
			snapshot: response.snapshot,
		};
	} catch (error) {
		return createErrorResponse(request, error);
	}
};

const handleDomQueryCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "dom-query" }>,
): Promise<WebBrowserCommandResponse> => {
	try {
		const response = await sendContentCommand(
			request.tabId,
			{
				source: WEB_CONTENT_COMMAND_SOURCE,
				type: "web-tool:dom-query",
				selector: request.selector,
				maxResults: request.maxResults,
				maxHtmlChars: FULL_WEB_SNAPSHOT_MAX_HTML_CHARS,
			},
			request.timeoutMs,
		);

		if (response.type !== "web-tool:dom-query-result") {
			throw new Error("Invalid browser DOM query response.");
		}

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "dom-query",
			success: true,
			sessionId: request.sessionId,
			snapshot: response.snapshot,
			elements: response.elements,
		};
	} catch (error) {
		return createErrorResponse(request, error);
	}
};

const handleDomActionCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "dom-action" }>,
): Promise<WebBrowserCommandResponse> => {
	try {
		const response = await sendContentCommand(
			request.tabId,
			{
				source: WEB_CONTENT_COMMAND_SOURCE,
				type: "web-tool:dom-action",
				action: request.action,
				selector: request.selector,
				index: request.index,
				value: request.value,
				maxHtmlChars: FULL_WEB_SNAPSHOT_MAX_HTML_CHARS,
			},
			request.timeoutMs,
		);

		if (response.type !== "web-tool:dom-action-result") {
			throw new Error("Invalid browser DOM action response.");
		}

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "dom-action",
			success: true,
			sessionId: request.sessionId,
			snapshot: response.snapshot,
			result: response.result,
		};
	} catch (error) {
		return createErrorResponse(request, error);
	}
};

const handleWaitSelectorCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "wait-selector" }>,
): Promise<WebBrowserCommandResponse> => {
	try {
		const response = await sendContentCommand(
			request.tabId,
			{
				source: WEB_CONTENT_COMMAND_SOURCE,
				type: "web-tool:wait-selector",
				selector: request.selector,
				state: request.state,
				timeoutMs: request.timeoutMs,
				intervalMs: request.intervalMs,
				maxHtmlChars: FULL_WEB_SNAPSHOT_MAX_HTML_CHARS,
			},
			request.timeoutMs,
		);

		if (response.type !== "web-tool:wait-selector-result") {
			throw new Error("Invalid browser wait response.");
		}

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "wait-selector",
			success: true,
			sessionId: request.sessionId,
			snapshot: response.snapshot,
			matched: response.matched,
		};
	} catch (error) {
		return createErrorResponse(request, error);
	}
};

const handleCloseCommand = async (
	request: Extract<WebBrowserCommandRequest, { command: "close" }>,
): Promise<WebBrowserCommandResponse> => {
	try {
		const storedSurface = await loadStoredSurface();
		const target =
			storedSurface &&
			(storedSurface.sessionId === request.sessionId ||
				storedSurface.tabId === request.tabId ||
				storedSurface.windowId === request.windowId)
				? storedSurface
				: {
						tabId: request.tabId,
						windowId: request.windowId,
					};

		await closeSurfaceArtifacts(target);
		if (storedSurface && target === storedSurface) {
			await saveStoredSurface(null);
		}

		return {
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "close",
			success: true,
			sessionId: request.sessionId,
		};
	} catch (error) {
		return createErrorResponse(request, error);
	}
};

const handleCommand = async (
	request: WebBrowserCommandRequest,
): Promise<WebBrowserCommandResponse> => {
	switch (request.command) {
		case "open":
			return handleOpenCommand(request);
		case "snapshot":
			return handleSnapshotCommand(request);
		case "dom-query":
			return handleDomQueryCommand(request);
		case "dom-action":
			return handleDomActionCommand(request);
		case "wait-selector":
			return handleWaitSelectorCommand(request);
		case "close":
			return handleCloseCommand(request);
	}
};

export function registerWebToolBrowserHandler(): void {
	chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
		if (!isWebBrowserCommandRequest(rawMessage)) {
			return false;
		}

		void handleCommand(rawMessage)
			.then(sendResponse)
			.catch((error) => {
				logError("[WEB_TOOL_BROWSER_HANDLER] Failed:", error);
				sendResponse(createErrorResponse(rawMessage, error));
			});
		return true;
	});
}
