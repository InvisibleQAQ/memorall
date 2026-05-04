import React from "react";
import {
	motion,
	useMotionValue,
	useSpring,
	type MotionValue,
} from "motion/react";
import { AgentIcon } from "@/components/AgentIcon";
import { cn } from "@/lib/utils";

interface AgentCursorPointerProps {
	className?: string;
}

export interface AgentCursorBubbleProps {
	message?: string;
	className?: string;
	animateMessage?: boolean;
}

export interface AgentCursorBadgeProps extends AgentCursorBubbleProps {
	iconSize?: number;
}

export interface AgentCursorUIProps extends AgentCursorBadgeProps {
	className?: string;
	pointerClassName?: string;
	x?: MotionValue<number>;
	y?: MotionValue<number>;
}

export const AgentCursorPointer: React.FC<AgentCursorPointerProps> = ({
	className,
}) => (
	<svg
		className={cn(
			"agent-cursor-pointer",
			"text-primary drop-shadow-[0_8px_18px_rgb(0_0_0/0.18)]",
			className,
		)}
		width="25"
		height="27"
		viewBox="0 0 25 27"
		fill="none"
		aria-hidden="true"
	>
		<path
			d="M4.2 2.9 21.4 12c1.35.72 1.1 2.72-.38 3.08l-6.66 1.62a2.8 2.8 0 0 0-1.72 1.24L9.18 23.8c-.8 1.34-2.86.92-3.08-.62L2.02 5.08C1.7 3.62 2.9 2.2 4.2 2.9Z"
			fill="currentColor"
			fillOpacity="0.84"
			stroke="hsl(var(--background))"
			strokeOpacity="0.72"
			strokeWidth="1.45"
			strokeLinejoin="round"
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
			<span className="agent-cursor-bubble-text relative line-clamp-2">
				{message}
			</span>
		</>
	);

	const bubbleClassName = cn(
		"agent-cursor-bubble",
		"relative mb-0.5 max-w-[220px] rounded-xl border border-white/35 bg-background/70 px-3 py-1.5",
		"text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-md",
		"supports-[backdrop-filter]:bg-background/55",
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

export const AgentCursorBadge: React.FC<AgentCursorBadgeProps> = ({
	message = "Updating",
	className,
	animateMessage = true,
	iconSize = 38,
}) => {
	const normalizedMessage = message.trim().toLowerCase();
	const shouldShowMessage =
		message.trim().length > 0 &&
		![
			"updating",
			"moving to the relevant area",
			"click target",
			"input target",
		].includes(normalizedMessage);

	return (
		<div className={cn("agent-cursor-badge flex items-end gap-2", className)}>
			<motion.div
				className="agent-cursor-badge-icon relative flex shrink-0 items-center justify-center"
				initial={{ y: 4, scale: 0.96 }}
				animate={{ rotate: 0, scale: 1 }}
				transition={{ type: "spring", stiffness: 380, damping: 28 }}
			>
				<AgentIcon
					size={Math.max(36, Math.min(iconSize, 44))}
					animation="happy"
					reactive={false}
				/>
			</motion.div>
			{shouldShowMessage ? (
				<AgentCursorBubble message={message} animateMessage={animateMessage} />
			) : null}
		</div>
	);
};

export const AgentCursorUI: React.FC<AgentCursorUIProps> = ({
	message = "Updating",
	className,
	pointerClassName,
	animateMessage = true,
	iconSize,
	x,
	y,
}) => {
	const localX = useMotionValue(0);
	const localY = useMotionValue(0);
	const sourceX = x ?? localX;
	const sourceY = y ?? localY;
	const pointerX = useSpring(sourceX, {
		stiffness: 170,
		damping: 24,
		mass: 0.65,
		bounce: 0,
	});
	const pointerY = useSpring(sourceY, {
		stiffness: 170,
		damping: 24,
		mass: 0.65,
		bounce: 0,
	});
	const followX = useSpring(pointerX, {
		stiffness: 220,
		damping: 32,
		bounce: 0,
	});
	const followY = useSpring(pointerY, {
		stiffness: 220,
		damping: 32,
		bounce: 0,
	});

	const pointer = <AgentCursorPointer className={pointerClassName} />;
	const badge = (
		<AgentCursorBadge
			message={message}
			animateMessage={animateMessage}
			iconSize={iconSize}
		/>
	);

	if (x && y) {
		return (
			<div className={cn("text-primary", className)}>
				<motion.div
					className="agent-cursor-pointer-layer pointer-events-none fixed left-0 top-0 z-[10000]"
					style={{ x: pointerX, y: pointerY }}
					initial={{ opacity: 0, scale: 0.92 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.92 }}
					transition={{
						opacity: { duration: 0.16 },
						scale: { duration: 0.18 },
					}}
				>
					<div className="agent-cursor-pointer-offset -translate-x-[10px] -translate-y-[10px]">
						{pointer}
					</div>
				</motion.div>
				<motion.div
					className="agent-cursor-badge-layer pointer-events-none fixed left-0 top-0 z-[9999]"
					style={{ x: followX, y: followY }}
					initial={{ opacity: 0, scale: 0.96 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.96 }}
					transition={{
						opacity: { duration: 0.16 },
						scale: { duration: 0.18 },
					}}
				>
					<div className="agent-cursor-badge-offset translate-x-[18px] translate-y-[24px]">
						{badge}
					</div>
				</motion.div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"agent-cursor-static",
				"-translate-x-[10px] -translate-y-[10px] text-primary",
				className,
			)}
		>
			{pointer}
			<div className="agent-cursor-static-badge mt-1">{badge}</div>
		</div>
	);
};
