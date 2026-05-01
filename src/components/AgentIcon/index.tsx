import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	AgentIconCanvas,
	type AgentIconAnimation,
	type AgentIconCanvasProps,
	type AgentScreenContent,
} from "./AgentIconCanvas";
import {
	AgentSpeechBubble,
	type AgentIconSpeechBubble,
} from "./AgentSpeechBubble";
import {
	getAgentGreeting,
	getAgentGreetingRefreshMs,
	type AgentGreetingContext,
	type AgentGreetingPhrases,
} from "./agentGreetings";

type AgentIconMood = {
	animation: AgentIconAnimation;
	screenContent?: AgentScreenContent;
	duration: number;
};

export interface AgentIconProps
	extends Omit<AgentIconCanvasProps, "animation" | "screenContent"> {
	animation?: AgentIconAnimation;
	screenContent?: AgentScreenContent;
	reactive?: boolean;
	moods?: AgentIconMood[];
	speechBubble?: AgentIconSpeechBubble | string;
	autoGreeting?: boolean;
	greetingContext?: AgentGreetingContext;
}

const DEFAULT_EMOJI = [
	"✨",
	"💡",
	"⚡",
	"☕",
	"🌙",
	"☀️",
	"💭",
	"🎯",
	"🥰",
	"😊",
	"🌸",
	"🎀",
	"🍵",
	"🌈",
	"💫",
	"🦋",
	"🎵",
	"💝",
	"🐱",
	"🌺",
	"🎶",
	"💕",
	"🌟",
	"🍀",
	"🌻",
	"🎪",
	"🫧",
	"🐾",
	"🌼",
	"🎠",
];
const DEFAULT_TEXT = [
	"hi!",
	"hey!",
	"yay",
	"uwu",
	"heh",
	"ok!",
	"wow",
	"sure",
	"hmm",
	"omg",
	"^w^",
	"nya~",
	"lol",
	"eep",
	":3",
	"zzz",
	"run",
	"01",
	"HI",
	"OK",
	"bzz",
	"yes",
	"nah",
	"...",
	"on!",
];
const TEXT_COLORS = ["#facc15", "#f472b6", "#a78bfa", "#34d399", "#60a5fa"];
// weighted: calm moods appear more often, rare emotions less so
const DEFAULT_ANIMATIONS: AgentIconAnimation[] = [
	"idle",
	"idle",
	"blink",
	"blink",
	"look-around",
	"happy",
	"thinking",
	"talk",
	"wink",
	"shy",
	"excited",
	"scan",
	"loading",
	"love",
	"giggle",
	"surprised",
	"confused",
	"sleepy",
];

const getTimeSeed = () => {
	const now = new Date();
	return (
		now.getFullYear() * 1000000 +
		(now.getMonth() + 1) * 10000 +
		now.getDate() * 100 +
		now.getHours()
	);
};

const hashSeed = (value: number) => {
	let seed = value || 1;
	seed ^= seed << 13;
	seed ^= seed >> 17;
	seed ^= seed << 5;
	return Math.abs(seed);
};

const pick = <T,>(items: readonly T[], seed: number) =>
	items[seed % items.length] as T;

const animationDuration = (
	animation: AgentIconAnimation,
	seed: number,
): number => {
	switch (animation) {
		case "surprised":
			return 2600 + (seed % 1400);
		case "giggle":
			return 3000 + (seed % 1800);
		case "confused":
			return 3200 + (seed % 1800);
		case "wink":
			return 3500 + (seed % 1600);
		case "love":
			return 5200 + (seed % 2200);
		case "shy":
			return 4800 + (seed % 2200);
		case "sleepy":
			return 5500 + (seed % 2500);
		default:
			return 4200 + (seed % 2200);
	}
};

