import type {
	ChatCompletionChunk,
	ChatCompletionChunkToolCall,
	ChatCompletionMessageParam,
	ChatCompletionMessageToolCall,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatCompletionTool,
} from "@/types/openai";

function stringifyContent(
	content: ChatCompletionMessageParam["content"],
): string | ChatCompletionMessageParam["content"] {
	if (typeof content === "string" || content == null) {
		return content;
	}

	if (Array.isArray(content) && content.every((part) => part.type === "text")) {
		return content
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("\n");
	}

	return content;
}

function formatToolSchema(tool: ChatCompletionTool): Record<string, unknown> {
	return {
		name: tool.function.name,
		description: tool.function.description || "",
		parameters:
			tool.function.parameters &&
			Object.keys(tool.function.parameters).length > 0
				? tool.function.parameters
				: {
						type: "object",
						properties: {},
						additionalProperties: false,
					},
	};
}

function generateToolInstructions(request: ChatCompletionRequest): string {
	const toolSchema = (request.tools || []).map(formatToolSchema);
	const toolChoice =
		request.tool_choice === undefined
			? "auto"
			: JSON.stringify(request.tool_choice);

	return [
		"You may answer normally in plain text, or call tools using a strict JSON object.",
		"",
		"Available tools:",
		JSON.stringify(toolSchema, null, 2),
		"",
		`tool_choice: ${toolChoice}`,
		"",
		"If a tool is needed, reply with exactly one JSON object and nothing else:",
		'{"tool_calls":[{"name":"tool_name","arguments":{"key":"value"}}]}',
		"",
		"Rules:",
		"- Do not wrap the JSON in markdown or code fences.",
		"- Use tool_calls only when a tool is actually needed.",
		"- Arguments must be valid JSON.",
		"- Multiple tool calls are allowed only when they are all required to continue.",
	].join("\n");
}

export function normalizeMessagesForPromptTools(
	messages: ChatCompletionMessageParam[],
): ChatCompletionMessageParam[] {
	const toolNameById = new Map<string, string>();

	return messages.map((message) => {
		if (message.role === "assistant" && message.tool_calls?.length) {
			const toolCalls = message.tool_calls.map((toolCall) => {
				toolNameById.set(toolCall.id, toolCall.function.name);

				let parsedArguments: unknown = toolCall.function.arguments;
				try {
					parsedArguments = JSON.parse(toolCall.function.arguments);
				} catch {
					// Keep the raw string when arguments are not valid JSON.
				}

				return {
					id: toolCall.id,
					name: toolCall.function.name,
					arguments: parsedArguments,
				};
			});

			const textParts: string[] = [];
			const content = stringifyContent(message.content);
			if (typeof content === "string" && content.trim()) {
				textParts.push(content.trim());
			}

			textParts.push("Tool calls made previously:");
			textParts.push(JSON.stringify(toolCalls, null, 2));

			return {
				role: "assistant",
				content: textParts.join("\n\n"),
			};
		}

		if (message.role === "tool") {
			const toolName = toolNameById.get(message.tool_call_id) || "unknown_tool";
			return {
				role: "user",
				content: [
					`Tool result for ${toolName} (${message.tool_call_id}):`,
					message.content,
					"Continue using this tool result.",
				].join("\n\n"),
			};
		}

		if (
			(message.role === "system" || message.role === "assistant") &&
			Array.isArray(message.content)
		) {
			const content = stringifyContent(message.content);
			if (typeof content === "string") {
				return {
					...message,
					content,
				};
			}
		}

		return message;
	});
}

export function preparePromptToolRequest(
	request: ChatCompletionRequest,
): ChatCompletionRequest {
	const normalizedMessages = normalizeMessagesForPromptTools(request.messages);
	const messages = [...normalizedMessages];

	if (request.tools?.length) {
		const injectionPrompt = generateToolInstructions(request);
		const systemIdx = messages.findIndex(
			(message) => message.role === "system",
		);

		if (systemIdx >= 0) {
			const existingContent = stringifyContent(messages[systemIdx].content);
			messages[systemIdx] = {
				role: "system",
				content:
					typeof existingContent === "string" &&
					existingContent.trim().length > 0
						? `${injectionPrompt}\n\n---\n\n${existingContent}`
						: injectionPrompt,
			};
		} else {
			messages.unshift({ role: "system", content: injectionPrompt });
		}
	}

	const { tools, tool_choice, parallel_tool_calls, ...rest } = request;
	return { ...rest, messages };
}

