import z from "zod";
import type { Tool, ToolFactory } from "@/services/flows/interfaces/tool";
import { toolRegistry } from "@/services/flows/tool-registry";
import { sandboxContainerService } from "@/services/sandbox-container";

const TOOL_NAME = "container_install_package" as const;

const schema = z.object({
	packageSpec: z
		.string()
		.min(1)
		.describe("Package spec, e.g. react, lodash@latest, or @types/node."),
	save: z
		.boolean()
		.optional()
		.describe("Save as dependency in package.json (default true)."),
	saveDev: z
		.boolean()
		.optional()
		.describe("Save as devDependency in package.json (default false)."),
});

type Input = z.infer<typeof schema>;

export const createContainerInstallPackageTool: ToolFactory<
	Input,
	undefined
> = (): Tool<Input> => ({
	name: TOOL_NAME,
	description: "Install an npm package in the sandbox container.",
	schema,
	execute: async (input) => {
		const result = await sandboxContainerService.installPackage({
			packageSpec: input.packageSpec,
			save: input.save ?? true,
			saveDev: input.saveDev ?? false,
		});
		return JSON.stringify(result, null, 2);
	},
});

toolRegistry.register(TOOL_NAME, createContainerInstallPackageTool);

declare global {
	interface ToolTypeRegistry {
		[TOOL_NAME]: {
			input: Input;
			services: undefined;
		};
	}
}
