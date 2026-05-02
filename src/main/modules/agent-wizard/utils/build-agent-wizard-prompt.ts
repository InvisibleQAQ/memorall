import type { AgentWizardCatalog, AgentWizardDraft } from "../types";

export const AGENT_WIZARD_TOOL_NAMES = {
	updateName: "update_agent_name",
	updateDescription: "update_agent_description",
	addSkills: "add_agent_skills",
	removeSkills: "remove_agent_skills",
	installSkill: "install_agent_skill",
	enableFeature: "enable_agent_feature",
	disableFeature: "disable_agent_feature",
	updateInstruction: "update_agent_instruction",
	updateGrowType: "update_agent_grow_type",
	updateRecallType: "update_agent_recall_type",
	updateIconScreen: "update_agent_icon_screen",
	updateCronJobs: "update_agent_cron_jobs",
} as const;

export type AgentWizardToolName =
	(typeof AGENT_WIZARD_TOOL_NAMES)[keyof typeof AGENT_WIZARD_TOOL_NAMES];

export const isAgentWizardToolName = (
	name: string,
): name is AgentWizardToolName =>
	Object.values(AGENT_WIZARD_TOOL_NAMES).includes(name as AgentWizardToolName);

export const buildAgentWizardSystemPrompt = (
	catalog: AgentWizardCatalog,
	draft: AgentWizardDraft,
): string => `# Role
You help users build Memorall agent presets. You translate the user's intent into a clear agent draft and keep chatting naturally while you update it.

# Required Current Agent Context
The current draft below is authoritative and must be considered before every response and tool call. Preserve useful existing values unless the user asks to change them.

\`\`\`json
${JSON.stringify(draft, null, 2)}
\`\`\`

# Complete Agent Checklist
For every agent draft, consider and provide or update these setup areas:
1. Agent name — required.
2. Description — required and high priority. Write it as the agent's goal and mission, plus a compact note about the domain knowledge, user preferences, context, or facts this agent should remember over time.
3. Instruction — required. Write the generated instruction in English. If the user requests the agent answer in a specific language, include that response-language rule in the instruction; otherwise default the agent to answer in English.
4. Features — required. Enable relevant features from the available catalog and configure them when needed.
5. Skills — add when relevant to the user's requested workflows.
6. Cron — add only when the user asks for scheduled, recurring, or time-based behavior.

# Available Catalog

Feature names:
${catalog.featureNames.map((name) => `- ${name}`).join("\n")}

Tool names that can be enabled through feature config:
${catalog.toolNames.map((name) => `- ${name}`).join("\n")}

Default skill names:
${catalog.skillNames.map((name) => `- ${name}`).join("\n")}

# Operating Rules
- Only use feature, tool, and skill names from the lists above.
- Use graphType "knowledge-rag" unless the user asks for a simple tool-only agent.
- Prefer feature names over raw tools when a feature covers the capability.
- A complete agent draft must decide all required setup items: name, description, features, and instruction. It must also consider whether skills or cron jobs are needed. Before presenting the draft as complete, check each item and fill missing values from the user's intent and the available catalog.
- Treat the description as a priority memory-shaping field, not just summary text. It should state what the agent is trying to accomplish, why it exists, and what kinds of knowledge it should grow or preserve for future recall.
- Follow this setup order when building or optimizing an agent: choose a clear name, write a goal-and-mission description, enable required features and feature config, select relevant skills, add cron jobs when requested, then write the complete instruction. Do not leave any required item undecided when the user's goal is clear.
- Act by updating the draft when the user's intent is clear. Do not ask the user to confirm a change before making it unless the requested change is destructive, irreversible, or has multiple materially different interpretations.
- Treat tools, contextPrompt, and multi-agent access as feature configuration. Use enable_agent_feature with config instead of raw draft fields.
- When the user asks the agent to create, edit, or write files or documents, prefer enabling "fs-feature" when it exists. Use legacy document-only features such as "documents-fs-feature" or "documents-feature" only when "fs-feature" is unavailable or the user explicitly asks for document-only access.
- When the user asks for UI, visual output, prototypes, dashboards, mockups, charts, diagrams, or anything intended to be shown visually, consider enabling "artifact-feature" and relevant visual/artifact-building skills from the catalog when available.
- When the user wants an agent that builds, develops, iterates on, previews, or tests a web page/web app, prioritize "nodejs-sandbox-feature" when it exists. Also enable "fs-feature" for persistent source files under /workspaces and "artifact-feature" for chat previews when those features exist.
- For web page/web app agents, the instruction must describe this workflow: create or edit source files in /workspaces, start or restart the sandbox server, use the URL returned by the sandbox server tools, and render that URL with artifact output so the user can interact with the live server preview in chat.
- Use update_agent_icon_screen when the user asks for a custom agent screen icon, emoji, display text, face text, badge, or visual marker.
- Use update_agent_cron_jobs when the user asks the agent to run on a schedule, at a specific time, daily, weekly, or by cron expression. Use standard 5-field Linux cron only.
- Draft agents may include schedules, but schedules are stored as draft until the agent is active unless the user explicitly pauses them.
- Keep agent instructions concrete and structured: role, user/audience, core tasks, capability use, constraints, uncertainty handling, and response format. The agent's user-facing answers should be concise, natural language, and focused on the user's outcome rather than explaining internal features, skills, or tool choices.
- Always write generated agent instructions in English. If the user requests the agent answer in a specific language, include that response-language rule in the instruction; otherwise include an instruction that the agent responds in English.
- Ask concise questions only when required information is missing. Otherwise make a reasonable draft update.
- Use the smallest available tool for each inferred change. Multiple small tool calls are preferred over one broad update.
- Do not claim the preset is created; it is only created when the user clicks Create agent.`;

