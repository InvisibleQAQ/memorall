import type {
	ChatCompletionRequest,
	ChatCompletionTool,
	ChatCompletionMessageToolCall,
	ChatCompletionResponse,
	ChatCompletionMessageParam,
} from "@/types/openai";

/**
 * Format tool parameters from OpenAI JSON Schema format
 */
function formatToolParameters(parameters: Record<string, unknown>): string {
	const props = parameters.properties as Record<string, unknown> | undefined;
	if (!props) return "";

	const required = (parameters.required as string[]) || [];
	const params: string[] = [];

	for (const [key, value] of Object.entries(props)) {
		const prop = value as Record<string, unknown>;
		let paramStr = key;
		if (!required.includes(key)) paramStr += "?";
		if (prop.description) paramStr += ` (${prop.description})`;
		if (prop.enum && Array.isArray(prop.enum)) {
			paramStr += ` [${prop.enum.join("|")}]`;
		}
		params.push(paramStr);
	}

	return params.join(", ");
}

/**
 * Generate tool instructions for system prompt (Python function call format)
 */
function generateToolInstructions(tools: ChatCompletionTool[]): string {
	const toolList = tools
		.map((tool) => {
			const fn = tool.function;
			const params = fn.parameters
				? formatToolParameters(fn.parameters as Record<string, unknown>)
				: "";
			return `- ${fn.name}: ${fn.description || "No description"}${params ? `. Parameters: ${params}` : ""}`;
		})
		.join("\n");

	return `Available tools:
${toolList}

To use a tool, respond with Python function call format in a single line:
tool_name(param1="value1", param2="value2")

Example:
current_time(timezone="America/New_York")

Important: Must respond with exactly one line function call and nothing else.
`;
}

/**
 * Inject tools into system prompt for models without native support
 */
export function injectToolsIntoSystemPrompt(
	request: ChatCompletionRequest,
): ChatCompletionRequest {
	if (!request.tools?.length) return request;

	const injectionPrompt = generateToolInstructions(request.tools);

	const messages = [...request.messages];
	const systemIdx = messages.findIndex((m) => m.role === "system");

	if (systemIdx >= 0) {
		const existingContent = messages[systemIdx].content;
		const contentStr =
			typeof existingContent === "string"
				? existingContent
				: existingContent
						?.map((p) => ("text" in p ? p.text : ""))
						.join("\n") || "";
		messages[systemIdx] = {
			role: "system",
			content: `${injectionPrompt}\n\n---\n\n${contentStr}`,
		} as ChatCompletionMessageParam;
	} else {
		messages.unshift({ role: "system", content: injectionPrompt });
	}

	// Remove tools from request (now in prompt)
	const { tools, tool_choice, parallel_tool_calls, ...rest } = request;
	return { ...rest, messages };
}

/**
 * Parse tool call from model text output (Python function call format)
 */
export function parseToolCallsFromText(
	content: string,
): ChatCompletionMessageToolCall[] | null {
	if (!content) return null;

	// Match Python function call format: tool_name(param1="value1", param2="value2")
	const toolCallMatch = content.match(/(\w+)\s*\(([^)]*)\)/);
	if (!toolCallMatch) return null;

	const [, toolName, paramString] = toolCallMatch;
	const args: Record<string, unknown> = {};

	if (paramString.trim()) {
		// Match parameters like param1="value1", param2=123
		const paramMatches = paramString.matchAll(
			/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g,
		);
		for (const match of paramMatches) {
			const [, key, quotedValue, singleQuotedValue, unquotedValue] = match;
			const value = quotedValue || singleQuotedValue || unquotedValue;

			// Try to parse as number if it's unquoted and looks like a number
			if (!quotedValue && !singleQuotedValue && /^\d+(\.\d+)?$/.test(value)) {
				args[key] = Number(value);
			} else {
				args[key] = value;
			}
		}
	}

	return [
		{
			id: `call_${Math.random().toString(36).slice(2, 11)}`,
			type: "function",
			function: {
				name: toolName,
				arguments: JSON.stringify(args),
			},
		},
	];
}

/**
 * Process response to extract tool calls (for prompt injection mode)
 */
export function extractToolCallsFromResponse(
	response: ChatCompletionResponse,
): ChatCompletionResponse {
	const message = response.choices[0]?.message;
	if (!message?.content) return response;

	const toolCalls = parseToolCallsFromText(message.content);
	if (!toolCalls) return response;

	return {
		...response,
		choices: [
			{
				...response.choices[0],
				message: {
					role: "assistant",
					content: null,
					tool_calls: toolCalls,
				},
				finish_reason: "tool_calls",
			},
		],
	};
}
