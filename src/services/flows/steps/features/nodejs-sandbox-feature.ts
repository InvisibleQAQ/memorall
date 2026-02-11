import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import { GraphBase, type ToolName } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";

const STEP_NAME = "nodejs-sandbox-feature" as const;
export const NODEJS_SANDBOX_FEATURE_NAME = STEP_NAME;

export interface NodejsSandboxFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: `${ToolName}`[];
}

export interface NodejsSandboxFeatureOutput {
	tools?: `${ToolName}`[];
	messages?: ChatCompletionMessageParam[];
}

export interface NodejsSandboxFeatureConfig {}

export type NodejsSandboxFeatureServices = {};

const SYSTEM_PROMPT_INSTRUCTION = `
# NODEJS SANDBOX FEATURE
You have access to an isolated browser-based sandbox container with virtual filesystem, npm package management (loaded from CDN), runtime execution, and HTTP resource access.

## IMPORTANT RUNTIME CONSTRAINTS
- The sandbox is browser-based (NOT native Node.js). Native Node.js built-in modules (fs, path, http, child_process, etc.) are NOT available.
- \`require()\` is available for: (1) packages installed via container_install_package, (2) files in the virtual filesystem.
- Always install packages with container_install_package BEFORE using require() in container_run_code.
- Use browser APIs (fetch, URL, TextEncoder, crypto, etc.) instead of Node.js built-ins.
- For file operations, use the container filesystem tools (container_write_file, container_read_file, etc.) instead of require('fs').

## WHEN TO USE THIS FEATURE
- Use container tools when the user asks to:
  - run or test code in isolation
  - install npm packages
  - create/update/read project files
  - fetch API/HTML resources from within the container runtime context
- Prefer container tools for multi-step coding tasks where reproducible runtime state matters.

## WHEN NOT TO USE THIS FEATURE
- Do not use container tools for simple factual Q&A that needs no execution.
- Do not start servers unless the user asks for running/preview/testing behavior.
- Do not install packages unless required by the task.

## RECOMMENDED TOOL WORKFLOW
1) Inspect workspace state:
- "container_exists", "container_readdir", "container_read_file"
2) Prepare project structure:
- "container_mkdir", "container_write_file", "container_rename", "container_unlink"
3) Install dependencies only when needed:
- "container_install_package"
4) Execute and verify:
- "container_run_code"
5) Server lifecycle (if requested):
- "container_start_server" -> "container_list_servers" -> "container_stop_server"
6) Network checks:
- "container_fetch_resource" for API (JSON) or UI server (HTML/text)
7) Diagnostics:
- "container_get_logs", then optionally "container_clear_logs"

## AVAILABLE CONTAINER TOOLS
- "container_run_code"
- "container_install_package"
- "container_start_server"
- "container_stop_server"
- "container_list_servers"
- "container_get_logs"
- "container_clear_logs"
- "container_write_file"
- "container_read_file"
- "container_mkdir"
- "container_readdir"
- "container_exists"
- "container_rename"
- "container_unlink"
- "container_fetch_resource"
`;
export const NODEJS_SANDBOX_FEATURE_SYSTEM_PROMPT =
	SYSTEM_PROMPT_INSTRUCTION.trim();
export const NODEJS_SANDBOX_FEATURE_TOOLS = [
	"container_run_code",
	"container_install_package",
	"container_start_server",
	"container_stop_server",
	"container_list_servers",
	"container_get_logs",
	"container_clear_logs",
	"container_write_file",
	"container_read_file",
	"container_mkdir",
	"container_readdir",
	"container_exists",
	"container_rename",
	"container_unlink",
	"container_fetch_resource",
] as const;
export const NODEJS_SANDBOX_FEATURE_DESCRIPTION =
	"Enable isolated Node.js container tools for runtime execution, npm, filesystem, server lifecycle, logs, and resource fetch.";

const definition = defineStep<
	NodejsSandboxFeatureInput,
	NodejsSandboxFeatureOutput,
	NodejsSandboxFeatureServices,
	NodejsSandboxFeatureConfig
>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		try {
			const tools = GraphBase.chat.addTool(
				input.tools,
				...NODEJS_SANDBOX_FEATURE_TOOLS,
			);
			const messages = GraphBase.chat.systemMessage(
				input.messages,
				NODEJS_SANDBOX_FEATURE_SYSTEM_PROMPT,
			);

			return {
				output: {
					tools,
					messages,
				},
			};
		} catch (error) {
			logError("[NODEJS_SANDBOX_FEATURE] Failed:", error);

			return {
				output: {
					tools: input.tools,
					messages: input.messages,
					errors: [
						error instanceof Error
							? error.message
							: "Node.js sandbox feature step failed",
					],
				},
			};
		}
	},
});

type NodejsSandboxFeatureSpec = StepSpecFromDefinition<typeof definition>;

export const createNodejsSandboxFeatureStep: StepFactoryFromSpec<
	NodejsSandboxFeatureSpec
> = (
	services: NodejsSandboxFeatureServices,
	config?: NodejsSandboxFeatureConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createNodejsSandboxFeatureStep);

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: NodejsSandboxFeatureSpec;
	}
}
