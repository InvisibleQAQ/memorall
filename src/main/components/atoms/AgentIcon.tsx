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

const DEFAULT_EMOJI = ["✨", "💡", "⚡", "☕", "🌙", "☀️", "💭", "🎯"];
const DEFAULT_TEXT = ["Agent", "OK", "01", "HI"];
const DEFAULT_ANIMATIONS: AgentIconAnimation[] = [
	"idle",
	"blink",
	"look-around",
	"happy",
	"thinking",
	"excited",
	"scan",
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
				color: "#facc15",
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
		duration: 4200 + (seed % 2200),
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
