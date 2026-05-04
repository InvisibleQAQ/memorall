import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const inputSchema = z.object({
	selector: z.string().min(1),
	index: z.number().int().optional(),
	value: z.string(),
	message: z.string().optional(),
});

type InputInput = z.infer<typeof inputSchema>;

const createInputTool: ToolFactory<InputInput> = (): Tool<InputInput> => ({
	name: "co_agent_input",
	description:
		"Safely type text into a selected text input or textarea in the active co-agent tab. Sensitive fields are blocked.",
	schema: inputSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:input",
				selector: input.selector,
				index: input.index,
				value: input.value,
				message: input.message,
			});
			return createResult({
				actionType: "co_agent_input",
				selector: input.selector,
				...response,
			});
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_input", createInputTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_input: {
			input: InputInput;
			services: void;
		};
	}
}
