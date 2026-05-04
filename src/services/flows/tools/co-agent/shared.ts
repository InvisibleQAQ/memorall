import {
	CO_AGENT_BROWSER_COMMAND_SOURCE,
	isCoAgentBrowserCommandResponse,
	type CoAgentContentCommandRequest,
	type CoAgentContentCommandResponse,
} from "@/services/co-agent";

const DEFAULT_TIMEOUT_MS = 10_000;

export const createDefaultErrorResult = (error: unknown): string =>
	JSON.stringify(
		{
			actionType: "co_agent_error",
			success: false,
			error: error instanceof Error ? error.message : String(error),
		},
		null,
		2,
	);

export const createResult = (payload: Record<string, unknown>): string =>
	JSON.stringify(payload, null, 2);

export const sendCoAgentCommand = async (
	request: CoAgentContentCommandRequest,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CoAgentContentCommandResponse> => {
	const rawResponse = await chrome.runtime.sendMessage({
		source: CO_AGENT_BROWSER_COMMAND_SOURCE,
		command: "content-command",
		request,
		timeoutMs,
	});
	if (!isCoAgentBrowserCommandResponse(rawResponse)) {
		throw new Error("Invalid co-agent browser response.");
	}
	if (!rawResponse.success) {
		throw new Error(rawResponse.error);
	}
	if (!rawResponse.contentResponse) {
		throw new Error("Co-agent command did not return content data.");
	}
	return rawResponse.contentResponse;
};
