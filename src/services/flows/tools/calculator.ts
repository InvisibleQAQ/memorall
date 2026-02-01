import z from "zod";
import type { Tool, ToolFactory } from "../interfaces/tool";
import { toolRegistry } from "../tool-registry";

const TOOL_NAME = "calculator" as const;

const schema = z.object({
	operation: z.enum(["add", "subtract", "multiply", "divide"]),
	a: z.number().describe("First number"),
	b: z.number().describe("Second number"),
});

type Input = z.infer<typeof schema>;

export const createCalculatorTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Perform basic mathematical calculations",
	schema,
	execute: async (input) => {
		const { operation, a, b } = input;
		let result: number;

		switch (operation) {
			case "add":
				result = a + b;
				break;
			case "subtract":
				result = a - b;
				break;
			case "multiply":
				result = a * b;
				break;
			case "divide":
				if (b === 0) throw new Error("Division by zero");
				result = a / b;
				break;
			default:
				throw new Error(`Unknown operation: ${operation}`);
		}

		return `${a} ${operation} ${b} = ${result}`;
	},
});

// Self-register the tool
toolRegistry.register(TOOL_NAME, createCalculatorTool);

// Extend global ToolTypeRegistry for type-safe tool creation
declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
