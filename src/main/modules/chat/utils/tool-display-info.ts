/**
 * Static display info for tools in the Agent Settings UI.
 * Avoids instantiating tools (which require bound services) just for descriptions.
 */
export const TOOL_DISPLAY_INFO: Record<
	string,
	{ description: string; descriptionKey?: string }
> = {
	current_time: {
		description: "Get the current date and time",
		descriptionKey: "agentSettings.toolDescriptions.current_time",
	},
	load_skill: {
		description: "Load a skill by name for specialized instructions",
		descriptionKey: "agentSettings.toolDescriptions.load_skill",
	},
	js_execute: {
		description: "Execute JavaScript code in a sandboxed environment",
		descriptionKey: "agentSettings.toolDescriptions.js_execute",
	},
	calculator: {
		description: "Perform basic mathematical calculations",
		descriptionKey: "agentSettings.toolDescriptions.calculator",
	},
	knowledge_graph: {
		description: "Query the knowledge graph for relationships and entities",
		descriptionKey: "agentSettings.toolDescriptions.knowledge_graph",
	},
	structmem_knowledge_retrieval: {
		description:
			"Retrieve StructMem event and synthesis memories for grounded context",
		descriptionKey:
			"agentSettings.toolDescriptions.structmem_knowledge_retrieval",
	},
	doc_read: {
		description: "Read document files from the file system",
		descriptionKey: "agentSettings.toolDescriptions.doc_read",
	},
	doc_write: {
		description: "Write content to document files",
		descriptionKey: "agentSettings.toolDescriptions.doc_write",
	},
	doc_edit: {
		description: "Edit existing document files",
		descriptionKey: "agentSettings.toolDescriptions.doc_edit",
	},
	doc_search: {
		description: "Search through documents for content",
		descriptionKey: "agentSettings.toolDescriptions.doc_search",
	},
	doc_move: {
		description: "Move or rename document files",
		descriptionKey: "agentSettings.toolDescriptions.doc_move",
	},
	doc_remove: {
		description: "Remove document files from the file system",
		descriptionKey: "agentSettings.toolDescriptions.doc_remove",
	},
	send_message_to_agent: {
		description: "Send a focused message to a selected child agent",
		descriptionKey: "agentSettings.toolDescriptions.send_message_to_agent",
	},
};
