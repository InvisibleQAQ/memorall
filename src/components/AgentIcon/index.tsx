import React, { useEffect, useMemo, useState } from "react";
import {
	AgentIconCanvas,
	type AgentIconAnimation,
	type AgentIconCanvasProps,
	type AgentScreenContent,
} from "./AgentIconCanvas";

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

export const AgentIcon: React.FC<AgentIconProps> = ({
	animation,
	screenContent,
	reactive = true,
	moods,
	variant = "default",
	...props
}) => {
	const prefersReducedMotion = usePrefersReducedMotion();
	const [tick, setTick] = useState(0);
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

	return (
		<AgentIconCanvas
			{...props}
			animation={animation ?? mood.animation}
			screenContent={screenContent ?? mood.screenContent}
			variant={variant}
		/>
	);
};

export type { AgentIconAnimation, AgentScreenContent };
