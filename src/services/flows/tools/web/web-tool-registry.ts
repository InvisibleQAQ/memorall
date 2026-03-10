import {
	WEB_BROWSER_COMMAND_SOURCE,
	isWebBrowserCommandResponse,
	type WebBrowserCommandRequest,
	type WebBrowserCommandResponse,
	type WebBrowserMode,
	type WebDomActionName,
	type WebDomElementInfo,
	type WebElementRecord,
	type WebSnapshotPayload,
	type WebWaitSelectorState,
} from "./web-browser-protocol";

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
	renderReady: boolean;
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

type SuccessfulWebBrowserCommandResponse = Extract<
	WebBrowserCommandResponse,
	{ success: true }
>;

const WEB_SESSIONS = new Map<string, WebSessionState>();
const SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_HTML_CHARS = 160_000;
const DEFAULT_POLL_INTERVAL_MS = 250;
let activeSessionId: string | undefined;
let activeSessionTimeout: number | null = null;

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

const normalizeReadableText = (value: string): string =>
	value.replace(/\s+/g, " ").trim();

const extractReadableHtmlText = (html: string): string =>
	html
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
		.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const hasReadableSessionContent = ({
	html,
	text,
}: Pick<WebSessionState, "html" | "text">): boolean =>
	Boolean(normalizeReadableText(text) || extractReadableHtmlText(html));

const isWideWebMode = (
	mode?: WebBrowserMode,
): mode is Exclude<WebBrowserMode, "iframe"> =>
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

const extractTextFromDocument = (doc: Document): string =>
	doc.body?.innerText ?? doc.documentElement?.textContent ?? "";

const scheduleInactivityClose = (sessionId: string): void => {
	if (activeSessionTimeout) {
		window.clearTimeout(activeSessionTimeout);
	}
	activeSessionTimeout = window.setTimeout(() => {
		void closeWebSession(sessionId);
	}, SESSION_TTL_MS);
};

const applySnapshotToSession = (
	session: WebSessionState,
	snapshot: WebSnapshotPayload,
): WebSessionState => {
	session.currentUrl = snapshot.url;
	session.title = snapshot.title;
	session.html = snapshot.html;
	session.text = snapshot.text;
	session.domAccessible = snapshot.domAccessible;
	session.lastAccessedAt = Date.now();
	return session;
};

const captureIframeSnapshot = (session: WebSessionState): WebSessionState => {
	const document = safeDocument(session);
	const html = safeHtml(document);
	session.currentUrl = safeCurrentUrl(session, session.requestedUrl);
	session.title = safeTitle(document);
	session.html = html;
	session.text = safeText(document);
	session.domAccessible = Boolean(document);
	session.lastAccessedAt = Date.now();
	return session;
};

const sendWebBrowserCommand = async (
	request: WebBrowserCommandRequest,
): Promise<SuccessfulWebBrowserCommandResponse> => {
	const rawResponse = await chrome.runtime.sendMessage(request);
	if (!isWebBrowserCommandResponse(rawResponse)) {
		throw new Error("Invalid response from browser web handler.");
	}
	if (!rawResponse.success) {
		throw new Error(rawResponse.error);
	}
	return rawResponse;
};

const captureBrowserSnapshot = async (
	session: WebSessionState,
	maxHtmlChars: number,
	timeoutMs: number,
): Promise<WebSessionState> => {
	if (typeof session.tabId !== "number") {
		throw new Error("Browser-backed web session is missing tabId.");
	}

	const response = await sendWebBrowserCommand({
		source: WEB_BROWSER_COMMAND_SOURCE,
		command: "snapshot",
		sessionId: session.id,
		tabId: session.tabId,
		timeoutMs,
		maxHtmlChars,
	});
	if (response.command !== "snapshot") {
		throw new Error("Invalid browser snapshot response.");
	}

	return applySnapshotToSession(session, response.snapshot);
};

const disposeSessionArtifacts = async (
	session: WebSessionState,
): Promise<void> => {
	if (session.mode === "iframe") {
		session.iframe?.remove();
		return;
	}

	if (
		typeof session.tabId !== "number" &&
		typeof session.windowId !== "number"
	) {
		return;
	}

	await sendWebBrowserCommand({
		source: WEB_BROWSER_COMMAND_SOURCE,
		command: "close",
		sessionId: session.id,
		tabId: session.tabId,
		windowId: session.windowId,
	}).catch(() => {});
};

const closeAllWebSessions = async (): Promise<void> => {
	for (const sessionId of Array.from(WEB_SESSIONS.keys())) {
		await closeWebSession(sessionId);
	}
};

export const disposeActiveWebSession = async (
	_reason?: string,
): Promise<void> => {
	if (activeSessionTimeout) {
		window.clearTimeout(activeSessionTimeout);
		activeSessionTimeout = null;
	}

	await closeAllWebSessions();
	activeSessionId = undefined;
};

