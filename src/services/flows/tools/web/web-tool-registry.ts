interface WebElementRecord {
	index?: number;
	label: string | null;
	text: string;
	value: string | null;
}

type WebBrowserMode = "iframe" | "tab" | "window";

interface WebSessionState {
	id: string;
	requestedUrl: string;
	currentUrl: string;
	title: string;
	html: string;
	text: string;
	domAccessible: boolean;
	lastAccessedAt: number;
	createdAt: number;
	mode: WebBrowserMode;
	iframe?: HTMLIFrameElement;
	tabId?: number;
	windowId?: number;
}

interface OpenSessionArgs {
	url: string;
	timeoutMs: number;
	maxHtmlChars: number;
	persist: boolean;
	mode?: WebBrowserMode;
}

interface OpenSessionResult {
	session: WebSessionState;
	disposable: boolean;
}

interface SearchMatch {
	index: number;
	text: string;
	elementTag: string | null;
	elementIndex: number;
	snippet: string;
}

interface SearchPatternMatch {
	index: number;
}

interface ActiveWebSessionInfo {
	isOpen: boolean;
	sessionId?: string;
	requestedUrl?: string;
	currentUrl?: string;
	title?: string;
	lastAccessedAt?: number;
	createdAt?: number;
	mode?: WebBrowserMode;
}

interface DomElementInfo {
	index: number;
	tagName: string;
	id: string | null;
	name: string | null;
	type: string | null;
	text: string;
	value: string | null;
	href: string | null;
}

const WEB_SESSIONS = new Map<string, WebSessionState>();
const SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_HTML_CHARS = 160_000;
const MAX_SNAP_SHOT_HTML_CHARS = 500_000;
const DEFAULT_POLL_INTERVAL_MS = 250;
type InactivityTimer = ReturnType<typeof window.setTimeout>;
let activeSessionId: string | undefined;
let activeSessionTimeout: InactivityTimer | null | number = null;

const buildIframe = (url: string): HTMLIFrameElement => {
	const iframe = document.createElement("iframe");
	iframe.style.cssText =
		"position:fixed;top:-9999px;left:-9999px;width:1280px;height:800px;opacity:0;pointer-events:none;";
	iframe.src = url;
	return iframe;
};

const normalizeInputUrl = (rawUrl: string): string => {
	try {
		return new URL(rawUrl).toString();
	} catch {
		return rawUrl;
	}
};

const truncate = (value: string, max: number): string => {
	if (value.length <= max) {
		return value;
	}
	return `${value.slice(0, max)}\n...truncated`;
};

const isWideWebMode = (mode?: WebBrowserMode): mode is "tab" | "window" =>
	mode === "tab" || mode === "window";

const ensureBrowserEnvironment = (): void => {
	if (typeof window === "undefined" || typeof document === "undefined") {
		throw new Error("Web tools require DOM APIs from offscreen context.");
	}
};

const waitForFrameLoad = async (
	iframe: HTMLIFrameElement,
	timeoutMs: number,
): Promise<void> => {
	await new Promise<void>((resolve, reject) => {
		const timeout = window.setTimeout(() => {
			reject(
				new Error(`Timeout while waiting page load (timeout=${timeoutMs}ms).`),
			);
		}, timeoutMs);

		const onLoad = (): void => {
			window.clearTimeout(timeout);
			resolve();
		};
		const onError = (): void => {
			window.clearTimeout(timeout);
			reject(new Error("Failed to load web page in iframe."));
		};

		iframe.addEventListener("load", onLoad, { once: true });
		iframe.addEventListener("error", onError, { once: true });
	});
};

const safeDocument = (session: WebSessionState): Document | null => {
	if (session.mode !== "iframe" || !session.iframe) {
		return null;
	}
	try {
		return session.iframe.contentWindow?.document ?? null;
	} catch {
		return null;
	}
};

const safeCurrentUrl = (
	session: WebSessionState,
	requestedUrl: string,
): string => {
	if (session.mode !== "iframe" || !session.iframe) {
		return requestedUrl;
	}
	try {
		return session.iframe.contentWindow?.location?.href ?? requestedUrl;
	} catch {
		return requestedUrl;
	}
};

const safeTitle = (doc: Document | null): string => {
	if (!doc) {
		return "";
	}
	return doc.title || "";
};

const safeText = (doc: Document | null): string => {
	if (!doc) {
		return "";
	}
	return doc.body?.innerText ?? doc.documentElement?.textContent ?? "";
};

