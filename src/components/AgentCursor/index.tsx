import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { AgentIcon } from "@/components/AgentIcon";
import { cn } from "@/lib/utils";

const AGENT_CURSOR_EVENT = "memorall:agent-cursor";
const CURSOR_POINT_ATTR = "data-agent-cursor-point";
const CURSOR_HIDE_DELAY_MS = 2600;
const SMOOTH_SCROLL_SETTLE_MS = 720;

export type AgentCursorMode = "moveTo" | "jumpTo" | "jumTo";

export interface AgentCursorEventDetail {
	targetKey: string;
	message?: string;
	mode?: AgentCursorMode;
}

interface CursorPosition {
	x: number;
	y: number;
}

export interface CursorPointProps extends React.ComponentProps<"div"> {
	cursorKey: string | string[];
	children: React.ReactNode;
}

export const moveTo = (
	targetKey: string,
	message?: string,
	mode: AgentCursorMode = "moveTo",
): void => {
	if (typeof window === "undefined") return;

	window.dispatchEvent(
		new CustomEvent<AgentCursorEventDetail>(AGENT_CURSOR_EVENT, {
			detail: { targetKey, message, mode },
		}),
	);
};

export const jumpTo = (targetKey: string, message?: string): void => {
	moveTo(targetKey, message, "jumpTo");
};

export const jumTo = jumpTo;

const getCursorPointSelector = (cursorKey: string) =>
	`[${CURSOR_POINT_ATTR}="${CSS.escape(cursorKey)}"]`;

const findCursorPoint = (cursorKey: string): HTMLElement | null => {
	const exact = document.querySelector<HTMLElement>(
		getCursorPointSelector(cursorKey),
	);
	if (exact) return exact;

	for (const element of document.querySelectorAll<HTMLElement>(
		`[${CURSOR_POINT_ATTR}]`,
	)) {
		const keys = element.getAttribute(CURSOR_POINT_ATTR)?.split(" ") ?? [];
		if (keys.includes(cursorKey)) return element;
	}
	return null;
};

const getTargetPosition = (element: HTMLElement): CursorPosition => {
	const rect = element.getBoundingClientRect();
	return {
		x: Math.min(
			window.innerWidth - 24,
			Math.max(24, rect.left + rect.width / 2),
		),
		y: Math.min(
			window.innerHeight - 34,
			Math.max(28, rect.top + Math.min(rect.height * 0.45, 42)),
		),
	};
};

const isScrollable = (element: HTMLElement): boolean => {
	const style = window.getComputedStyle(element);
	const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
	if (!/(auto|scroll|overlay)/.test(overflow)) return false;
	return (
		element.scrollHeight > element.clientHeight ||
		element.scrollWidth > element.clientWidth
	);
};

const getScrollParents = (element: HTMLElement): HTMLElement[] => {
	const parents: HTMLElement[] = [];
	let parent = element.parentElement;

	while (parent) {
		if (isScrollable(parent)) parents.push(parent);
		parent = parent.parentElement;
	}

	return parents;
};

const centerElementInScrollParents = (
	element: HTMLElement,
	behavior: ScrollBehavior,
) => {
	for (const parent of getScrollParents(element)) {
		const rect = element.getBoundingClientRect();
		const parentRect = parent.getBoundingClientRect();
		const top =
			parent.scrollTop +
			rect.top -
			parentRect.top -
			(parent.clientHeight - Math.min(rect.height, parent.clientHeight)) / 2;
		const left =
			parent.scrollLeft +
			rect.left -
			parentRect.left -
			(parent.clientWidth - Math.min(rect.width, parent.clientWidth)) / 2;
		parent.scrollTo({
			top: Math.max(0, top),
			left: Math.max(0, left),
			behavior,
		});
	}

	const rect = element.getBoundingClientRect();
	const top =
		window.scrollY +
		rect.top -
		(window.innerHeight - Math.min(rect.height, window.innerHeight)) / 2;
	const left =
		window.scrollX +
		rect.left -
		(window.innerWidth - Math.min(rect.width, window.innerWidth)) / 2;
	window.scrollTo({ top: Math.max(0, top), left: Math.max(0, left), behavior });
};

export const CursorPoint: React.FC<CursorPointProps> = ({
	cursorKey,
	children,
	className,
	...props
}) => (
	<div
		{...props}
		{...{
			[CURSOR_POINT_ATTR]: Array.isArray(cursorKey)
				? cursorKey.join(" ")
				: cursorKey,
		}}
		className={className}
	>
		{children}
	</div>
);

