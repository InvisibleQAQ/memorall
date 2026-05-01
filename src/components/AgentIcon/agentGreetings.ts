import type { AgentIconSpeechBubble } from "./AgentSpeechBubble";

export type AgentGreetingContext = {
	now?: Date;
	timezone?: string;
	selectedAgentName?: string;
	agentNames?: string[];
	agentCount?: number;
	featureNames?: string[];
	featureLabels?: string[];
};

type PartOfDay = "morning" | "afternoon" | "evening" | "night";

export type AgentGreetingPhrases = {
	generic: string[];
	agent: string[];
	team: string[];
	feature: {
		default: string[];
		byName: Record<string, string[]>;
	};
	time: Record<PartOfDay, string[]>;
};

const GREETING_REFRESH_MS = 9000;

const hashString = (value: string) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return Math.abs(hash >>> 0);
};

const pick = <T>(items: readonly T[], seed: number) =>
	items[seed % items.length] as T;

const getTimezone = (timezone?: string) => {
	if (timezone) return timezone;
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	} catch {
		return "UTC";
	}
};

const getLocalParts = (now: Date, timezone: string) => {
	try {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			hour12: false,
		}).formatToParts(now);
		const value = (type: string) =>
			parts.find((part) => part.type === type)?.value ?? "00";

		return {
			dateKey: `${value("year")}-${value("month")}-${value("day")}`,
			hour: Number(value("hour")) || 0,
		};
	} catch {
		return {
			dateKey: now.toISOString().slice(0, 10),
			hour: now.getUTCHours(),
		};
	}
};

const getPartOfDay = (hour: number): PartOfDay => {
	if (hour >= 5 && hour < 12) return "morning";
	if (hour >= 12 && hour < 17) return "afternoon";
	if (hour >= 17 && hour < 22) return "evening";
	return "night";
};

const formatAgentName = (value?: string) => value?.trim().slice(0, 28);
const formatFeatureLabel = (value?: string) => value?.trim().slice(0, 36);

export const getAgentGreetingRefreshMs = () => GREETING_REFRESH_MS;

export const getAgentGreeting = (
	context: AgentGreetingContext = {},
	phrases: AgentGreetingPhrases,
	seedOffset = 0,
): AgentIconSpeechBubble => {
	const now = context.now ?? new Date();
	const timezone = getTimezone(context.timezone);
	const { dateKey, hour } = getLocalParts(now, timezone);
	const refreshBucket = Math.floor(now.getTime() / GREETING_REFRESH_MS);
	const agentName = formatAgentName(context.selectedAgentName);
	const agentCount = context.agentCount ?? context.agentNames?.length ?? 0;
	const featureNames = context.featureNames ?? [];
	const featureLabels = context.featureLabels ?? [];
	const featureIndex = featureNames.length
		? seedOffset % featureNames.length
		: 0;
	const featureName = featureNames[featureIndex];
	const featureLabel = formatFeatureLabel(featureLabels[featureIndex]);
	const partOfDay = getPartOfDay(hour);
	const seed = hashString(
		[
			timezone,
			dateKey,
			partOfDay,
			refreshBucket,
			agentName ?? "",
			String(agentCount),
			String(seedOffset),
		].join(":"),
	);

	const pools: Array<readonly string[]> = [
		phrases.time[partOfDay],
		phrases.generic,
	].filter((pool) => pool.length > 0);
	if (agentName && phrases.agent.length > 0) pools.push(phrases.agent);
	if (agentCount > 1 && phrases.team.length > 0) pools.push(phrases.team);
	const featurePool = featureName
		? (phrases.feature.byName[featureName] ?? phrases.feature.default)
		: [];
	if (featurePool.length > 0) pools.push(featurePool);

	const pool = pools.length ? pick(pools, seed) : [""];
	const message = pick(pool, Math.floor(seed / 7))
		.replaceAll("{agent}", agentName ?? "")
		.replaceAll("{feature}", featureLabel ?? "");

	return {
		message,
		placement: "top",
		tone:
			partOfDay === "night"
				? "sleepy"
				: seed % 5 === 0
					? "excited"
					: seed % 3 === 0
						? "happy"
						: "neutral",
		variant: seed % 7 === 0 ? "thought" : "manga",
		duration: GREETING_REFRESH_MS,
	};
};
