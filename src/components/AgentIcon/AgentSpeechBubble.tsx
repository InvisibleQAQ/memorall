import React from "react";
import { cn } from "@/lib/utils";

export type AgentSpeechBubblePlacement = "top" | "right" | "bottom" | "left";
export type AgentSpeechBubbleVariant = "manga" | "thought" | "caption";

export type AgentIconSpeechBubble = {
	message: string;
	renderContent?: React.ReactNode;
	tone?: "neutral" | "happy" | "thinking" | "sleepy" | "excited";
	placement?: AgentSpeechBubblePlacement;
	duration?: number;
	variant?: AgentSpeechBubbleVariant;
};

interface AgentSpeechBubbleProps {
	bubble: AgentIconSpeechBubble;
	reducedMotion?: boolean;
}

const BUBBLE_PLACEMENT_CLASS: Record<AgentSpeechBubblePlacement, string> = {
	top: "bottom-full left-1/2 mb-3 -translate-x-1/2",
	right: "left-full top-1/2 ml-3 -translate-y-1/2",
	bottom: "left-1/2 top-full mt-3 -translate-x-1/2",
	left: "right-full top-1/2 mr-3 -translate-y-1/2",
};

const TAIL_PLACEMENT_CLASS: Record<AgentSpeechBubblePlacement, string> = {
	top: "left-1/2 top-full -mt-px -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-white",
	right:
		"right-full top-1/2 -mr-px -translate-y-1/2 border-l-transparent border-t-transparent border-b-transparent border-r-white",
	bottom:
		"bottom-full left-1/2 -mb-px -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-white",
	left: "left-full top-1/2 -ml-px -translate-y-1/2 border-r-transparent border-t-transparent border-b-transparent border-l-white",
};

const THOUGHT_DOT_PRIMARY_CLASS: Record<AgentSpeechBubblePlacement, string> = {
	top: "left-[58%] top-full mt-1 -translate-x-1/2",
	right: "right-full top-[58%] mr-1 -translate-y-1/2",
	bottom: "bottom-full left-[58%] mb-1 -translate-x-1/2",
	left: "left-full top-[58%] ml-1 -translate-y-1/2",
};

const THOUGHT_DOT_SECONDARY_CLASS: Record<AgentSpeechBubblePlacement, string> =
	{
		top: "left-[64%] top-full mt-[18px] -translate-x-1/2",
		right: "right-full top-[64%] mr-[18px] -translate-y-1/2",
		bottom: "bottom-full left-[64%] mb-[18px] -translate-x-1/2",
		left: "left-full top-[64%] ml-[18px] -translate-y-1/2",
	};

const VARIANT_CLASS: Record<AgentSpeechBubbleVariant, string> = {
	manga: "rounded-[1.15rem]",
	thought: "rounded-[1.5rem]",
	caption: "rounded-md",
};

const TONE_CLASS: Record<NonNullable<AgentIconSpeechBubble["tone"]>, string> = {
	neutral: "",
	happy: "[--agent-bubble-rotate:-1deg]",
	thinking: "[--agent-bubble-rotate:1deg]",
	sleepy: "opacity-90",
	excited: "[--agent-bubble-rotate:-2deg] [--agent-bubble-scale:1.02]",
};

export const AgentSpeechBubble: React.FC<AgentSpeechBubbleProps> = ({
	bubble,
	reducedMotion,
}) => {
	const message = bubble.message.trim();
	if (!message) return null;

	const placement = bubble.placement ?? "top";
	const variant = bubble.variant ?? "manga";
	const tone = bubble.tone ?? "neutral";
	const isThought = variant === "thought";
	const characterCount = Math.max(message.length, 1);
	const hasCustomContent = Boolean(bubble.renderContent);
	const shouldTypewrite =
		!hasCustomContent && !reducedMotion && characterCount <= 36;

	return (
		<div
			className={cn(
				"pointer-events-none absolute z-10 w-max max-w-[min(14rem,calc(100vw-2rem))]",
				BUBBLE_PLACEMENT_CLASS[placement],
			)}
			role="status"
			aria-live="polite"
		>
			<div
				className={cn(
					"relative bg-white px-3 py-2 text-center text-xs font-semibold leading-snug text-slate-950 shadow-[3px_3px_0_rgba(15,23,42,0.2)]",
					"[--agent-bubble-rotate:0deg] [--agent-bubble-scale:1]",
					"after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-[0.08] after:content-['']",
					"after:bg-[radial-gradient(circle_at_center,#000_0_1px,transparent_1px)] after:[background-size:6px_6px]",
					VARIANT_CLASS[variant],
					TONE_CLASS[tone],
					!reducedMotion &&
						"agent-speech-bubble-motion animate-in fade-in zoom-in-95 duration-200",
				)}
			>
				{hasCustomContent ? (
					<div className="agent-speech-bubble-content relative z-[1] text-left">
						{bubble.renderContent}
					</div>
				) : (
					<span
						key={message}
						className={cn(
							"relative z-[1] inline-block max-w-[12rem] align-bottom",
							shouldTypewrite
								? "overflow-hidden whitespace-nowrap pr-1 agent-speech-bubble-type"
								: "whitespace-normal break-words",
						)}
						style={
							{
								"--agent-bubble-characters": characterCount,
							} as React.CSSProperties
						}
					>
						{message}
					</span>
				)}
				{isThought ? (
					<>
						<span
							className={cn(
								"absolute h-4 w-4 rounded-full bg-white shadow-[2px_2px_0_rgba(15,23,42,0.16)]",
								THOUGHT_DOT_PRIMARY_CLASS[placement],
							)}
						/>
						<span
							className={cn(
								"absolute h-2.5 w-2.5 rounded-full bg-white shadow-[1px_1px_0_rgba(15,23,42,0.14)]",
								THOUGHT_DOT_SECONDARY_CLASS[placement],
							)}
						/>
					</>
				) : (
					<span
						className={cn(
							"agent-speech-bubble-tail absolute h-0 w-0 border-[14px] drop-shadow-[2px_2px_0_rgba(15,23,42,0.16)]",
							TAIL_PLACEMENT_CLASS[placement],
						)}
					/>
				)}
			</div>
		</div>
	);
};
