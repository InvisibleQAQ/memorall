import React from "react";
import { motion } from "motion/react";
import {
	AgentIcon,
	type AgentIconAnimation,
	type AgentScreenContent,
} from "@/components/AgentIcon";
import { cn } from "@/lib/utils";

interface AgentCursorPointerProps {
	className?: string;
}

export interface AgentCursorBubbleProps {
	message?: string;
	className?: string;
	animateMessage?: boolean;
}

export interface AgentCursorUIProps extends AgentCursorBubbleProps {
	className?: string;
	pointerClassName?: string;
}

interface AgentCursorBadgeIcon {
	animation: AgentIconAnimation;
	screenContent?: AgentScreenContent;
	accentClassName: string;
	statusClassName: string;
}

const BADGE_ICONS: AgentCursorBadgeIcon[] = [
	{
		animation: "happy",
		accentClassName: "from-emerald-500/30 via-sky-500/20 to-background",
		statusClassName: "bg-emerald-400",
	},
	{
		animation: "curious",
		screenContent: {
			value: "?",
			color: "#60a5fa",
			scale: 0.68,
		},
		accentClassName: "from-sky-500/30 via-cyan-500/20 to-background",
		statusClassName: "bg-sky-400",
	},
	{
		animation: "sparkle",
		screenContent: {
			value: "*",
			color: "#f59e0b",
			scale: 0.68,
		},
		accentClassName: "from-fuchsia-500/25 via-amber-400/20 to-background",
		statusClassName: "bg-amber-300",
	},
	{
		animation: "thinking",
		screenContent: {
			value: "...",
			color: "#a78bfa",
			scale: 0.5,
		},
		accentClassName: "from-violet-500/25 via-slate-400/20 to-background",
		statusClassName: "bg-violet-400",
	},
	{
		animation: "cheer",
		accentClassName: "from-rose-500/25 via-emerald-400/20 to-background",
		statusClassName: "bg-rose-400",
	},
	{
		animation: "scan",
		screenContent: {
			value: "01",
			color: "#34d399",
			scale: 0.52,
		},
		accentClassName: "from-teal-500/25 via-lime-400/20 to-background",
		statusClassName: "bg-teal-400",
	},
];

const getRandomBadgeIcon = () =>
	BADGE_ICONS[Math.floor(Math.random() * BADGE_ICONS.length)] ?? BADGE_ICONS[0];

export const AgentCursorPointer: React.FC<AgentCursorPointerProps> = ({
	className,
}) => (
	<svg
		className={cn("drop-shadow-[0_7px_16px_rgba(0,0,0,0.25)]", className)}
		width="28"
		height="30"
		viewBox="0 0 28 30"
		fill="none"
		aria-hidden="true"
	>
		<path
			d="M3.8 2.7 25 13.2c1.4.7 1.2 2.8-.3 3.2l-8 2.1a3 3 0 0 0-1.8 1.3l-4.3 7.1c-.8 1.4-2.9 1-3.2-.6L1.5 5c-.4-1.6.9-3 2.3-2.3Z"
			fill="hsl(var(--background))"
			stroke="hsl(var(--foreground))"
			strokeWidth="1.6"
		/>
		<path
			d="m8.4 9 6.1 10.1"
			stroke="hsl(var(--muted-foreground))"
			strokeWidth="1.25"
			strokeLinecap="round"
		/>
	</svg>
);

export const AgentCursorBubble: React.FC<AgentCursorBubbleProps> = ({
	message = "Updating",
	className,
	animateMessage = true,
}) => {
	const content = (
		<>
			<span className="absolute -left-1.5 bottom-2 h-3 w-3 rotate-45 border-b border-l border-border/70 bg-background" />
			<span className="relative line-clamp-2">{message}</span>
		</>
	);

	const bubbleClassName = cn(
		"relative mb-0.5 max-w-[220px] rounded-2xl border border-border/70 bg-background px-3 py-1.5",
		"text-xs font-medium text-foreground shadow-xl shadow-black/15",
		className,
	);

	if (!animateMessage) {
		return <div className={bubbleClassName}>{content}</div>;
	}

	return (
		<motion.div
			key={message}
			className={bubbleClassName}
			initial={{ opacity: 0, y: 6, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.18 }}
		>
			{content}
		</motion.div>
	);
};

export const AgentCursorBadge: React.FC<AgentCursorBubbleProps> = ({
	message = "Updating",
	className,
	animateMessage = true,
}) => {
	const [badgeIcon] = React.useState(getRandomBadgeIcon);

	return (
		<div className={cn("flex items-end gap-2", className)}>
			<motion.div
				className="relative flex shrink-0 items-center justify-center rounded-2xl pr-2"
				initial={{ rotate: -3, scale: 0.96 }}
				animate={{ rotate: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 380, damping: 28 }}
			>
				<div
					className={cn(
						"absolute inset-0 rounded-2xl",
						badgeIcon.accentClassName,
					)}
				/>
				<div className="absolute inset-[3px] rounded-[14px]" />
				<div className="relative flex items-center justify-center">
					<AgentIcon
						size={38}
						animation={badgeIcon.animation}
						screenContent={badgeIcon.screenContent}
						reactive={false}
					/>
				</div>
			</motion.div>
			<AgentCursorBubble message={message} animateMessage={animateMessage} />
		</div>
	);
};

export const AgentCursorUI: React.FC<AgentCursorUIProps> = ({
	message = "Updating",
	className,
	pointerClassName,
	animateMessage = true,
}) => (
	<div className={cn("-translate-x-[10px] -translate-y-[10px]", className)}>
		<AgentCursorPointer className={pointerClassName} />
		<AgentCursorBadge
			message={message}
			animateMessage={animateMessage}
			className="mt-1"
		/>
	</div>
);
