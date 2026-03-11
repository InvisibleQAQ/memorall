import type { AllServices } from "@/services/flows/interfaces/tool";
import type { IWebBrowserService } from "@/services/web-browser";

export type WebToolServices = Pick<AllServices, "webBrowser">;

export const requireWebBrowserService = (
	services: WebToolServices,
): IWebBrowserService => {
	if (!services.webBrowser) {
		throw new Error("Web browser service is not available.");
	}
	return services.webBrowser;
};

export const createDefaultWebErrorResult = (error: unknown): string =>
	JSON.stringify(
		{
			actionType: "web_tool_error",
			success: false,
			error: error instanceof Error ? error.message : String(error),
		},
		null,
		2,
	);

export const createWebResult = (payload: Record<string, unknown>): string =>
	JSON.stringify(payload, null, 2);
