import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import {
	appendAssistantOutputToState,
	type BaseStateBase,
} from "@/services/flows/graph/graph.base";

const TOOL_NAME = "render_memorall_artifact" as const;

const schema = z.object({
	type: z.enum(["html", "url"]),
	content: z.string().min(1),
	title: z.string().optional(),
});

type Input = z.infer<typeof schema>;

const escapeAttribute = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

const buildArtifactMessageContent = ({
	type,
	content,
	title,
}: Input): string => {
	const titleAttr = title ? ` title="${escapeAttribute(title)}"` : "";
	return `<memorall_artifact type="${type}"${titleAttr}>${content}</memorall_artifact>`;
};

export const createRenderMemorallArtifactTool: ToolFactory<
	Input
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description:
		"Append a Memorall artifact to the graph output as an assistant message. The tool result is only a normal OpenAI tool message; the artifact itself is added to graph state.",
	schema,
	execute: async (input, context) => {
		if (!context) {
			return "Artifact was not rendered because graph state context is unavailable.";
		}

		appendAssistantOutputToState(
			context.state as BaseStateBase,
			buildArtifactMessageContent(input),
		);

		return [
			{
				type: "text",
				text: "Artifact appended to the assistant output message.",
			},
		];
	},
});

toolRegistry.register(TOOL_NAME, createRenderMemorallArtifactTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