const touchSession = async (
	sessionId: string,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WebSessionState> => {
	const session = WEB_SESSIONS.get(sessionId);
	if (!session) {
		throw new Error(`No active web session: ${sessionId}`);
	}

	if (session.mode === "iframe") {
		captureIframeSnapshot(session);
	} else {
		await captureBrowserSnapshot(session, maxHtmlChars, timeoutMs);
	}

	scheduleInactivityClose(sessionId);
	return session;
};

export const openWebSession = async ({
	url,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	persist = true,
	mode = "iframe",
}: OpenSessionArgs): Promise<OpenSessionResult> => {
	ensureBrowserEnvironment();
	if (!document.body && mode === "iframe") {
		throw new Error("Document body is not available for web sessions.");
	}

	await closeAllWebSessions();

	const safeUrl = normalizeInputUrl(url);
	const id = crypto.randomUUID();
	const now = Date.now();

	if (isWideWebMode(mode)) {
		const response = await sendWebBrowserCommand({
			source: WEB_BROWSER_COMMAND_SOURCE,
			command: "open",
			sessionId: id,
			url: safeUrl,
			mode,
			timeoutMs,
			maxHtmlChars,
		});
		if (response.command !== "open") {
			throw new Error("Invalid browser open response.");
		}

		const session: WebSessionState = {
			id,
			requestedUrl: safeUrl,
			currentUrl: safeUrl,
			title: "",
			html: "",
			text: "",
			domAccessible: false,
			lastAccessedAt: now,
			createdAt: now,
			mode: response.surface.mode,
			tabId: response.surface.tabId,
			windowId: response.surface.windowId,
		};
		applySnapshotToSession(session, response.snapshot);
		WEB_SESSIONS.set(id, session);
		activeSessionId = id;
		const renderState = await waitForPageRender({
			session,
			timeoutMs,
			maxHtmlChars,
		});
		scheduleInactivityClose(id);
		return {
			session,
			disposable: !persist,
			renderReady: renderState.matched,
		};
	}

	const iframe = buildIframe(safeUrl);
	try {
		document.body.appendChild(iframe);
		const loadPromise = waitForFrameLoad(iframe, timeoutMs);
		iframe.src = safeUrl;
		await loadPromise;

		const session: WebSessionState = {
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
		captureIframeSnapshot(session);
		WEB_SESSIONS.set(id, session);
		activeSessionId = id;
		const renderState = await waitForPageRender({
			session,
			timeoutMs,
			maxHtmlChars,
		});
		scheduleInactivityClose(id);
		return {
			session,
			disposable: !persist,
			renderReady: renderState.matched,
		};
	} catch (error) {
		iframe.remove();
		throw error instanceof Error ? error : new Error(String(error));
	}
};

export const refreshWebSession = async (
	sessionId: string,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WebSessionState> => {
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

	return touchSession(sessionId, maxHtmlChars, timeoutMs);
};

export const getWebSession = async (
	sessionId: string,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WebSessionState> =>
	refreshWebSession(sessionId, maxHtmlChars, timeoutMs);

export const fetchRenderedFallback = async ({
	url,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	maxHtmlChars: _maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
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
			html,
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
			session: await getWebSession(sessionId, maxHtmlChars, timeoutMs),
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

export const closeWebSession = async (sessionId: string): Promise<void> => {
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

	await disposeSessionArtifacts(session);
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

const elementInfo = (element: Element, index: number): WebDomElementInfo => ({
	index,
	tagName: element.tagName.toLowerCase(),
	id: element.getAttribute("id"),
	name: element.getAttribute("name"),
	type: element.getAttribute("type"),
	text: (element.textContent ?? "").trim(),
	value:
		element instanceof HTMLInputElement ||
		element instanceof HTMLTextAreaElement ||
		element instanceof HTMLSelectElement
			? element.value
			: null,
	href:
		element instanceof HTMLAnchorElement ||
		element instanceof HTMLAreaElement ||
		element instanceof HTMLLinkElement
			? element.getAttribute("href")
			: null,
});

export const queryDomElements = async (
	session: WebSessionState,
	selector: string,
	maxResults: number,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WebDomElementInfo[]> => {
	if (session.mode === "iframe") {
		const document = safeDocument(session);
		if (!document) {
			throw new Error("DOM is not accessible for this session.");
		}

		const result: WebDomElementInfo[] = [];
		document.querySelectorAll(selector).forEach((node, index) => {
			if (result.length >= maxResults || !(node instanceof Element)) {
				return;
			}
			result.push(elementInfo(node, index));
		});
		return result;
	}

	if (typeof session.tabId !== "number") {
		throw new Error("Browser-backed web session is missing tabId.");
	}

	const response = await sendWebBrowserCommand({
		source: WEB_BROWSER_COMMAND_SOURCE,
		command: "dom-query",
		sessionId: session.id,
		tabId: session.tabId,
		timeoutMs,
		maxHtmlChars,
		selector,
		maxResults,
	});
	if (response.command !== "dom-query") {
		throw new Error("Invalid browser DOM query response.");
	}

	applySnapshotToSession(session, response.snapshot);
	return response.elements;
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
			if (nodes.length >= maxMatches || !(element instanceof Element)) {
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
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
}: {
	session: WebSessionState;
	selector: string;
	state?: WebWaitSelectorState;
	timeoutMs?: number;
	intervalMs?: number;
	maxHtmlChars?: number;
}): Promise<{ matched: boolean; html: string; lastText: string }> => {
	if (session.mode === "iframe") {
		if (!safeDocument(session)) {
			throw new Error("DOM is not accessible for this session.");
		}

		const start = Date.now();
		const expectPresent = state === "present";
		while (true) {
			await refreshWebSession(session.id, maxHtmlChars, timeoutMs);
			const document = safeDocument(session);
			const matched = Boolean(document?.querySelector(selector));
			if ((expectPresent && matched) || (!expectPresent && !matched)) {
				return {
					matched: true,
					html: safeHtml(document),
					lastText: safeText(document),
				};
			}
			if (Date.now() - start >= timeoutMs) {
				return {
					matched: false,
					html: safeHtml(document),
					lastText: safeText(document),
				};
			}
			await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
		}
	}

	if (typeof session.tabId !== "number") {
		throw new Error("Browser-backed web session is missing tabId.");
	}

	const response = await sendWebBrowserCommand({
		source: WEB_BROWSER_COMMAND_SOURCE,
		command: "wait-selector",
		sessionId: session.id,
		tabId: session.tabId,
		timeoutMs,
		intervalMs,
		maxHtmlChars,
		selector,
		state,
	});
	if (response.command !== "wait-selector") {
		throw new Error("Invalid browser wait response.");
	}

	applySnapshotToSession(session, response.snapshot);
	return {
		matched: response.matched,
		html: session.html,
		lastText: session.text,
	};
};

export const waitForPageRender = async ({
	session,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	intervalMs = DEFAULT_POLL_INTERVAL_MS,
	stabilityMs = 1_000,
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
}: {
	session: WebSessionState;
	timeoutMs?: number;
	intervalMs?: number;
	stabilityMs?: number;
	maxHtmlChars?: number;
}): Promise<{ matched: boolean; html: string; lastText: string }> => {
	if (session.mode === "iframe" && !safeDocument(session)) {
		throw new Error("Current iframe session cannot observe page render state.");
	}

	const startedAt = Date.now();
	let stableSince: number | null = null;
	let previousSnapshot:
		| {
				currentUrl: string;
				title: string;
				html: string;
				text: string;
		  }
		| undefined;

	while (true) {
		await refreshWebSession(session.id, maxHtmlChars, timeoutMs);

		const currentSnapshot = {
			currentUrl: session.currentUrl,
			title: session.title,
			html: session.html,
			text: session.text,
		};

		const isStable =
			previousSnapshot?.currentUrl === currentSnapshot.currentUrl &&
			previousSnapshot?.title === currentSnapshot.title &&
			previousSnapshot?.html === currentSnapshot.html &&
			previousSnapshot?.text === currentSnapshot.text;
		const hasReadableContent = hasReadableSessionContent(currentSnapshot);

		const now = Date.now();
		if (isStable && hasReadableContent) {
			stableSince ??= now;
			if (now - stableSince >= stabilityMs) {
				return {
					matched: true,
					html: session.html,
					lastText: session.text,
				};
			}
		} else {
			previousSnapshot = currentSnapshot;
			stableSince = null;
		}

		if (now - startedAt >= timeoutMs) {
			return {
				matched: false,
				html: session.html,
				lastText: session.text,
			};
		}

		await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
	}
};

export const performDomAction = async (
	session: WebSessionState,
	action: WebDomActionName,
	options: {
		selector: string;
		index?: number;
		value?: string;
	},
	maxHtmlChars = DEFAULT_MAX_HTML_CHARS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WebElementRecord> => {
	const index = options.index ?? 0;

	if (session.mode === "iframe") {
		const document = safeDocument(session);
		if (!document) {
			throw new Error("DOM is not accessible for this session.");
		}

		const element = getIndexedElement(session, options.selector, index);
		if (action === "focus") {
			(element as HTMLElement).focus();
			return {
				label: element.tagName.toLowerCase(),
				text: element.textContent ?? "",
				value:
					(
						element as
							| HTMLInputElement
							| HTMLTextAreaElement
							| HTMLSelectElement
					).value ?? null,
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
				value:
					(
						element as
							| HTMLInputElement
							| HTMLTextAreaElement
							| HTMLSelectElement
					).value ?? null,
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
				value:
					(
						element as
							| HTMLInputElement
							| HTMLTextAreaElement
							| HTMLSelectElement
					).value ?? null,
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
				value:
					(
						element as
							| HTMLInputElement
							| HTMLTextAreaElement
							| HTMLSelectElement
					).value ?? null,
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
	}

	if (typeof session.tabId !== "number") {
		throw new Error("Browser-backed web session is missing tabId.");
	}

	const response = await sendWebBrowserCommand({
		source: WEB_BROWSER_COMMAND_SOURCE,
		command: "dom-action",
		sessionId: session.id,
		tabId: session.tabId,
		timeoutMs,
		maxHtmlChars,
		action,
		selector: options.selector,
		index,
		value: options.value,
	});
	if (response.command !== "dom-action") {
		throw new Error("Invalid browser DOM action response.");
	}

	applySnapshotToSession(session, response.snapshot);
	return response.result;
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
