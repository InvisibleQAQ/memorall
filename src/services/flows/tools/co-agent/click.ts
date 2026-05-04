import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const clickSchema = z.object({
	selector: z.string().min(1),
	index: z.number().int().optional(),
	message: z.string().optional(),
});

type ClickInput = z.infer<typeof clickSchema>;

const createClickTool: ToolFactory<ClickInput> = (): Tool<ClickInput> => ({
	name: "co_agent_click",
	description:
		"Safely click a selected element in the active co-agent tab. High-impact or sensitive targets are blocked and require user action.",
	schema: clickSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:click",
				selector: input.selector,
				index: input.index,
				message: input.message,
			});
			return createResult({
				actionType: "co_agent_click",
				selector: input.selector,
				...response,
			});
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_click", createClickTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_click: {
			input: ClickInput;
			services: void;
		};
	}
}