const safeHtml = (doc: Document | null): string => {
	if (!doc) {
		return "";
	}
	return doc.documentElement?.outerHTML ?? "";
};

const extractTextFromDocument = (doc: Document): string => {
	return doc.body?.innerText ?? doc.documentElement?.textContent ?? "";
};

const openBrowserTab = async (url: string): Promise<number> => {
	if (
		typeof chrome === "undefined" ||
		typeof chrome.tabs === "undefined" ||
		typeof chrome.tabs.create !== "function"
	) {
		throw new Error("chrome.tabs.create is unavailable in this environment.");
	}

	const tab = await chrome.tabs.create({
		url,
		active: false,
	});
	if (!tab?.id) {
		throw new Error("Failed to open background tab for web session.");
	}
	return tab.id;
};

const openBrowserWindow = async (
	url: string,
): Promise<{ tabId: number; windowId: number }> => {
	if (
		typeof chrome === "undefined" ||
		typeof chrome.windows === "undefined" ||
		typeof chrome.windows.create !== "function"
	) {
		throw new Error(
			"chrome.windows.create is unavailable in this environment.",
		);
	}

	const browserWindow = await chrome.windows.create({
		url,
		focused: false,
		state: "minimized",
		type: "normal",
	});

	if (!browserWindow) {
		throw new Error("Create window error");
	}

	let tabId = browserWindow.tabs?.[0]?.id;
	if (typeof tabId !== "number" && typeof browserWindow.id === "number") {
		const tabs = await chrome.tabs.query({ windowId: browserWindow.id });
		tabId = tabs.find((tab) => typeof tab.id === "number")?.id;
	}

	if (!browserWindow.id || typeof tabId !== "number") {
		throw new Error("Failed to open background window for web session.");
	}
	return { tabId, windowId: browserWindow.id };
};

const closeBrowserTab = (tabId: number): void => {
	if (
		typeof chrome === "undefined" ||
		typeof chrome.tabs === "undefined" ||
		typeof chrome.tabs.remove !== "function"
	) {
		return;
	}
	void Promise.resolve(chrome.tabs.remove(tabId)).catch(() => {});
};

const closeBrowserWindow = (windowId: number): void => {
	if (
		typeof chrome === "undefined" ||
		typeof chrome.windows === "undefined" ||
		typeof chrome.windows.remove !== "function"
	) {
		return;
	}
	void Promise.resolve(chrome.windows.remove(windowId)).catch(() => {});
};

const waitForTabReady = async (
	tabId: number,
	timeoutMs: number,
): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const tab = await chrome.tabs.get(tabId);
		if (
			tab.status === "complete" &&
			tab.url &&
			!tab.url.startsWith("chrome://")
		) {
			return;
		}
		await new Promise((resolve) => window.setTimeout(resolve, 250));
	}
	throw new Error(`Timed out waiting for tab ${tabId} to become ready.`);
};

type TabContentPayload = {
	url: string;
	title: string;
	html: string;
	text: string;
};

const captureTabContent = async (tabId: number): Promise<TabContentPayload> => {
	const response = await chrome.tabs.sendMessage(tabId, {
		type: "web-tool:tab-capture",
	});
	if (!response || typeof response !== "object") {
		throw new Error("Failed to read tab content.");
	}

	const safeResponse = response as Record<string, unknown>;
	if (safeResponse.success === false) {
		throw new Error(
			typeof safeResponse.error === "string"
				? safeResponse.error
				: "Tab capture failed.",
		);
	}

	if (
		typeof safeResponse.url !== "string" ||
		typeof safeResponse.title !== "string" ||
		typeof safeResponse.html !== "string" ||
		typeof safeResponse.text !== "string"
	) {
		throw new Error("Invalid tab capture response.");
	}

	return {
		url: safeResponse.url,
		title: safeResponse.title,
		html: safeResponse.html,
		text: safeResponse.text,
	};
};

const captureSnapshot = (
	session: WebSessionState,
	maxHtmlChars: number,
): WebSessionState => {
	if (session.mode === "tab") {
		return {
			...session,
			lastAccessedAt: Date.now(),
		};
	}

	const document = safeDocument(session);
	const html = safeHtml(document);
	return {
		...session,
		currentUrl: safeCurrentUrl(session, session.requestedUrl),
		title: safeTitle(document),
		html: truncate(html, Math.min(maxHtmlChars, MAX_SNAP_SHOT_HTML_CHARS)),
		text: safeText(document),
		domAccessible: Boolean(document),
		lastAccessedAt: Date.now(),
	};
};

