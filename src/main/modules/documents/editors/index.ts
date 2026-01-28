/**
 * Document Editors Module
 * Exports all editors and handles registration
 */

export * from "./types";
export * from "./registry";
export { MarkdownEditor } from "./MarkdownEditor";

// Import editors and registry
import { MarkdownEditor } from "./MarkdownEditor";
import { editorRegistry } from "./registry";

/**
 * Register all available editors
 * Call this once during app initialization
 */
export function registerAllEditors(): void {
	// Register Markdown Editor
	editorRegistry.register({
		type: "markdown",
		component: MarkdownEditor,
		name: "Markdown Editor",
		supportsCreate: true,
		defaultExtension: ".md",
		mimeType: "text/markdown",
	});

	// Future editors can be registered here:
	// editorRegistry.register({
	//   type: "text",
	//   component: TextEditor,
	//   name: "Text Editor",
	//   supportsCreate: true,
	//   defaultExtension: ".txt",
	//   mimeType: "text/plain",
	// });
}
