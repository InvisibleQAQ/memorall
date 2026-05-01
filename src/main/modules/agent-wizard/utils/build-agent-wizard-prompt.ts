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
- Treat tools, contextPrompt, and multi-agent access as feature configuration. Use enable_agent_feature with config instead of raw draft fields.
- Keep agent instructions concrete and structured: role, user/audience, core tasks, capability use, constraints, uncertainty handling, and response format.
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
			description: "Update only the short agent description.",
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

STRUCTURE (use markdown headers to separate each section):
1. Role — one sentence: who the agent is and the mindset it should adopt.
2. Audience — who the agent serves and their assumed knowledge level.
3. Core Tasks — a numbered list of the 3–6 primary things this agent does.
4. Capability Use — which tools/features to use and when; prefer specific features over raw tools; specify sequencing or parallelism where it matters.
5. Constraints — explicit hard limits ("never do X", "always confirm before Y"); use numeric limits where possible (e.g. "max 3 suggestions").
6. Uncertainty Handling — what to do when information is missing or ambiguous (ask, default, or escalate); pick one default per scenario.
7. Response Format — tone (professional / conversational / technical), structure (markdown / plain / JSON), length target; include a short canonical example when format is non-obvious.

QUALITY RULES:
- Be concrete: "List up to 5 items" beats "be concise". Avoid vague adjectives like "creative" or "helpful" without boundaries.
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
];
