import { logError } from "@/utils/logger";
import {
	CO_AGENT_ACTIVE_SESSION_STORAGE_KEY,
	CO_AGENT_BROWSER_COMMAND_SOURCE,
	isCoAgentBrowserCommandRequest,
	isCoAgentContentCommandResponse,
	type CoAgentActiveSession,
	type CoAgentBrowserCommandRequest,
	type CoAgentBrowserCommandResponse,
	type CoAgentContentCommandRequest,
	type CoAgentContentCommandResponse,
} from "@/services/co-agent";

const DEFAULT_TIMEOUT_MS = 8_000;

const toErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const createErrorResponse = (
	request: CoAgentBrowserCommandRequest,
	error: unknown,
): CoAgentBrowserCommandResponse => ({
	source: CO_AGENT_BROWSER_COMMAND_SOURCE,
	command: request.command,
	success: false,
	error: toErrorMessage(error),
});

const parseActiveSession = (value: unknown): CoAgentActiveSession | null => {
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	if (typeof record.tabId !== "number") return null;
	return {
		tabId: record.tabId,
		windowId: typeof record.windowId === "number" ? record.windowId : undefined,
		url: typeof record.url === "string" ? record.url : undefined,
		title: typeof record.title === "string" ? record.title : undefined,
		enabledAt:
			typeof record.enabledAt === "number" ? record.enabledAt : Date.now(),
	};
};

const getActiveSession = async (): Promise<CoAgentActiveSession> => {
	const storage = chrome.storage?.session;
	if (!storage) {
		throw new Error("Chrome session storage is unavailable.");
	}
	const result = await storage.get(CO_AGENT_ACTIVE_SESSION_STORAGE_KEY);
	const session = parseActiveSession(
		result[CO_AGENT_ACTIVE_SESSION_STORAGE_KEY],
	);
	if (!session) {
		throw new Error("No active co-agent tab. Enable co-agent on a page first.");
	}
	await chrome.tabs.get(session.tabId);
	return session;
};

const sendContentCommand = async (
	tabId: number,
	request: CoAgentContentCommandRequest,
	timeoutMs: number,
): Promise<CoAgentContentCommandResponse> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(
			() => reject(new Error("Timed out waiting for co-agent content script.")),
			timeoutMs,
		);
	});

	try {
		const rawResponse = await Promise.race([
			chrome.tabs.sendMessage(tabId, request),
			timeout,
		]);
		if (!isCoAgentContentCommandResponse(rawResponse)) {
			throw new Error("Invalid co-agent content-script response.");
		}
		return rawResponse;
	} finally {
		if (timeoutId !== undefined) {
			clearTimeout(timeoutId);
		}
	}
};

const handleCommand = async (
	request: CoAgentBrowserCommandRequest,
): Promise<CoAgentBrowserCommandResponse> => {
	if (request.command === "get-active") {
		const session = await getActiveSession();
		return {
			source: CO_AGENT_BROWSER_COMMAND_SOURCE,
			command: request.command,
			success: true,
			session,
		};
	}

	const session = await getActiveSession();
	const contentResponse = await sendContentCommand(
		session.tabId,
		request.request,
		request.timeoutMs ?? DEFAULT_TIMEOUT_MS,
	);
	return {
		source: CO_AGENT_BROWSER_COMMAND_SOURCE,
		command: request.command,
		success: true,
		session,
		contentResponse,
	};
};

export function registerCoAgentBrowserHandler(): void {
	chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
		if (!isCoAgentBrowserCommandRequest(rawMessage)) {
			return false;
		}

		void handleCommand(rawMessage)
			.then(sendResponse)
			.catch((error) => {
				logError("[CO_AGENT_BROWSER_HANDLER] Failed:", error);
				sendResponse(createErrorResponse(rawMessage, error));
			});
		return true;
	});
}