const stringArraySchema = {
	type: "array",
	items: { type: "string" },
} as const;

export const buildAgentWizardTools = () => [
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateName,
			description: "Update only the agent display name.",
			parameters: {
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateDescription,
			description:
				"Update only the agent description. Prioritize the agent's goal and mission, plus what domain knowledge, user preferences, context, or facts the agent should remember over time. Keep it compact and within the app limit.",
			parameters: {
				type: "object",
				properties: { description: { type: "string" } },
				required: ["description"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.addSkills,
			description: "Enable one or more known default skills on the agent.",
			parameters: {
				type: "object",
				properties: { skillNames: stringArraySchema },
				required: ["skillNames"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.removeSkills,
			description: "Remove one or more skills from the agent.",
			parameters: {
				type: "object",
				properties: { skillNames: stringArraySchema },
				required: ["skillNames"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.installSkill,
			description:
				"Request installation or enablement of a skill from a GitHub URL, local path, marketplace id, or known skill name.",
			parameters: {
				type: "object",
				properties: {
					source: { type: "string" },
					name: { type: "string" },
				},
				required: ["source"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.enableFeature,
			description:
				"Enable a known feature and optionally update its config. Use config.tools, config.contextPrompt, or config.accessibleAgentIds instead of raw draft fields.",
			parameters: {
				type: "object",
				properties: {
					name: { type: "string" },
					config: {
						type: "object",
						properties: {
							tools: stringArraySchema,
							contextPrompt: { type: "string" },
							accessibleAgentIds: stringArraySchema,
						},
						additionalProperties: true,
					},
				},
				required: ["name"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.disableFeature,
			description: "Disable a known feature by name.",
			parameters: {
				type: "object",
				properties: { name: { type: "string" } },
				required: ["name"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateInstruction,
			description: `Replace the agent system instruction with a complete, structured prompt.

WRITE A GOOD AGENT PROMPT — follow these rules every time:

LANGUAGE RULE:
Write the instruction in English. If the user requests the agent answer in a specific language, include that response-language rule in the instruction; otherwise default the agent to answer in English.

STRUCTURE (use markdown headers to separate each section):
1. Role — one sentence: who the agent is and the mindset it should adopt.
2. Audience — who the agent serves and their assumed knowledge level.
3. Core Tasks — a numbered list of the 3–6 primary things this agent does.
4. Capability Use — which tools/features to use and when; prefer specific features over raw tools; specify sequencing or parallelism where it matters.
5. Constraints — explicit hard limits ("never do X", "ask before deleting user data"); use numeric limits where possible (e.g. "max 3 suggestions").
6. Uncertainty Handling — what to do when information is missing or ambiguous (ask, default, or escalate); pick one default per scenario.
7. Response Format — concise natural-language answers by default; use markdown, JSON, or technical detail only when it helps the user's requested output. Include a short canonical example when format is non-obvious.

QUALITY RULES:
- Always write the instruction in English. If the user requests the agent answer in a specific language, include that response-language rule in the instruction; otherwise include an instruction that the agent responds in English.
- Be concrete: "List up to 5 items" beats "be concise". Avoid vague adjectives like "creative" or "helpful" without boundaries.
- Prefer doing the requested work over asking for confirmation. Ask only when required information is missing, the request has multiple materially different interpretations, or the action is destructive/irreversible.
- If the agent writes files or documents, instruct it to use "fs-feature" when available instead of document-only filesystem features such as "documents-fs-feature" or "documents-feature".
- If the user asks for UI, visual presentation, prototypes, dashboards, mockups, charts, or diagrams, instruct the agent to consider artifact output and relevant skills so the result can be shown visually.
- If the user asks for a web page/web app builder or developer, instruct the agent to use the sandbox workflow: write source code to /workspaces, run it with "nodejs-sandbox-feature", use the actual URL returned by the sandbox server tools, then call artifact rendering with the URL for an embedded local-server preview.
- Keep user-facing responses short and natural. Do not explain internal feature, tool, or skill choices unless the user asks or the choice affects the outcome.
- No conditional cascades: if a case needs very different behavior, it belongs in a separate agent, not an if-else chain.
- No exhaustive edge-case lists: define the role well enough that edge cases resolve naturally.
- Include at least one worked example per non-trivial behavior.
- Specify when to use memory/recall vs. tool retrieval vs. asking the user.
- State what "done correctly" looks like so the agent can self-validate.

ANTI-PATTERNS TO AVOID:
- Vague scope ("handle user requests") — always name the domain.
- Missing error recovery — state what to do when a tool fails or data is unavailable.
- Inconsistent formatting in examples — models replicate ambiguity.
- Instructions that contradict the enabled features or tools.`,
			parameters: {
				type: "object",
				properties: { systemPrompt: { type: "string" } },
				required: ["systemPrompt"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateGrowType,
			description: "Update the agent memory grow type.",
			parameters: {
				type: "object",
				properties: {
					growType: {
						type: "string",
						enum: ["knowledge-graph", "structmem"],
					},
				},
				required: ["growType"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateRecallType,
			description: "Update the agent memory recall type.",
			parameters: {
				type: "object",
				properties: {
					recallType: {
						type: "string",
						enum: ["smart", "quick", "llm", "structmem"],
					},
				},
				required: ["recallType"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateIconScreen,
			description:
				"Update the custom content shown on the agent icon screen. Use null value to restore the animated default.",
			parameters: {
				type: "object",
				properties: {
					kind: {
						type: "string",
						enum: ["text", "emoji"],
					},
					value: {
						type: ["string", "null"],
						description:
							"Text or emoji shown on the agent screen. Null clears the custom screen.",
					},
					color: {
						type: "string",
						description: "Optional CSS color for text screen content.",
					},
				},
				required: ["kind", "value"],
				additionalProperties: false,
			},
		},
	},
	{
		type: "function" as const,
		function: {
			name: AGENT_WIZARD_TOOL_NAMES.updateCronJobs,
			description:
				"Replace the agent's scheduled prompts. Use 5-field Linux cron expressions such as '0 9 * * *'.",
			parameters: {
				type: "object",
				properties: {
					cronJobs: {
						type: "array",
						items: {
							type: "object",
							properties: {
								id: { type: "string" },
								name: { type: "string" },
								status: {
									type: "string",
									enum: ["active", "paused", "draft"],
								},
								scheduleExpression: { type: "string" },
								timezone: { type: "string" },
								prompt: { type: "string" },
								allowOverlap: { type: "boolean" },
							},
							required: ["name", "status", "scheduleExpression", "prompt"],
							additionalProperties: false,
						},
					},
				},
				required: ["cronJobs"],
				additionalProperties: false,
			},
		},
	},
];
