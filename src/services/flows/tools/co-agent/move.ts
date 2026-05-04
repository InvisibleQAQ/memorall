import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { CO_AGENT_CONTENT_COMMAND_SOURCE } from "@/services/co-agent";
import {
	createDefaultErrorResult,
	createResult,
	sendCoAgentCommand,
} from "./shared";

const moveSchema = z
	.object({
		selector: z.string().min(1).optional(),
		index: z.number().int().optional(),
		x: z.number().optional(),
		y: z.number().optional(),
		scrollIntoView: z.boolean().optional(),
		message: z.string().optional(),
		mode: z.enum(["moveTo", "jumpTo"]).optional(),
	})
	.refine(
		(value) =>
			Boolean(value.selector) ||
			(value.x !== undefined && value.y !== undefined),
		{
			message: "Provide selector or both x and y.",
		},
	);

type MoveInput = z.infer<typeof moveSchema>;

const createMoveTool: ToolFactory<MoveInput> = (): Tool<MoveInput> => ({
	name: "co_agent_move",
	description:
		"Move the visible co-agent cursor to a selector/index or viewport coordinates. Optionally scroll the element into view.",
	schema: moveSchema,
	execute: async (input) => {
		try {
			const response = await sendCoAgentCommand({
				source: CO_AGENT_CONTENT_COMMAND_SOURCE,
				type: "co-agent:move",
				selector: input.selector,
				index: input.index,
				point:
					input.x !== undefined && input.y !== undefined
						? { x: input.x, y: input.y }
						: undefined,
				scrollIntoView: input.scrollIntoView,
				message: input.message,
				mode: input.mode,
			});
			return createResult({ actionType: "co_agent_move", ...response });
		} catch (error) {
			return createDefaultErrorResult(error);
		}
	},
});

toolRegistry.register("co_agent_move", createMoveTool);

declare global {
	interface ToolTypeRegistry {
		co_agent_move: {
			input: MoveInput;
			services: void;
		};
	}
}
