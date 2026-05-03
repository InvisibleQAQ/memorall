import type { AgentIconAnimation, AgentScreenContent } from "./AgentIconCanvas";

export type AgentIconMood = {
	animation: AgentIconAnimation;
	screenContent?: AgentScreenContent;
	duration: number;
};

export type SmartAgentSignal =
	| "night"
	| "idle"
	| "near"
	| "shake"
	| "typing"
	| "return"
	| "focus"
	| "morning"
	| "afternoon"
	| "evening";

export type SmartAgentMood = AgentIconMood & {
	signal: SmartAgentSignal;
	priority: number;
	until: number;
};
