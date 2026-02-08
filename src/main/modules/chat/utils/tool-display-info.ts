/**
 * Static display info for tools in the Agent Settings UI.
 * Avoids instantiating tools (which require bound services) just for descriptions.
 */
export const TOOL_DISPLAY_INFO: Record<string, { description: string }> = {
	current_time: {
		description: "Get the current date and time",
	},
	js_execute: {
		description: "Execute JavaScript code in a sandboxed environment",
	},
	calculator: {
		description: "Perform basic mathematical calculations",
	},
	memory_search: {
		description: "Search through conversation memory and knowledge base",
	},
	knowledge_graph: {
		description: "Query the knowledge graph for relationships and entities",
	},
	doc_read: {
		description: "Read document files from the file system",
	},
	doc_write: {
		description: "Write content to document files",
	},
	doc_edit: {
		description: "Edit existing document files",
	},
	doc_search: {
		description: "Search through documents for content",
	},
	doc_move: {
		description: "Move or rename document files",
	},
	doc_remove: {
		description: "Remove document files from the file system",
	},
};
