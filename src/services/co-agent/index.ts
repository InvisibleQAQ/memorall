export type {
	CoAgentActiveSession,
	CoAgentBrowserCommandRequest,
	CoAgentBrowserCommandResponse,
	CoAgentContentCommandRequest,
	CoAgentContentCommandResponse,
	CoAgentCursorMode,
	CoAgentElementInfo,
	CoAgentImageInfo,
	CoAgentPageSnapshot,
	CoAgentPoint,
	CoAgentRect,
	CoAgentTraceStep,
	CoAgentViewport,
} from "./co-agent-protocol";

export {
	CO_AGENT_ACTIVE_SESSION_STORAGE_KEY,
	CO_AGENT_BROWSER_COMMAND_SOURCE,
	CO_AGENT_CONTENT_COMMAND_SOURCE,
	isCoAgentBrowserCommandRequest,
	isCoAgentBrowserCommandResponse,
	isCoAgentContentCommandRequest,
	isCoAgentContentCommandResponse,
} from "./co-agent-protocol";
