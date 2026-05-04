export {
	CO_AGENT_CAPTURE_EVENT,
	CO_AGENT_STATUS_EVENT,
} from "./constants";
export { createCoAgentOverlay, destroyCoAgentOverlay } from "./overlay";
export {
	createGetTraceRequest,
	handleCoAgentContentCommand,
} from "./content-command-handler";
export { emitCoAgentStatus } from "./events";
export {
	formatCoAgentTracePrompt,
	getCoAgentTrace,
} from "@/embedded/utils/co-agent/trace";