const getDefaultMood = (tick: number): AgentIconMood => {
	const seed = hashSeed(getTimeSeed() + tick * 17);
	const showText = seed % 5 === 0;
	const showEmoji = !showText && seed % 3 === 0;
	const animation = pick(DEFAULT_ANIMATIONS, seed);

	if (showText) {
		return {
			animation,
			duration: 5200 + (seed % 1800),
			screenContent: {
				value: pick(DEFAULT_TEXT, Math.floor(seed / 3)),
				color: pick(TEXT_COLORS, Math.floor(seed / 7)),
				scale: 0.52,
			},
		};
	}

	if (showEmoji) {
		return {
			animation,
			duration: 4800 + (seed % 2200),
			screenContent: {
				kind: "emoji",
				value: pick(DEFAULT_EMOJI, Math.floor(seed / 5)),
				scale: 0.72,
			},
		};
	}

	return {
		animation,
		duration: animationDuration(animation, seed),
	};
};

const usePrefersReducedMotion = () => {
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const handleChange = () => setPrefersReducedMotion(media.matches);
		handleChange();
		media.addEventListener("change", handleChange);
		return () => media.removeEventListener("change", handleChange);
	}, []);

	return prefersReducedMotion;
};

const toStringArray = (value: unknown): string[] =>
	Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];

