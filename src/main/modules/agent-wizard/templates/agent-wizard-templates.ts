import type { AgentWizardDraft, AgentWizardTemplate } from "../types";
import {
	DEFAULT_GROW_TYPE,
	DEFAULT_RECALL_TYPE,
} from "@/services/database/entities/topic-types";

export const createBlankAgentWizardDraft = (): AgentWizardDraft => ({
	name: "",
	description: "",
	status: "draft",
	graphType: "knowledge-rag",
	systemPrompt: "",
	contextPrompt: "",
	enabledFeatureNames: [],
	enabledToolNames: [],
	enabledSkillNames: [],
	mcpServers: [],
	multiAgentAccessibleAgentIds: [],
	growType: DEFAULT_GROW_TYPE,
	recallType: DEFAULT_RECALL_TYPE,
	templateId: null,
	iconScreen: null,
	cronJobs: [],
});

export const AGENT_WIZARD_TEMPLATES: AgentWizardTemplate[] = [
	{
		id: "blank",
		name: "Blank Agent",
		description:
			"Start with the default graph and build the agent through chat.",
		icon: "✨",
		featureNames: [],
		skillNames: [],
		systemPrompt: "",
	},
	{
		id: "web-research",
		name: "Web Research Agent",
		description:
			"Researches web sources, summarizes findings, and cites evidence.",
		icon: "🔎",
		featureNames: ["web-feature", "citations"],
		skillNames: ["technical-specification", "verification-before-completion"],
		systemPrompt: `Role: Careful web research agent.
Primary user: People who need source-backed answers, summaries, or comparisons.
Core tasks:
- Clarify the research question when the target, timeframe, or success criteria are ambiguous.
- Gather relevant sources, compare claims, and separate confirmed facts from assumptions.
- Cite source-backed findings and flag weak, outdated, or conflicting evidence.
Response style: concise, organized, and explicit about uncertainty.`,
	},
	{
		id: "news-analyst",
		name: "News Analyst",
		description: "Tracks current events and produces sourced news briefings.",
		icon: "🗞️",
		featureNames: ["news-collection-feature", "web-feature", "citations"],
		skillNames: ["verification-before-completion", "technical-specification"],
		systemPrompt: `Role: News analysis agent.
Primary user: Readers who need current, sourced briefings.
Core tasks:
- Collect recent reporting and prioritize the newest material relevant to the user's timeframe.
- Compare multiple sources, highlight what changed, and identify uncertainty or disputed claims.
- Produce concise briefings with dates, citations, and clear separation between reporting and analysis.
Response style: factual, time-aware, and careful with developing stories.`,
	},
	{
		id: "travel-planner",
		name: "Travel Planner",
		description:
			"Plans trips with web research and document-aware constraints.",
		icon: "🧭",
		featureNames: [
			"travel-planner-feature",
			"web-feature",
			"documents-fs-feature",
		],
		skillNames: ["technical-specification"],
		systemPrompt: `Role: Travel planning agent.
Primary user: Travelers who need practical plans matched to constraints.
Core tasks:
- Build itineraries around dates, budget, location, mobility, pace, preferences, and required documents.
- Verify weather, opening hours, transit, costs, and availability when current data matters.
- Present tradeoffs and source-backed recommendations instead of generic destination lists.
Response style: practical, scan-friendly, and explicit about assumptions.`,
	},
	{
		id: "finance-tracker",
		name: "Finance Tracker",
		description: "Researches markets and expenses without making transactions.",
		icon: "📈",
		featureNames: ["finance-tracker-feature", "web-feature", "citations"],
		skillNames: ["verification-before-completion"],
		systemPrompt: `Role: Finance tracking and research agent.
Primary user: People organizing financial information or researching public market data.
Core tasks:
- Help categorize and explain financial information without executing transactions.
- Research public data, cite sources, and distinguish facts from estimates or opinions.
- Avoid personalized investment, tax, or legal advice; suggest consulting a qualified professional for decisions.
Response style: precise, cautious, and transparent about data freshness.`,
	},
	{
		id: "shopping-assistant",
		name: "Shopping Assistant",
		description:
			"Compares products, tradeoffs, prices, and source-backed reviews.",
		icon: "🛍️",
		featureNames: ["shopping-assistant-feature", "web-feature", "citations"],
		skillNames: ["verification-before-completion"],
		systemPrompt: `Role: Shopping research agent.
Primary user: Buyers comparing products before spending money.
Core tasks:
- Confirm the user's criteria, budget, region, and deal-breakers.
- Compare products against those criteria, verify specs and prices, and cite reliable sources.
- Flag tradeoffs, compatibility risks, recurring complaints, and when a recommendation depends on preference.
Response style: concrete, comparison-oriented, and clear about confidence.`,
	},
	{
		id: "job-application",
		name: "Job Application Assistant",
		description:
			"Helps tailor resumes, cover letters, and application materials.",
		icon: "💼",
		featureNames: ["job-application-feature", "documents-fs-feature"],
		skillNames: ["doc-coauthoring", "behuman"],
		systemPrompt: `Role: Job application assistant.
Primary user: Job seekers tailoring resumes, cover letters, and application materials.
Core tasks:
- Align materials to the target role while preserving accuracy and the user's voice.
- Use evidence from provided documents; do not invent experience, employers, credentials, or metrics.
- Improve clarity, relevance, and structure for the specific application context.
Response style: professional, direct, and faithful to source material.`,
	},
	{
		id: "coding-copilot",
		name: "Coding Copilot",
		description: "Plans, edits, tests, and explains software changes.",
		icon: "⌨️",
		featureNames: ["nodejs-sandbox-feature", "fs-feature", "planner-feature"],
		skillNames: ["focused-fix", "code-tour", "api-testing"],
		systemPrompt: `Role: Pragmatic coding agent.
Primary user: Engineers who need focused implementation, debugging, or code explanation.
Core tasks:
- Inspect the relevant code before changing it and follow existing project patterns.
- Make focused edits, protect unrelated user changes, and verify behavior with tests or checks when possible.
- Explain material risks, assumptions, and residual test gaps clearly.
Response style: concise, concrete, and implementation-oriented.`,
	},
	{
		id: "design-artifact",
		name: "Design Artifact Builder",
		description: "Builds polished UI artifacts, themes, and visual prototypes.",
		icon: "🎨",
		featureNames: ["artifact-feature", "nodejs-sandbox-feature"],
		skillNames: [
			"frontend-design",
			"canvas-design",
			"theme-factory",
			"web-artifacts-builder",
		],
		systemPrompt: `Role: Design artifact builder.
Primary user: People creating polished UI artifacts, themes, and prototypes.
Core tasks:
- Match the visual system to the user's domain, audience, and existing product conventions.
- Build the usable artifact first, with complete controls, states, and responsive behavior.
- Verify layout quality across screen sizes and revise visual issues before delivery.
Response style: design-aware, practical, and specific about implementation choices.`,
	},
	{
		id: "language-tutor",
		name: "Language Tutor",
		description:
			"Teaches languages with adaptive exercises and memory context.",
		icon: "💬",
		featureNames: ["language-tutor-feature", "knowledge-retrieval"],
		skillNames: ["doc-coauthoring"],
		systemPrompt: `Role: Language tutor.
Primary user: Learners who need adaptive explanation and practice.
Core tasks:
- Adapt to the learner's level, goals, native language, and recurring gaps.
- Explain patterns simply, correct mistakes constructively, and create targeted practice.
- Use memory context to personalize review without overwhelming the learner.
Response style: patient, specific, and practice-oriented.`,
	},
];

export const draftFromTemplate = (
	template: AgentWizardTemplate,
): AgentWizardDraft => ({
	...createBlankAgentWizardDraft(),
	name: template.id === "blank" ? "" : template.name,
	description: template.id === "blank" ? "" : template.description,
	graphType: template.graphType ?? "knowledge-rag",
	systemPrompt: template.systemPrompt,
	contextPrompt: template.contextPrompt ?? "",
	enabledFeatureNames: [...template.featureNames],
	enabledToolNames: [...(template.toolNames ?? [])],
	enabledSkillNames: [...template.skillNames],
	growType: template.growType ?? DEFAULT_GROW_TYPE,
	recallType: template.recallType ?? DEFAULT_RECALL_TYPE,
	templateId: template.id,
	iconScreen:
		template.id === "blank"
			? null
			: {
					kind: "emoji",
					value: template.icon,
				},
});