const scheduleInactivityClose = (sessionId: string): void => {
	if (activeSessionTimeout) {
		window.clearTimeout(activeSessionTimeout);
	}
	activeSessionTimeout = window.setTimeout(() => {
		closeWebSession(sessionId);
	}, SESSION_TTL_MS);
};

const disposeSessionArtifacts = (session: WebSessionState): void => {
	if (session.mode === "iframe") {
		session.iframe?.remove();
		return;
	}

	if (typeof session.tabId === "number") {
		closeBrowserTab(session.tabId);
	}

	if (typeof session.windowId === "number") {
		closeBrowserWindow(session.windowId);
	}
};

const closeAllWebSessions = (): void => {
	for (const session of WEB_SESSIONS.values()) {
		disposeSessionArtifacts(session);
	}
	WEB_SESSIONS.clear();
	activeSessionId = undefined;
	if (activeSessionTimeout) {
		window.clearTimeout(activeSessionTimeout);
		activeSessionTimeout = null;
	}
};

const touchSession = (
	sessionId: string,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
): WebSessionState => {
	const session = WEB_SESSIONS.get(sessionId);
	if (!session) {
		throw new Error(`No active web session: ${sessionId}`);
	}
	const refreshed = captureSnapshot(session, maxHtmlChars);
	WEB_SESSIONS.set(sessionId, refreshed);
	scheduleInactivityClose(sessionId);
	return refreshed;
};

export const openWebSession = async ({
	url,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	persist = true,
	mode = "iframe",
}: OpenSessionArgs): Promise<OpenSessionResult> => {
	ensureBrowserEnvironment();
	if (!document.body) {
		throw new Error("Document body is not available for web sessions.");
	}
	closeAllWebSessions();

	const safeUrl = normalizeInputUrl(url);
	const id = crypto.randomUUID();
	const now = Date.now();

	if (isWideWebMode(mode)) {
		let effectiveMode = mode;
		let tabId: number | undefined;
		let windowId: number | undefined;
		if (mode === "window") {
			try {
				const opened = await openBrowserWindow(safeUrl);
				tabId = opened.tabId;
				windowId = opened.windowId;
			} catch {
				effectiveMode = "tab";
			}
		}

		if (typeof tabId !== "number") {
			tabId = await openBrowserTab(safeUrl);
		}

		let fallback: Pick<
			WebSessionState,
			"title" | "html" | "text" | "currentUrl"
		> | null = null;
		try {
			await waitForTabReady(tabId, timeoutMs);
			try {
				const tabSnapshot = await captureTabContent(tabId);
				fallback = {
					currentUrl: tabSnapshot.url,
					title: tabSnapshot.title,
					html: tabSnapshot.html,
					text: tabSnapshot.text,
				};
			} catch {
				const networkFallback = await fetchRenderedFallback({
					url: safeUrl,
					timeoutMs,
					maxHtmlChars,
				});
				fallback = networkFallback;
			}
		} catch {
			fallback = null;
		}

		const session: WebSessionState = {
			id,
			requestedUrl: safeUrl,
			currentUrl: fallback?.currentUrl ?? safeUrl,
			title: fallback?.title ?? "",
			html: fallback?.html ?? "",
			text: fallback?.text ?? "",
			domAccessible: false,
			lastAccessedAt: now,
			createdAt: now,
			mode: effectiveMode,
			tabId,
			windowId,
		};
		const snapshot = captureSnapshot(
			session,
			Math.min(maxHtmlChars, MAX_SNAP_SHOT_HTML_CHARS),
		);
		WEB_SESSIONS.set(id, snapshot);
		activeSessionId = id;
		scheduleInactivityClose(id);
		return { session: snapshot, disposable: !persist };
	}

	const iframe = buildIframe(safeUrl);
	try {
		document.body.appendChild(iframe);
		const loadPromise = waitForFrameLoad(iframe, timeoutMs);
		iframe.src = safeUrl;
		await loadPromise;

		const baseState: WebSessionState = {
			id,
			requestedUrl: safeUrl,
			currentUrl: safeUrl,
			title: "",
			html: "",
			text: "",
			domAccessible: false,
			lastAccessedAt: now,
			createdAt: now,
			mode: "iframe",
			iframe,
		};
		const session = captureSnapshot(baseState, maxHtmlChars);
		WEB_SESSIONS.set(id, session);
		activeSessionId = id;
		scheduleInactivityClose(id);
		return { session, disposable: !persist };
	} catch (error) {
		iframe.remove();
		throw error instanceof Error ? error : new Error(String(error));
	}
};