export function injectToolsIntoSystemPrompt(
	request: ChatCompletionRequest,
): ChatCompletionRequest {
	return preparePromptToolRequest(request);
}

function stripCodeFences(content: string): string {
	const trimmed = content.trim();
	if (!trimmed.startsWith("```")) {
		return trimmed;
	}

	return trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "")
		.trim();
}

function extractBalancedJsonObject(content: string): string | null {
	const trimmed = stripCodeFences(content);
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
		return trimmed;
	}

	const toolCallsIndex = trimmed.indexOf('"tool_calls"');
	if (toolCallsIndex < 0) {
		return null;
	}

	let candidateStart = trimmed.lastIndexOf("{", toolCallsIndex);
	while (candidateStart >= 0) {
		let depth = 0;
		let inString = false;
		let escaped = false;

		for (let index = candidateStart; index < trimmed.length; index += 1) {
			const char = trimmed[index];
			if (inString) {
				if (escaped) {
					escaped = false;
					continue;
				}
				if (char === "\\") {
					escaped = true;
					continue;
				}
				if (char === '"') {
					inString = false;
				}
				continue;
			}

			if (char === '"') {
				inString = true;
				continue;
			}

			if (char === "{") {
				depth += 1;
				continue;
			}

			if (char !== "}") {
				continue;
			}

			depth -= 1;
			if (depth === 0) {
				const candidate = trimmed.slice(candidateStart, index + 1);
				if (candidate.includes('"tool_calls"')) {
					return candidate;
				}
				break;
			}
		}

		candidateStart = trimmed.lastIndexOf("{", candidateStart - 1);
	}

	return null;
}

function parseArgumentsValue(value: unknown): unknown {
	if (typeof value !== "string") {
		return value ?? {};
	}

	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}

function normalizeParsedToolCalls(toolCallsValue: unknown) {
	if (!Array.isArray(toolCallsValue) || toolCallsValue.length === 0) {
		return null;
	}

	const toolCalls: ChatCompletionMessageToolCall[] = [];

	for (const [index, item] of toolCallsValue.entries()) {
		if (!item || typeof item !== "object") {
			return null;
		}

		const rawToolCall = item as {
			id?: string;
			name?: string;
			arguments?: unknown;
			function?: {
				name?: string;
				arguments?: unknown;
			};
		};

		const name = rawToolCall.name || rawToolCall.function?.name;
		if (!name) {
			return null;
		}

		const argumentsValue =
			rawToolCall.arguments ?? rawToolCall.function?.arguments ?? {};

		toolCalls.push({
			id:
				rawToolCall.id ||
				`call_${Math.random().toString(36).slice(2, 11)}_${index}`,
			type: "function",
			function: {
				name,
				arguments: JSON.stringify(parseArgumentsValue(argumentsValue)),
			},
		});
	}

	return toolCalls;
}

function parseToolCallsFromJsonEnvelope(
	content: string,
): ChatCompletionMessageToolCall[] | null {
	const jsonObject = extractBalancedJsonObject(content);
	if (!jsonObject) {
		return null;
	}

	try {
		const parsed = JSON.parse(jsonObject) as { tool_calls?: unknown };
		return normalizeParsedToolCalls(parsed.tool_calls);
	} catch {
		return null;
	}
}

