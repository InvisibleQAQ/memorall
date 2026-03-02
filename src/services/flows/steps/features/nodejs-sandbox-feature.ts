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
If user require to write code, execute code please use this actively to write and run code.

## IMPORTANT RUNTIME CONSTRAINTS
- The sandbox runs on almostnode in the browser (not OS Node.js), but it provides broad built-in API shims including \`fs\`, \`path\`, \`url\`, \`util\`, \`events\`, \`os\`, \`crypto\`, and more.
- \`require()\` is available for built-in shims, installed npm packages, and files in the virtual filesystem.
- \`require("fs")\` operates on the virtual filesystem.
- Filesystem mounts:
  - \`/documents\`: read-only mirror from document storage.
  - \`/workspaces\`: read/write persistent workspace backed by document filesystem workspace storage.
  - \`/temp\`: in-memory temporary files only.
- Always install packages with container_install_package BEFORE using require() in container_run_code.
- Use browser APIs (fetch, URL, TextEncoder, crypto, etc.) instead of Node.js built-ins.
- Prefer container filesystem tools (container_write_file, container_read_file, etc.) for deterministic file operations and mutations.
- Use \`/workspaces\` for files that should persist, and \`/temp\` for scratch artifacts.
- Never attempt writes under \`/documents\`.

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

## WORKSPACE INSPECTION RULE — MANDATORY BEFORE WRITING ANY CODE
**Always check \`/workspaces\` FIRST before writing files or scaffolding a new project.**

Steps:
1. \`container_readdir({ path: "/workspaces" })\` — list top-level workspace dirs.
2. If a relevant directory exists (e.g. \`/workspaces/todo-app\`), inspect it:
   \`container_readdir({ path: "/workspaces/<dir>" })\` and read key files
   (\`package.json\`, main entry, etc.) with \`container_read_file\`.
3. Only then decide what to create or modify:
   - **Files already exist** → read them, build on top, do NOT overwrite without reason.
   - **Partial project** → add only the missing files/code.
   - **Truly empty** → scaffold from scratch.

This prevents duplicate files, accidental overwrites, and redundant npm installs.

## RECOMMENDED TOOL WORKFLOW
1) **Inspect workspace state FIRST** (mandatory — see rule above):
- \`container_readdir({ path: "/workspaces" })\` then drill into any existing project dir
2) Prepare project structure (only what is missing):
- "container_mkdir", "container_write_file", "container_rename", "container_unlink"
3) Install dependencies only when needed:
- "container_install_package"
4) Execute and verify:
- "container_run_code"
5) Quick server setup — scaffold + install + start + preview in ONE call:
- "container_setup_server" with template="vite-react"|"next-pages"|"next-app"|"express"
  Use this whenever the user asks to create/run a new app from scratch.
  It automatically scaffolds files, installs packages, starts the server, and returns an iframe preview.
6) Manual server lifecycle (when files already exist or custom setup needed):
- "container_start_server" -> "container_list_servers" -> "container_stop_server"
7) Show a running server's UI in chat (Vite, Next.js, HTML pages):
- "container_render_server" -> returns a render URL that appears as an iframe preview in the chat
8) Call a server API endpoint and show the response:
- "container_request_server" -> returns structured HTTP response shown in chat
9) Network checks:
- "container_fetch_resource" for external API (JSON) or web URLs
10) Browser-like web access:
- "container_web_access" to access a URL and return URL + HTML for preview/simulation.
11) Diagnostics:
- "container_get_logs", then optionally "container_clear_logs"

## SERVER SETUP GUIDE

### When to use container_setup_server (preferred for new projects)
- User says: "create a React app", "make a Next.js app", "build an Express API", "start a Vite project"
- User says: "show me a running [framework] example"
- Starting fresh with no existing project files
- Single tool call → files scaffolded + packages installed + server running + iframe preview shown

### When to use container_start_server instead
- Project files already exist in the VFS (custom code already written)
- User asks to restart a stopped server
- Need fine-grained control over entryPath or hostname

### After the server is running
- UI app (Vite, Next.js): always call container_render_server to show the iframe preview
- API server (Express JSON routes): call container_request_server to fetch and display a response

### Template → framework mapping
| template      | kind    | default port | use case                    |
|---------------|---------|-------------|------------------------------|
| express       | express | 3000        | REST API, HTML pages         |
| vite-react    | vite    | 5173        | React SPA with HMR           |
| next-pages    | next    | 3000        | Next.js Pages Router         |
| next-app      | next    | 3000        | Next.js App Router           |
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
	"container_web_access",
	"container_render_server",
	"container_request_server",
	"container_setup_server",
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