export const AgentCursorOverlay: React.FC = () => {
	const [mounted, setMounted] = React.useState(false);
	const [position, setPosition] = React.useState<CursorPosition>({
		x: 48,
		y: 48,
	});
	const [visible, setVisible] = React.useState(false);
	const [message, setMessage] = React.useState("Updating");
	const hideTimerRef = React.useRef<number | null>(null);
	const settleTimerRef = React.useRef<number | null>(null);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		const clearTimers = () => {
			if (hideTimerRef.current !== null) {
				window.clearTimeout(hideTimerRef.current);
				hideTimerRef.current = null;
			}
			if (settleTimerRef.current !== null) {
				window.clearTimeout(settleTimerRef.current);
				settleTimerRef.current = null;
			}
		};

		const scheduleHide = () => {
			if (hideTimerRef.current !== null) {
				window.clearTimeout(hideTimerRef.current);
			}
			hideTimerRef.current = window.setTimeout(() => {
				setVisible(false);
				hideTimerRef.current = null;
			}, CURSOR_HIDE_DELAY_MS);
		};

		const moveToElement = (
			element: HTMLElement,
			detail: AgentCursorEventDetail,
		) => {
			const isJump = detail.mode === "jumpTo" || detail.mode === "jumTo";
			const behavior: ScrollBehavior = isJump ? "auto" : "smooth";
			centerElementInScrollParents(element, behavior);

			const updatePosition = () => {
				setPosition(getTargetPosition(element));
				setMessage(detail.message || "Updating");
				setVisible(true);
				scheduleHide();
			};

			if (isJump) {
				window.requestAnimationFrame(updatePosition);
				return;
			}

			const startedAt = performance.now();
			const trackScroll = () => {
				updatePosition();
				if (performance.now() - startedAt < SMOOTH_SCROLL_SETTLE_MS) {
					window.requestAnimationFrame(trackScroll);
				}
			};
			window.requestAnimationFrame(trackScroll);

			settleTimerRef.current = window.setTimeout(() => {
				window.requestAnimationFrame(updatePosition);
			}, SMOOTH_SCROLL_SETTLE_MS);
		};

		const handleCursorEvent = (event: Event) => {
			const detail = (event as CustomEvent<AgentCursorEventDetail>).detail;
			if (!detail?.targetKey) return;

			clearTimers();
			const findAndMove = (attempt = 0) => {
				const element = findCursorPoint(detail.targetKey);
				if (element) {
					moveToElement(element, detail);
					return;
				}
				if (attempt >= 8) return;
				settleTimerRef.current = window.setTimeout(
					() => findAndMove(attempt + 1),
					50,
				);
			};
			findAndMove();
		};

		window.addEventListener(AGENT_CURSOR_EVENT, handleCursorEvent);
		return () => {
			clearTimers();
			window.removeEventListener(AGENT_CURSOR_EVENT, handleCursorEvent);
		};
	}, []);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{visible ? (
				<motion.div
					className="pointer-events-none fixed left-0 top-0 z-[10000]"
					initial={{ opacity: 0, scale: 0.92 }}
					animate={{
						opacity: 1,
						scale: 1,
						x: position.x,
						y: position.y,
					}}
					exit={{ opacity: 0, scale: 0.92 }}
					transition={{
						x: { type: "spring", stiffness: 170, damping: 24, mass: 0.65 },
						y: { type: "spring", stiffness: 170, damping: 24, mass: 0.65 },
						opacity: { duration: 0.16 },
						scale: { duration: 0.18 },
					}}
				>
					<div className="-translate-x-[10px] -translate-y-[10px]">
						<svg
							className="drop-shadow-[0_7px_16px_rgba(0,0,0,0.25)]"
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
						<div className="mt-1 flex items-end gap-1.5">
							<div className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background shadow-lg shadow-black/15">
								<AgentIcon size={34} animation="happy" />
								<span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
							</div>
							<motion.div
								key={message}
								className={cn(
									"relative mb-0.5 max-w-[220px] rounded-2xl border border-border/70 bg-background px-3 py-1.5",
									"text-xs font-medium text-foreground shadow-xl shadow-black/15",
								)}
								initial={{ opacity: 0, y: 6, scale: 0.96 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								transition={{ duration: 0.18 }}
							>
								<span className="absolute -left-1.5 bottom-2 h-3 w-3 rotate-45 border-b border-l border-border/70 bg-background" />
								<span className="relative line-clamp-2">{message}</span>
							</motion.div>
						</div>
					</div>
				</motion.div>
			) : null}
		</AnimatePresence>,
		document.body,
	);
};
