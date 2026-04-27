import type { DefaultSkillManifestEntry } from "./types";

export const ANTHROPIC_DEFAULT_SKILLS: DefaultSkillManifestEntry[] = [
	{
		name: "algorithmic-art",
		description:
			"Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/algorithmic-art/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/algorithmic-art/SKILL.md",
	},
	{
		name: "brand-guidelines",
		description:
			"Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/brand-guidelines/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/brand-guidelines/SKILL.md",
	},
	{
		name: "canvas-design",
		description:
			"Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/canvas-design/SKILL.md",
	},
	{
		name: "claude-api",
		description:
			"Build, debug, and optimize Claude API and Anthropic SDK apps, including prompt caching and model migrations. Trigger when code imports the Anthropic SDK or when the user asks about Claude API features, managed agents, thinking, tool use, files, citations, or memory.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/claude-api/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/claude-api/SKILL.md",
	},
	{
		name: "doc-coauthoring",
		description:
			"Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/doc-coauthoring/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/doc-coauthoring/SKILL.md",
	},
	{
		name: "frontend-design",
		description:
			"Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications and wants polished UI instead of generic AI aesthetics.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md",
	},
	{
		name: "internal-comms",
		description:
			"A set of resources to help write internal communications in company-style formats. Use for status reports, leadership updates, project updates, incident reports, newsletters, FAQs, and similar communication tasks.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/internal-comms/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/internal-comms/SKILL.md",
	},
	{
		name: "theme-factory",
		description:
			"Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reports, or HTML pages. It includes preset themes with colors and fonts and can also generate a new theme on the fly.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/theme-factory/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/theme-factory/SKILL.md",
	},
	{
		name: "web-artifacts-builder",
		description:
			"Suite of tools for creating elaborate HTML artifacts using React, Tailwind CSS, and shadcn/ui. Use for complex artifacts requiring state management, routing, or component systems rather than simple single-file HTML.",
		publisher: "Anthropic",
		collection: "anthropics/skills examples",
		repo: "anthropics/skills",
		sourceUrl:
			"https://github.com/anthropics/skills/blob/main/skills/web-artifacts-builder/SKILL.md",
		rawUrl:
			"https://raw.githubusercontent.com/anthropics/skills/main/skills/web-artifacts-builder/SKILL.md",
	},
];
