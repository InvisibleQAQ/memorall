export {
	WebBrowserService,
	WebBrowserServiceMain,
	webBrowserMainService,
} from "./web-browser-service-main";

export { WebBrowserServiceProxy } from "./web-browser-service-proxy";

export type { IWebBrowserService } from "./interfaces/web-browser-service.interface";

export type {
	ActiveWebSessionInfo,
	WebBrowserOperation,
	WebBrowserOperationJobPayload,
	WebBrowserOperationJobResult,
	WebBrowserOperationPayloadMap,
	WebBrowserOperationResultMap,
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

export { WEB_BROWSER_OPERATION_JOB_NAME } from "./types";

export type {
	BrowserBackedWebMode,
	WebBrowserCommandRequest,
	WebBrowserCommandResponse,
	WebBrowserMode,
	WebBrowserSurface,
	WebContentCommandRequest,
	WebContentCommandResponse,
	WebDomActionName,
	WebDomElementInfo,
	WebElementRecord,
	WebSnapshotPayload,
	WebWaitSelectorState,
} from "./web-browser-protocol";

export {
	WEB_BROWSER_COMMAND_SOURCE,
	WEB_BROWSER_SURFACE_STORAGE_KEY,
	WEB_CONTENT_COMMAND_SOURCE,
	isWebBrowserCommandRequest,
	isWebBrowserCommandResponse,
	isWebContentCommandRequest,
	isWebContentCommandResponse,
} from "./web-browser-protocol";
