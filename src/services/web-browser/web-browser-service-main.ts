import { logInfo } from "@/utils/logger";
import type { IWebBrowserService } from "./interfaces/web-browser-service.interface";
import type {
	ActiveWebSessionInfo,
	WebFetchRenderedFallbackArgs,
	WebFetchRenderedFallbackResult,
	WebGetOrOpenSessionArgs,
	WebGetOrOpenSessionResult,
	WebOpenSessionArgs,
	WebOpenSessionResult,
	WebPerformDomActionArgs,
	WebQueryDomElementsArgs,
	WebRefreshSessionArgs,
	WebSearchInSessionArgs,
	WebSearchMatch,
	WebSession,
	WebWaitForRenderArgs,
	WebWaitForSelectorArgs,
	WebWaitResult,
} from "./types";
import type {
	WebDomElementInfo,
	WebElementRecord,
} from "./web-browser-protocol";
import {
	closeWebSession,
	disposeActiveWebSession,
	fetchRenderedFallback,
	getActiveWebSessionInfo,
	getOrOpenWebSession,
	getWebSession,
	openWebSession,
	performDomAction,
	queryDomElements,
	refreshWebSession,
	searchInSessionHtml,
	waitForDomSelector,
	waitForPageRender,
} from "@/services/flows/tools/web/web-tool-registry";

export class WebBrowserServiceMain implements IWebBrowserService {
	private static instance: WebBrowserServiceMain;

	private initialized = false;
	private initializedAt: number | null = null;

	static getInstance(): WebBrowserServiceMain {
		if (!WebBrowserServiceMain.instance) {
			WebBrowserServiceMain.instance = new WebBrowserServiceMain();
		}
		return WebBrowserServiceMain.instance;
	}

	isReady(): boolean {
		return this.initialized;
	}

	getInitializedAt(): number | null {
		return this.initializedAt;
	}

	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		this.initialized = true;
		this.initializedAt = Date.now();
		logInfo("✅ WebBrowserServiceMain initialized");
	}

	async dispose(): Promise<void> {
		await disposeActiveWebSession("service_dispose");
		this.initialized = false;
		this.initializedAt = null;
	}

	async openSession(args: WebOpenSessionArgs): Promise<WebOpenSessionResult> {
		await this.initialize();
		return openWebSession({
			url: args.url,
			timeoutMs: args.timeoutMs ?? 15_000,
			maxHtmlChars: args.maxHtmlChars ?? 160_000,
			persist: args.persist ?? true,
			mode: args.mode,
		});
	}

	async refreshSession(args: WebRefreshSessionArgs): Promise<WebSession> {
		await this.initialize();
		return refreshWebSession(
			args.sessionId,
			args.maxHtmlChars,
			args.timeoutMs,
		) as Promise<WebSession>;
	}

	async getOrOpenSession(
		args: WebGetOrOpenSessionArgs,
	): Promise<WebGetOrOpenSessionResult> {
		await this.initialize();
		return getOrOpenWebSession(args);
	}

	async closeSession(sessionId: string): Promise<void> {
		await this.initialize();
		await closeWebSession(sessionId);
	}

	async disposeActiveSession(reason?: string): Promise<void> {
		await this.initialize();
		await disposeActiveWebSession(reason);
	}

	async getActiveSessionInfo(): Promise<ActiveWebSessionInfo> {
		await this.initialize();
		return getActiveWebSessionInfo();
	}

	async fetchRenderedFallback(
		args: WebFetchRenderedFallbackArgs,
	): Promise<WebFetchRenderedFallbackResult> {
		await this.initialize();
		return fetchRenderedFallback(args);
	}

	async queryDomElements(
		args: WebQueryDomElementsArgs,
	): Promise<WebDomElementInfo[]> {
		await this.initialize();
		const session = await getWebSession(
			args.sessionId,
			args.maxHtmlChars,
			args.timeoutMs,
		);
		return queryDomElements(
			session,
			args.selector,
			args.maxResults,
			args.maxHtmlChars,
			args.timeoutMs,
		);
	}

	async searchInSessionHtml(
		args: WebSearchInSessionArgs,
	): Promise<WebSearchMatch[]> {
		await this.initialize();
		const session = await getWebSession(args.sessionId);
		return searchInSessionHtml({
			session,
			pattern: args.pattern,
			selector: args.selector,
			isRegex: args.isRegex,
			caseSensitive: args.caseSensitive,
			maxMatches: args.maxMatches,
			maxSnippetChars: args.maxSnippetChars,
		});
	}

	async waitForDomSelector(
		args: WebWaitForSelectorArgs,
	): Promise<WebWaitResult> {
		await this.initialize();
		const session = await getWebSession(
			args.sessionId,
			args.maxHtmlChars,
			args.timeoutMs,
		);
		return waitForDomSelector({
			session,
			selector: args.selector,
			state: args.state,
			timeoutMs: args.timeoutMs,
			intervalMs: args.intervalMs,
			maxHtmlChars: args.maxHtmlChars,
		});
	}

	async waitForPageRender(args: WebWaitForRenderArgs): Promise<WebWaitResult> {
		await this.initialize();
		const session = await getWebSession(
			args.sessionId,
			args.maxHtmlChars,
			args.timeoutMs,
		);
		return waitForPageRender({
			session,
			timeoutMs: args.timeoutMs,
			intervalMs: args.intervalMs,
			stabilityMs: args.stabilityMs,
			maxHtmlChars: args.maxHtmlChars,
		});
	}

	async performDomAction(
		args: WebPerformDomActionArgs,
	): Promise<WebElementRecord> {
		await this.initialize();
		const session = await getWebSession(
			args.sessionId,
			args.maxHtmlChars,
			args.timeoutMs,
		);
		return performDomAction(
			session,
			args.action,
			{
				selector: args.selector,
				index: args.index,
				value: args.value,
			},
			args.maxHtmlChars,
			args.timeoutMs,
		);
	}
}

export { WebBrowserServiceMain as WebBrowserService };

export const webBrowserMainService = WebBrowserServiceMain.getInstance();
