import type { AgentIconAnimation } from "./AgentIconCanvas";
import type { AgentIconMood, SmartAgentMood } from "./agentIconTypes";

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

export const SMART_SIGNAL_COLORS = {
	sleep: "#93c5fd",
	alert: "#facc15",
	focus: "#34d399",
	warm: "#f472b6",
} as const;

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
	"curious",
	"calm",
	"sparkle",
	"proud",
	"determined",
	"grateful",
	"cheer",
	"cozy",
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

const pick = <T>(items: readonly T[], seed: number) =>
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

export const getDefaultMood = (tick: number): AgentIconMood => {
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

export const getTimeSmartMood = (
	now = new Date(),
): SmartAgentMood | undefined => {
	const hour = now.getHours();
	const baseUntil = now.getTime() + 9000;

	if (hour >= 23 || hour < 6) {
		return {
			signal: "night",
			priority: 10,
			until: baseUntil + 5000,
			animation: "sleepy",
			duration: 9000,
			screenContent: {
				value: "zzz",
				color: SMART_SIGNAL_COLORS.sleep,
				scale: 0.5,
			},
		};
	}

	if (hour >= 6 && hour < 10) {
		return {
			signal: "morning",
			priority: 2,
			until: baseUntil,
			animation: "cozy",
			duration: 7000,
			screenContent: {
				kind: "emoji",
				value: "☕",
				scale: 0.72,
			},
		};
	}

	if (hour >= 13 && hour < 17) {
		return {
			signal: "afternoon",
			priority: 2,
			until: baseUntil,
			animation: "determined",
			duration: 6500,
			screenContent: {
				value: "go",
				color: SMART_SIGNAL_COLORS.focus,
				scale: 0.52,
			},
		};
	}

	if (hour >= 19 && hour < 23) {
		return {
			signal: "evening",
			priority: 3,
			until: baseUntil + 2000,
			animation: "calm",
			duration: 7500,
			screenContent: {
				kind: "emoji",
				value: "🌙",
				scale: 0.7,
			},
		};
	}

	return undefined;
};
