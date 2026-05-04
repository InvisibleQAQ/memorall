import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const scrollSchema = z.object({
	selector: z.string().min(1).optional(),
	index: z.number().int().optional(),
	deltaX: z.number().optional(),
	deltaY: z.number().optional(),
	top: z.number().optional(),
	left: z.number().optional(),
	behavior: z.enum(["auto", "smooth"]).optional(),
	message: z.string().optional(),
});

type ScrollInput = z.infer<typeof scrollSchema>;

const createScrollTool: ToolFactory<ScrollInput> = (): Tool<ScrollInput> => ({
	name: "co_agent_scroll",
	description:
		"Scroll the active co-agent tab window or a selected scrollable element.",
	schema: scrollSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:scroll",
				selector: input.selector,
				index: input.index,
				deltaX: input.deltaX,
				deltaY: input.deltaY,
				top: input.top,
				left: input.left,
				behavior: input.behavior,
				message: input.message,
			});
			return createResult({ actionType: "co_agent_scroll", ...response });
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_scroll", createScrollTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_scroll: {
			input: ScrollInput;
			services: void;
		};
	}
}
