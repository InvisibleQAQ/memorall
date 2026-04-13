/**
 * How tools are supported by a model/provider
 */
export type ToolSupportMode =
	| "native" // Native API support (OpenAI, Claude, Gemini)
	| "prompt_injection" // Tools injected into system prompt, parsed from output
	| "none"; // No tool support

/**
 * Tool capability information for a model
 */
export interface ToolCapabilityInfo {
	/** Whether tools are supported */
	supported: boolean;
	/** How tools are implemented */
	mode: ToolSupportMode;
	/** Maximum number of tools (undefined = unlimited) */
	maxTools?: number;
	/** Supports parallel tool calls in single response */
	parallelCalls: boolean;
	/** Supports streaming with tool calls */
	streamingToolCalls: boolean;
	/** Supports strict JSON schema validation */
	strictMode: boolean;
	/** Additional notes about limitations */
	notes?: string;
}

/** Default: no tool support */
export const NO_TOOL_SUPPORT: ToolCapabilityInfo = {
	supported: false,
	mode: "none",
	parallelCalls: false,
	streamingToolCalls: false,
	strictMode: false,
};

/** Full native support */
export const NATIVE_TOOL_SUPPORT: ToolCapabilityInfo = {
	supported: true,
	mode: "native",
	parallelCalls: true,
	streamingToolCalls: true,
	strictMode: true,
};

/** Prompt-based support */
export const PROMPT_TOOL_SUPPORT: ToolCapabilityInfo = {
	supported: true,
	mode: "prompt_injection",
	maxTools: 10,
	parallelCalls: false,
	streamingToolCalls: false,
	strictMode: false,
	notes: "Tools injected as system prompt. Response parsing may fail.",
};

/** Prompt-based support with terminal streaming tool call synthesis */
export const PROMPT_TOOL_SUPPORT_WITH_STREAMING: ToolCapabilityInfo = {
	...PROMPT_TOOL_SUPPORT,
	streamingToolCalls: true,
	notes:
		"Tools injected as system prompt. Only the terminal stream chunk may contain tool_calls.",
};