export const refreshWebSession = (
	sessionId: string,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
): WebSessionState => {
	if (sessionId !== activeSessionId) {
		throw new Error(
			`Invalid web session scope. Only one web session is supported. ${
				activeSessionId
					? `Current sessionId=${activeSessionId}`
					: "No active session"
			}`,
		);
	}
	const session = WEB_SESSIONS.get(sessionId);
	if (!session) {
		throw new Error(`No active web session: ${sessionId}`);
	}
	return touchSession(sessionId, maxHtmlChars);
};

export const getWebSession = (sessionId: string): WebSessionState => {
	return refreshWebSession(sessionId);
};

export const fetchRenderedFallback = async ({
	url,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
}: {
	url: string;
	timeoutMs?: number;
	maxHtmlChars?: number;
}): Promise<
	Pick<WebSessionState, "title" | "html" | "text" | "currentUrl">
> => {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Failed to fetch URL (status=${response.status})`);
		}
		const html = await response.text();
		const document = new DOMParser().parseFromString(html, "text/html");
		return {
			currentUrl: response.url,
			title: document.title || "",
			html: truncate(html, Math.min(maxHtmlChars, MAX_SNAP_SHOT_HTML_CHARS)),
			text: extractTextFromDocument(document),
		};
	} finally {
		window.clearTimeout(timeout);
	}
};

export const getOrOpenWebSession = async ({
	sessionId,
	url,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	browserMode = "iframe",
}: {
	sessionId?: string;
	url?: string;
	timeoutMs?: number;
	maxHtmlChars?: number;
	browserMode?: WebBrowserMode;
}): Promise<{ session: WebSessionState; disposable: boolean }> => {
	if (!sessionId && !url) {
		throw new Error("Either sessionId or url must be provided.");
	}

	if (sessionId) {
		if (sessionId !== activeSessionId) {
			throw new Error(
				`This web feature supports only one active session. Use the current session instead of sessionId=${sessionId}.`,
			);
		}
		return {
			session: getWebSession(sessionId),
			disposable: false,
		};
	}

	const { session, disposable } = await openWebSession({
		url: url!,
		timeoutMs,
		maxHtmlChars,
		persist: false,
		mode: browserMode,
	});
	return { session, disposable };
};

export const closeWebSession = (sessionId: string): void => {
	if (sessionId !== activeSessionId) {
		WEB_SESSIONS.delete(sessionId);
		return;
	}
	const session = WEB_SESSIONS.get(sessionId);
	if (!session) {
		if (activeSessionId === sessionId) {
			activeSessionId = undefined;
			if (activeSessionTimeout) {
				window.clearTimeout(activeSessionTimeout);
				activeSessionTimeout = null;
			}
		}
		return;
	}
	disposeSessionArtifacts(session);
	WEB_SESSIONS.delete(sessionId);
	if (activeSessionId === sessionId) {
		activeSessionId = undefined;
		if (activeSessionTimeout) {
			window.clearTimeout(activeSessionTimeout);
			activeSessionTimeout = null;
		}
	}
};

export const getActiveWebSessionInfo = (): ActiveWebSessionInfo => {
	if (!activeSessionId) {
		return { isOpen: false };
	}

	const activeSession = WEB_SESSIONS.get(activeSessionId);
	if (!activeSession) {
		activeSessionId = undefined;
		return { isOpen: false };
	}

	return {
		isOpen: true,
		sessionId: activeSession.id,
		requestedUrl: activeSession.requestedUrl,
		currentUrl: activeSession.currentUrl,
		title: activeSession.title,
		lastAccessedAt: activeSession.lastAccessedAt,
		createdAt: activeSession.createdAt,
		mode: activeSession.mode,
	};
};

const elementInfo = (element: Element): DomElementInfo => ({
	index: 0,
	tagName: element.tagName.toLowerCase(),
	id: element.getAttribute("id"),
	name: element.getAttribute("name"),
	type: (element.getAttribute("type") ?? null) as string | null,
	text: (element.textContent ?? "").trim(),
	value: (element as HTMLInputElement | HTMLTextAreaElement).value ?? null,
	href:
		element instanceof HTMLAnchorElement ||
		element instanceof HTMLAreaElement ||
		element instanceof HTMLLinkElement
			? element.getAttribute("href")
			: null,
});

export const queryDomElements = (
	session: WebSessionState,
	selector: string,
	maxResults: number,
): DomElementInfo[] => {
	const document = safeDocument(session);
	if (!document) {
		throw new Error("DOM is not accessible for this session.");
	}
	const nodeList = document.querySelectorAll(selector);
	const result: DomElementInfo[] = [];

	nodeList.forEach((node, index) => {
		if (result.length >= maxResults) {
			return;
		}
		if (!(node instanceof Element)) {
			return;
		}
		const info = elementInfo(node);
		result.push({ ...info, index });
	});

	return result;
};

const getIndexedElement = (
	session: WebSessionState,
	selector: string,
	index: number,
): Element => {
	const document = safeDocument(session);
	if (!document) {
		throw new Error("DOM is not accessible for this session.");
	}
	const nodeList = document.querySelectorAll(selector);
	const node = nodeList.item(index);
	if (!node) {
		throw new Error(`No element at index ${index} for selector: ${selector}`);
	}
	if (!(node instanceof Element)) {
		throw new Error("Matched node is not a valid Element.");
	}
	return node;
};

const buildSearchMatcher = (
	pattern: string,
	isRegex: boolean,
	caseSensitive: boolean,
): {
	patternText: string;
	matches(value: string): SearchPatternMatch | null;
} => {
	if (isRegex) {
		let matcher: RegExp;
		try {
			matcher = new RegExp(pattern, caseSensitive ? "" : "i");
		} catch (error) {
			throw new Error(
				error instanceof Error
					? error.message
					: "Invalid regular expression pattern",
			);
		}
		return {
			patternText: pattern,
			matches: (value) => {
				const match = matcher.exec(value);
				if (!match || match.index === undefined) {
					return null;
				}
				return {
					index: match.index,
				};
			},
		};
	}

	const needle = caseSensitive ? pattern : pattern.toLowerCase();
	return {
		patternText: pattern,
		matches: (value) => {
			const haystack = caseSensitive ? value : value.toLowerCase();
			const position = haystack.indexOf(needle);
			if (position < 0) {
				return null;
			}
			return { index: position };
		},
	};
};

export const searchInSessionHtml = async ({
	session,
	pattern,
	selector,
	isRegex = false,
	caseSensitive = false,
	maxMatches = 10,
	maxSnippetChars = 180,
}: {
	session: WebSessionState;
	pattern: string;
	selector?: string;
	isRegex?: boolean;
	caseSensitive?: boolean;
	maxMatches?: number;
	maxSnippetChars?: number;
}): Promise<SearchMatch[]> => {
	const doc =
		safeDocument(session) ??
		new DOMParser().parseFromString(session.html, "text/html");
	const matcher = buildSearchMatcher(pattern, isRegex, caseSensitive);
	const nodes: SearchMatch[] = [];

	const addMatch = (
		text: string,
		sourceTag: string,
		sourceIndex: number,
		match: SearchPatternMatch | null,
	): void => {
		const normalizedText = text.replace(/\s+/g, " ").trim();
		if (!normalizedText) {
			return;
		}
		const pos = match?.index ?? -1;
		if (pos < 0) {
			return;
		}
		const start = Math.max(0, pos - 80);
		const snippet = normalizedText.slice(start, start + maxSnippetChars);
		nodes.push({
			index: nodes.length,
			text: normalizedText,
			elementTag: sourceTag,
			elementIndex: sourceIndex,
			snippet,
		});
	};

	if (selector) {
		const elements = doc.querySelectorAll(selector);
		elements.forEach((element, elementIndex) => {
			if (nodes.length >= maxMatches) {
				return;
			}
			if (!(element instanceof Element)) {
				return;
			}

			const elementText = element.textContent ?? "";
			const match = matcher.matches(elementText);
			if (!match) {
				return;
			}
			addMatch(elementText, element.tagName.toLowerCase(), elementIndex, match);
		});
		return nodes;
	}

	const fullText = doc.documentElement?.textContent ?? "";
	const match = matcher.matches(fullText);
	if (match && fullText) {
		addMatch(fullText, "body", 0, match);
	}
	return nodes;
};

export const waitForDomSelector = async ({
	session,
	selector,
	state = "present",
	timeoutMs = DEFAULT_TIMEOUT_MS,
	intervalMs = DEFAULT_POLL_INTERVAL_MS,
}: {
	session: WebSessionState;
	selector: string;
	state?: "present" | "absent";
	timeoutMs?: number;
	intervalMs?: number;
}): Promise<{ matched: boolean; html: string; lastText: string }> => {
	if (!safeDocument(session)) {
		throw new Error("DOM is not accessible for this session.");
	}

	const start = Date.now();
	const expectPresent = state === "present";
	while (true) {
		refreshWebSession(session.id);
		const document = safeDocument(session);
		const matched = Boolean(document?.querySelector(selector));
		if ((expectPresent && matched) || (!expectPresent && !matched)) {
			return {
				matched: true,
				html: truncate(safeHtml(document), DEFAULT_MAX_HTML_CHARS),
				lastText: safeText(document),
			};
		}
		if (Date.now() - start >= timeoutMs) {
			return {
				matched: false,
				html: truncate(safeHtml(document), DEFAULT_MAX_HTML_CHARS),
				lastText: safeText(document),
			};
		}
		await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
	}
};

export const performDomAction = async (
	session: WebSessionState,
	action:
		| "query"
		| "read"
		| "click"
		| "input"
		| "focus"
		| "scrollBottom"
		| "scrollTop",
	options: {
		selector: string;
		index?: number;
		value?: string;
		maxResults?: number;
	},
): Promise<WebElementRecord | WebElementRecord[]> => {
	const index = options.index ?? 0;
	const maxResults = options.maxResults ?? 20;
	const document = safeDocument(session);
	if (!document) {
		throw new Error("DOM is not accessible for this session.");
	}

	if (action === "query") {
		const records = queryDomElements(session, options.selector, maxResults).map(
			(record) => ({
				index: record.index,
				label: `${record.tagName}#${record.id || "no-id"}[${record.name || "no-name"}]`,
				text: record.text,
				value: record.value,
			}),
		);
		return records;
	}

	const element = getIndexedElement(session, options.selector, index);
	if (action === "focus") {
		(element as HTMLElement).focus();
		return {
			label: element.tagName.toLowerCase(),
			text: element.textContent ?? "",
			value: (element as HTMLInputElement | HTMLTextAreaElement).value ?? null,
		};
	}
	if (action === "scrollBottom") {
		session.iframe?.contentWindow?.scrollTo({
			top: document.body?.scrollHeight ?? 0,
			left: 0,
			behavior: "smooth",
		});
		return {
			label: element.tagName.toLowerCase(),
			text: element.textContent ?? "",
			value: (element as HTMLInputElement | HTMLTextAreaElement).value ?? null,
		};
	}
	if (action === "scrollTop") {
		session.iframe?.contentWindow?.scrollTo({
			top: 0,
			left: 0,
			behavior: "smooth",
		});
		return {
			label: element.tagName.toLowerCase(),
			text: element.textContent ?? "",
			value: (element as HTMLInputElement | HTMLTextAreaElement).value ?? null,
		};
	}
	if (action === "read") {
		return {
			label: element.tagName.toLowerCase(),
			text: element.textContent ?? "",
			value:
				"value" in element && typeof element.value === "string"
					? element.value
					: null,
		};
	}
	if (
		action === "click" &&
		"click" in element &&
		typeof element.click === "function"
	) {
		element.click();
		return {
			label: element.tagName.toLowerCase(),
			text: element.textContent ?? "",
			value: (element as HTMLInputElement | HTMLTextAreaElement).value ?? null,
		};
	}
	if (action === "input") {
		if (
			!(element instanceof HTMLInputElement) &&
			!(element instanceof HTMLTextAreaElement)
		) {
			throw new Error("Target element does not support value input.");
		}
		const inputValue = options.value ?? "";
		element.focus();
		element.value = inputValue;
		element.dispatchEvent(new Event("input", { bubbles: true }));
		element.dispatchEvent(new Event("change", { bubbles: true }));
		return {
			label: element.tagName.toLowerCase(),
			text: element.value,
			value: inputValue,
		};
	}

	throw new Error(`Unsupported dom action: ${action}`);
};

export const createDefaultWebErrorResult = (error: unknown): string => {
	return JSON.stringify(
		{
			actionType: "web_tool_error",
			success: false,
			error: error instanceof Error ? error.message : String(error),
		},
		null,
		2,
	);
};

export const createWebResult = (payload: Record<string, unknown>): string =>
	JSON.stringify(payload, null, 2);
