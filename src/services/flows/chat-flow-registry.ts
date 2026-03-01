/**
 * Chat Flow Registry
 *
 * A registry that allows any graph type to expose itself as a "chat-capable"
 * flow.  Each graph module self-registers at the bottom of its graph.ts file
 * by calling `chatFlowRegistry.register(graphType, factory)`.
 *
 * process-chat.ts (and any other chat handler) uses `chatFlowRegistry.create()`
 * to obtain a ready-to-stream graph — zero branching needed in the handler,
 * zero changes required when new graph types are added.
 */

import type { AllServices } from "./interfaces/tool";
import type { BaseFlow } from "./flow-registry";
import type { ChatCompletionMessageParam } from "@/types/openai";

// ---------------------------------------------------------------------------
// Common agent config shape (union of all graph config fields that the
// settings panel can persist).  Each adapter casts / picks the fields it needs.
// ---------------------------------------------------------------------------
export interface AgentFlowConfig {
	systemPrompt?: string;
	contextPrompt?: string;
	tools?: string[];
	enableContextRetrieval?: boolean;
	enableCitations?: boolean;
	/** Which graph handles this chat flow. */
	graphType?: string;
	[key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Context passed to getInitialState so each adapter can build its own state.
// ---------------------------------------------------------------------------
export interface ChatGraphContext {
	messages: ChatCompletionMessageParam[];
	/** Optional topic / knowledge graph ID used by RAG graphs. */
	topicId?: string;
	/** Additional retrieval hint queries (e.g. topic description). */
	contextQueries: string[];
}

// ---------------------------------------------------------------------------
// What a registered adapter returns
// ---------------------------------------------------------------------------
export interface ChatGraphResult {
	/** Compiled, ready-to-stream graph. */
	graph: BaseFlow;
	/** Build the initial state object to pass to graph.stream(). */
	getInitialState(ctx: ChatGraphContext): Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Factory signature every graph must implement to register
// ---------------------------------------------------------------------------
export type ChatFlowFactory = (
	services: AllServices,
	config: AgentFlowConfig,
	featureFlags: Record<string, boolean>,
) => ChatGraphResult;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
class ChatFlowRegistry {
	private factories = new Map<string, ChatFlowFactory>();

	/**
	 * Register a graph type as a chat-capable flow.
	 * Called once per graph module (self-registration pattern).
	 */
	register(graphType: string, factory: ChatFlowFactory): void {
		this.factories.set(graphType, factory);
	}

	/**
	 * Create a ChatGraphResult for the requested graphType.
	 * Falls back to "knowledge-rag" if the type is unknown.
	 */
	create(
		graphType: string,
		services: AllServices,
		config: AgentFlowConfig,
		featureFlags: Record<string, boolean>,
	): ChatGraphResult {
		const factory =
			this.factories.get(graphType) ?? this.factories.get("knowledge-rag");
		if (!factory) {
			throw new Error(
				`[ChatFlowRegistry] No chat flow registered for type "${graphType}" and no "knowledge-rag" fallback.`,
			);
		}
		return factory(services, config, featureFlags);
	}

	getRegisteredTypes(): string[] {
		return Array.from(this.factories.keys());
	}

	has(graphType: string): boolean {
		return this.factories.has(graphType);
	}
}

export const chatFlowRegistry = new ChatFlowRegistry();
