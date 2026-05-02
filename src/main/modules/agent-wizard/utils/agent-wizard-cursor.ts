import { jumpTo, jumTo, moveTo } from "@/components/AgentCursor";

export const AGENT_WIZARD_CURSOR_KEYS = {
	name: "agent-wizard:name",
	description: "agent-wizard:description",
	iconScreen: "agent-wizard:icon-screen",
	status: "agent-wizard:status",
	graphType: "agent-wizard:graph-type",
	systemPrompt: "agent-wizard:system-prompt",
	contextPrompt: "agent-wizard:context-prompt",
	features: "agent-wizard:features",
	tools: "agent-wizard:tools",
	skills: "agent-wizard:skills",
	mcpServers: "agent-wizard:mcp-servers",
	multiAgent: "agent-wizard:multi-agent",
	cronJobs: "agent-wizard:cron-jobs",
	growType: "agent-wizard:grow-type",
	recallType: "agent-wizard:recall-type",
	templates: "agent-wizard:templates",
	template: (id: string) => `agent-wizard:template:${id}`,
	feature: (name: string) => `agent-wizard:feature:${name}`,
	skill: (name: string) => `agent-wizard:skill:${name}`,
	cronJob: (id: string) => `agent-wizard:cron-job:${id}`,
} as const;

export const moveAgentWizardCursorTo = (
	targetKey: string,
	message: string,
	mode: "moveTo" | "jumpTo" | "jumTo" = "moveTo",
): void => {
	moveTo(targetKey, message, mode);
};

export const jumpAgentWizardCursorTo = (
	targetKey: string,
	message: string,
): void => {
	jumpTo(targetKey, message);
};

export const jumAgentWizardCursorTo = (
	targetKey: string,
	message: string,
): void => {
	jumTo(targetKey, message);
};
