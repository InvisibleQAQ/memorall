import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const observeSchema = z.object({
	maxTextChars: z.number().int().optional(),
	maxVisibleTextChars: z.number().int().optional(),
	maxDomElements: z.number().int().optional(),
});

type ObserveInput = z.infer<typeof observeSchema>;

const createObserveTool: ToolFactory<
	ObserveInput
> = (): Tool<ObserveInput> => ({
	name: "co_agent_observe",
	description:
		"Observe the active co-agent browser tab, including URL, title, viewport, visible text, clipped page text, and visible DOM summary.",
	schema: observeSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:observe",
				maxTextChars: input.maxTextChars,
				maxVisibleTextChars: input.maxVisibleTextChars,
				maxDomElements: input.maxDomElements,
			});
			return createResult({ actionType: "co_agent_observe", ...response });
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_observe", createObserveTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_observe: {
			input: ObserveInput;
			services: void;
		};
	}
}
