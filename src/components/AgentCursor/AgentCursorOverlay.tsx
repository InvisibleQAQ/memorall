import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, useMotionValue } from "motion/react";
import { AgentCursorUI } from "./AgentCursorUI";

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
	const cursorX = useMotionValue(position.x);
	const cursorY = useMotionValue(position.y);
	const hideTimerRef = React.useRef<number | null>(null);
	const settleTimerRef = React.useRef<number | null>(null);
	const scrollFrameRef = React.useRef<number | null>(null);
	const activeElementRef = React.useRef<HTMLElement | null>(null);
	const visibleRef = React.useRef(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	React.useEffect(() => {
		cursorX.set(position.x);
		cursorY.set(position.y);
	}, [cursorX, cursorY, position]);

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
			if (scrollFrameRef.current !== null) {
				window.cancelAnimationFrame(scrollFrameRef.current);
				scrollFrameRef.current = null;
			}
		};

		const hideCursor = () => {
			activeElementRef.current = null;
			visibleRef.current = false;
			setVisible(false);
		};

		const scheduleHide = () => {
			if (hideTimerRef.current !== null) {
				window.clearTimeout(hideTimerRef.current);
			}
			hideTimerRef.current = window.setTimeout(() => {
				hideCursor();
				hideTimerRef.current = null;
			}, CURSOR_HIDE_DELAY_MS);
		};

		const updateFromActiveElement = () => {
			scrollFrameRef.current = null;
			const element = activeElementRef.current;
			if (!visibleRef.current || !element) return;
			if (!element.isConnected) {
				hideCursor();
				return;
			}
			setPosition(getTargetPosition(element));
		};

		const schedulePositionUpdate = () => {
			if (!visibleRef.current || !activeElementRef.current) return;
			if (scrollFrameRef.current !== null) return;
			scrollFrameRef.current = window.requestAnimationFrame(
				updateFromActiveElement,
			);
		};

		const moveToElement = (
			element: HTMLElement,
			detail: AgentCursorEventDetail,
		) => {
			const isJump = detail.mode === "jumpTo" || detail.mode === "jumTo";
			const behavior: ScrollBehavior = isJump ? "auto" : "smooth";
			activeElementRef.current = element;
			centerElementInScrollParents(element, behavior);

			const updatePosition = () => {
				if (activeElementRef.current !== element) return;
				if (!element.isConnected) {
					hideCursor();
					return;
				}
				setPosition(getTargetPosition(element));
				setMessage(detail.message || "Updating");
				visibleRef.current = true;
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
		window.addEventListener("scroll", schedulePositionUpdate, {
			capture: true,
			passive: true,
		});
		window.addEventListener("resize", schedulePositionUpdate);
		return () => {
			clearTimers();
			window.removeEventListener(AGENT_CURSOR_EVENT, handleCursorEvent);
			window.removeEventListener("scroll", schedulePositionUpdate, {
				capture: true,
			});
			window.removeEventListener("resize", schedulePositionUpdate);
		};
	}, []);

	if (!mounted) return null;

	return createPortal(
		<AnimatePresence>
			{visible ? (
				<AgentCursorUI message={message} x={cursorX} y={cursorY} />
			) : null}
		</AnimatePresence>,
		document.body,
	);
};