function parseLegacyPythonToolCalls(
	content: string,
): ChatCompletionMessageToolCall[] | null {
	const candidates: string[] = [];
	const trimmedContent = content.trim();

	const wrappedToolCalls = trimmedContent.matchAll(
		/<\|tool_call_start\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>/gi,
	);
	for (const match of wrappedToolCalls) {
		if (match[1]) {
			candidates.push(match[1].trim());
		}
	}

	if (candidates.length === 0) {
		candidates.push(trimmedContent);
	}

	for (let trimmed of candidates) {
		if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
			trimmed = trimmed.slice(1, -1).trim();
		}

		const toolCallMatch = trimmed.match(/^\s*(\w+)\s*\((.*)\)\s*$/s);
		if (!toolCallMatch) {
			continue;
		}

		const [, toolName, paramString] = toolCallMatch;
		const args: Record<string, unknown> = {};

		if (paramString.trim()) {
			const paramMatches = paramString.matchAll(
				/(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g,
			);
			for (const match of paramMatches) {
				const [, key, quotedValue, singleQuotedValue, unquotedValue] = match;
				const value = quotedValue || singleQuotedValue || unquotedValue;

				if (
					!quotedValue &&
					!singleQuotedValue &&
					/^-?\d+(\.\d+)?$/.test(value)
				) {
					args[key] = Number(value);
				} else if (
					!quotedValue &&
					!singleQuotedValue &&
					/^(true|false)$/i.test(value)
				) {
					args[key] = value.toLowerCase() === "true";
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

	return null;
}

export function parseToolCallsFromText(
	content: string,
): ChatCompletionMessageToolCall[] | null {
	if (!content) {
		return null;
	}

	return (
		parseToolCallsFromJsonEnvelope(content) ||
		parseLegacyPythonToolCalls(content)
	);
}

export function extractToolCallsFromResponse(
	response: ChatCompletionResponse,
): ChatCompletionResponse {
	const message = response.choices[0]?.message;
	if (!message?.content) {
		return response;
	}

	const toolCalls = parseToolCallsFromText(message.content);
	if (!toolCalls) {
		return response;
	}

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

function toChunkToolCalls(
	toolCalls: ChatCompletionMessageToolCall[],
): ChatCompletionChunkToolCall[] {
	return toolCalls.map((toolCall, index) => ({
		index,
		id: toolCall.id,
		type: "function",
		function: {
			name: toolCall.function.name,
			arguments: toolCall.function.arguments,
		},
	}));
}

type StreamClassification = "undecided" | "tool_candidate" | "text";

export class PromptToolStreamTransformer {
	private pendingChunks: ChatCompletionChunk[] = [];
	private accumulatedText = "";
	private classification: StreamClassification = "undecided";

	private classify(): StreamClassification {
		const trimmed = this.accumulatedText.trimStart();
		if (!trimmed) {
			return "undecided";
		}

		if (
			trimmed.startsWith("{") ||
			trimmed.startsWith("```") ||
			trimmed.startsWith("<") ||
			trimmed.startsWith("[")
		) {
			return "tool_candidate";
		}

		return "text";
	}

	ingest(chunk: ChatCompletionChunk): ChatCompletionChunk[] {
		const choice = chunk.choices[0];
		if (!choice) {
			return [chunk];
		}

		const text = choice.delta.content ?? "";
		if (text) {
			this.accumulatedText += text;
		}

		if (this.classification === "text") {
			return [chunk];
		}

		this.pendingChunks.push(chunk);
		this.classification = this.classify();

		if (this.classification === "text") {
			const flushed = this.pendingChunks;
			this.pendingChunks = [];
			return flushed;
		}

		if (!choice.finish_reason) {
			return [];
		}

		const toolCalls = parseToolCallsFromText(this.accumulatedText);
		if (!toolCalls) {
			const flushed = this.pendingChunks;
			this.pendingChunks = [];
			return flushed;
		}

		this.pendingChunks = [];
		return [
			{
				id: chunk.id,
				object: chunk.object,
				created: chunk.created,
				model: chunk.model,
				choices: [
					{
						index: choice.index,
						delta: {
							role: "assistant",
							tool_calls: toChunkToolCalls(toolCalls),
						},
						finish_reason: "tool_calls",
					},
				],
				usage: chunk.usage,
			},
		];
	}

	flush(): ChatCompletionChunk[] {
		if (this.pendingChunks.length === 0) {
			return [];
		}

		const flushed = this.pendingChunks;
		this.pendingChunks = [];
		return flushed;
	}
}
