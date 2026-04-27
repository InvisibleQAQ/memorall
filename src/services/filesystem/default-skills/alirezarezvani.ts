import type { DefaultSkillManifestEntry } from "./types";

export const ALIREZAREZVANI_DEFAULT_SKILLS: DefaultSkillManifestEntry[] = [
	{
		name: "focused-fix",
		description:
			"Use when the user asks to fix, debug, or make a specific feature, module, or area work end-to-end. This skill is for systematic deep-dive repair across all files and dependencies, not quick single-bug fixes.",
		publisher: "Alireza Rezvani",
		collection: "engineering",
		repo: "alirezarezvani/claude-skills",
		sourceUrl:
			"https://github.com/alirezarezvani/claude-skills/blob/main/engineering/focused-fix/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/focused-fix/SKILL.md",
	},
	{
		name: "code-tour",
		description:
			"Use when the user asks to create a CodeTour .tour file: onboarding tours, architecture tours, PR review tours, RCA tours, contributor guides, or any structured code walkthrough that links to real files and line numbers.",
		publisher: "Alireza Rezvani",
		collection: "engineering",
		repo: "alirezarezvani/claude-skills",
		sourceUrl:
			"https://github.com/alirezarezvani/claude-skills/blob/main/engineering/code-tour/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/code-tour/SKILL.md",
	},
	{
		name: "pr-review-expert",
		description:
			"Use when the user asks to review pull requests, analyze code changes, check for security issues in PRs, or assess code quality of diffs.",
		publisher: "Alireza Rezvani",
		collection: "engineering",
		repo: "alirezarezvani/claude-skills",
		sourceUrl:
			"https://github.com/alirezarezvani/claude-skills/blob/main/engineering/pr-review-expert/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/pr-review-expert/SKILL.md",
	},
	{
		name: "meeting-analyzer",
		description:
			"Analyzes meeting transcripts and recordings to surface behavioral patterns, communication anti-patterns, and actionable coaching feedback. Use for meeting transcript review, speaking ratio analysis, filler words, conflict avoidance, and communication habits over time.",
		publisher: "Alireza Rezvani",
		collection: "project-management",
		repo: "alirezarezvani/claude-skills",
		sourceUrl:
			"https://github.com/alirezarezvani/claude-skills/blob/main/project-management/meeting-analyzer/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/project-management/meeting-analyzer/SKILL.md",
	},
	{
		name: "behuman",
		description:
			"Use when the user wants more human-like AI responses: less robotic, less list-heavy, and more authentic. This is for conversational or emotionally charged exchanges, not technical questions, code generation, or factual lookups.",
		publisher: "Alireza Rezvani",
		collection: "engineering",
		repo: "alirezarezvani/claude-skills",
		sourceUrl:
			"https://github.com/alirezarezvani/claude-skills/blob/main/engineering/behuman/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/behuman/SKILL.md",
	},
];
