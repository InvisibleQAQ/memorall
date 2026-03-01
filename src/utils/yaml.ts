import { stringify } from "yaml";

/**
 * Format tool call arguments as a YAML block under an "input:" key.
 *
 * Example output:
 *   input:
 *     file_path: /notes/todo.md
 *     offset: 1
 *     deep:
 *       first: data
 *       second_deep:
 *         data: 2
 */
export function formatYAML(args: Record<string, unknown>): string {
	if (Object.keys(args).length === 0) return "input:";
	return stringify({ input: args }, { lineWidth: 0 }).trimEnd();
}