export const AgentIcon: React.FC<AgentIconProps> = ({
	animation,
	screenContent,
	reactive = true,
	moods,
	speechBubble,
	autoGreeting = false,
	greetingContext,
	variant = "default",
	...props
}) => {
	const { t } = useTranslation("agents");
	const prefersReducedMotion = usePrefersReducedMotion();
	const [tick, setTick] = useState(0);
	const [greetingTick, setGreetingTick] = useState(0);
	const mood = useMemo(() => {
		if (moods?.length) {
			return moods[tick % moods.length] ?? moods[0];
		}

		return getDefaultMood(tick);
	}, [moods, tick]);

	useEffect(() => {
		if (!reactive || prefersReducedMotion || animation || screenContent) return;

		const timeout = window.setTimeout(() => {
			setTick((value) => value + 1);
		}, mood.duration);

		return () => window.clearTimeout(timeout);
	}, [animation, mood.duration, prefersReducedMotion, reactive, screenContent]);

	useEffect(() => {
		if (!autoGreeting || speechBubble) return;

		const timeout = window.setTimeout(() => {
			setGreetingTick((value) => value + 1);
		}, getAgentGreetingRefreshMs());

		return () => window.clearTimeout(timeout);
	}, [autoGreeting, greetingTick, speechBubble]);

	const greetingPhrases = useMemo<AgentGreetingPhrases>(
		() => ({
			generic: toStringArray(
				t("iconGreeting.generic", { returnObjects: true }),
			),
			agent: toStringArray(
				t("iconGreeting.agent", {
					agent: greetingContext?.selectedAgentName ?? "",
					returnObjects: true,
				}),
			),
			team: toStringArray(t("iconGreeting.team", { returnObjects: true })),
			feature: {
				default: toStringArray(
					t("iconGreeting.feature.default", { returnObjects: true }),
				),
				byName: {
					"knowledge-retrieval": toStringArray(
						t("iconGreeting.feature.knowledgeRetrieval", {
							returnObjects: true,
						}),
					),
					"context-smart-retrieve": toStringArray(
						t("iconGreeting.feature.knowledgeRetrieval", {
							returnObjects: true,
						}),
					),
					"context-quick-retrieve": toStringArray(
						t("iconGreeting.feature.knowledgeRetrieval", {
							returnObjects: true,
						}),
					),
					"context-llm-retrieve": toStringArray(
						t("iconGreeting.feature.knowledgeRetrieval", {
							returnObjects: true,
						}),
					),
					"structmem-retrieval": toStringArray(
						t("iconGreeting.feature.knowledgeRetrieval", {
							returnObjects: true,
						}),
					),
					"entities-facts-citation": toStringArray(
						t("iconGreeting.feature.citations", { returnObjects: true }),
					),
					citations: toStringArray(
						t("iconGreeting.feature.citations", { returnObjects: true }),
					),
					"multi-agent-feature": toStringArray(
						t("iconGreeting.feature.multiAgent", { returnObjects: true }),
					),
					"web-feature": toStringArray(
						t("iconGreeting.feature.web", { returnObjects: true }),
					),
					"artifact-feature": toStringArray(
						t("iconGreeting.feature.artifact", { returnObjects: true }),
					),
					"documents-feature": toStringArray(
						t("iconGreeting.feature.documents", { returnObjects: true }),
					),
					"documents-fs-feature": toStringArray(
						t("iconGreeting.feature.documentsFs", { returnObjects: true }),
					),
					"fs-feature": toStringArray(
						t("iconGreeting.feature.fileSystem", { returnObjects: true }),
					),
					"daily-briefing-feature": toStringArray(
						t("iconGreeting.feature.dailyBriefing", { returnObjects: true }),
					),
					"finance-tracker-feature": toStringArray(
						t("iconGreeting.feature.financeTracker", {
							returnObjects: true,
						}),
					),
					"job-application-feature": toStringArray(
						t("iconGreeting.feature.jobApplication", {
							returnObjects: true,
						}),
					),
					"language-tutor-feature": toStringArray(
						t("iconGreeting.feature.languageTutor", {
							returnObjects: true,
						}),
					),
					"mcp-feature": toStringArray(
						t("iconGreeting.feature.mcp", { returnObjects: true }),
					),
					"meal-planner-feature": toStringArray(
						t("iconGreeting.feature.mealPlanner", { returnObjects: true }),
					),
					"news-collection-feature": toStringArray(
						t("iconGreeting.feature.newsCollection", {
							returnObjects: true,
						}),
					),
					"nodejs-sandbox-feature": toStringArray(
						t("iconGreeting.feature.nodejsSandbox", {
							returnObjects: true,
						}),
					),
					"planner-feature": toStringArray(
						t("iconGreeting.feature.planner", { returnObjects: true }),
					),
					"shopping-assistant-feature": toStringArray(
						t("iconGreeting.feature.shoppingAssistant", {
							returnObjects: true,
						}),
					),
					"travel-planner-feature": toStringArray(
						t("iconGreeting.feature.travelPlanner", {
							returnObjects: true,
						}),
					),
					"entity-extraction": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"entity-resolution": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"fact-extraction": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"fact-extraction-v2": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"fact-resolution": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"knowledge-database-save": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"edge-enrichment": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"temporal-extraction": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"load-entities": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
					"load-facts": toStringArray(
						t("iconGreeting.feature.knowledgeGrow", {
							returnObjects: true,
						}),
					),
				},
			},
			time: {
				morning: toStringArray(
					t("iconGreeting.time.morning", { returnObjects: true }),
				),
				afternoon: toStringArray(
					t("iconGreeting.time.afternoon", { returnObjects: true }),
				),
				evening: toStringArray(
					t("iconGreeting.time.evening", { returnObjects: true }),
				),
				night: toStringArray(
					t("iconGreeting.time.night", { returnObjects: true }),
				),
			},
		}),
		[t, greetingContext?.selectedAgentName],
	);

	const resolvedSpeechBubble = useMemo(() => {
		if (typeof speechBubble === "string") {
			return { message: speechBubble } satisfies AgentIconSpeechBubble;
		}

		if (speechBubble) return speechBubble;
		if (!autoGreeting) return undefined;

		return getAgentGreeting(greetingContext, greetingPhrases, greetingTick);
	}, [
		autoGreeting,
		greetingContext,
		greetingPhrases,
		greetingTick,
		speechBubble,
	]);

	const canvas = (
		<AgentIconCanvas
			{...props}
			animation={animation ?? mood.animation}
			screenContent={screenContent ?? mood.screenContent}
			variant={variant}
		/>
	);

	if (!resolvedSpeechBubble) return canvas;

	return (
		<span className="relative inline-flex items-center justify-center overflow-visible align-middle">
			{canvas}
			<AgentSpeechBubble
				bubble={resolvedSpeechBubble}
				reducedMotion={prefersReducedMotion}
			/>
		</span>
	);
};

export type {
	AgentGreetingContext,
	AgentGreetingPhrases,
	AgentIconAnimation,
	AgentIconSpeechBubble,
	AgentScreenContent,
};
