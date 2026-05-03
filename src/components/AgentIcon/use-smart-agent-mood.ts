import React, { useEffect, useRef, useState } from "react";
import { getTimeSmartMood, SMART_SIGNAL_COLORS } from "./agentMoods";
import type { SmartAgentMood } from "./agentIconTypes";

const shouldReplaceSmartMood = (
	current: SmartAgentMood | undefined,
	next: SmartAgentMood,
) =>
	!current ||
	Date.now() > current.until ||
	next.priority >= current.priority ||
	current.signal === next.signal;

export const usePrefersReducedMotion = () => {
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

export const useSmartAgentMood = (
	containerRef: React.RefObject<HTMLElement | null>,
	enabled: boolean,
): SmartAgentMood | undefined => {
	const [smartMood, setSmartMood] = useState<SmartAgentMood | undefined>(() =>
		enabled ? getTimeSmartMood() : undefined,
	);
	const smartMoodRef = useRef<SmartAgentMood | undefined>(smartMood);
	const pointerRef = useRef({
		x: 0,
		y: 0,
		time: 0,
		directionChanges: 0,
		lastDirectionX: 0,
		lastNearAt: 0,
		lastShakeAt: 0,
	});
	const activityRef = useRef(Date.now());
	const keyBurstRef = useRef({ count: 0, startedAt: 0, lastReactedAt: 0 });
	const hiddenAtRef = useRef<number | undefined>(undefined);
	const blurredAtRef = useRef<number | undefined>(
		typeof document === "undefined" || document.hasFocus()
			? undefined
			: Date.now(),
	);

	useEffect(() => {
		smartMoodRef.current = smartMood;
	}, [smartMood]);

	useEffect(() => {
		if (!enabled) {
			setSmartMood(undefined);
			return;
		}

		const applySmartMood = (next: SmartAgentMood) => {
			setSmartMood((current) =>
				shouldReplaceSmartMood(current, next) ? next : current,
			);
		};

		const markActivity = () => {
			activityRef.current = Date.now();
		};

		const handlePointerMove = (event: PointerEvent) => {
			markActivity();
			const container = containerRef.current;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;
			const distance = Math.hypot(
				event.clientX - centerX,
				event.clientY - centerY,
			);
			const nearRadius = Math.max(96, Math.min(180, rect.width * 1.35));
			const now = Date.now();
			const previous = pointerRef.current;
			const dt = Math.max(16, now - previous.time);
			const dx = event.clientX - previous.x;
			const directionX = Math.sign(dx);
			const changedDirection =
				directionX !== 0 &&
				previous.lastDirectionX !== 0 &&
				directionX !== previous.lastDirectionX;
			const speed = Math.hypot(dx, event.clientY - previous.y) / dt;
			const directionChanges =
				distance < nearRadius && changedDirection && speed > 0.65
					? previous.directionChanges + 1
					: Math.max(0, previous.directionChanges - 0.08);

			pointerRef.current = {
				x: event.clientX,
				y: event.clientY,
				time: now,
				directionChanges,
				lastDirectionX: directionX || previous.lastDirectionX,
				lastNearAt: distance < nearRadius ? now : previous.lastNearAt,
				lastShakeAt: previous.lastShakeAt,
			};

			if (
				distance < nearRadius &&
				directionChanges >= 7 &&
				now - previous.lastShakeAt > 3500
			) {
				pointerRef.current.lastShakeAt = now;
				applySmartMood({
					signal: "shake",
					priority: 30,
					until: now + 4200,
					animation: "dizzy",
					duration: 4200,
					screenContent: {
						value: "@@",
						color: SMART_SIGNAL_COLORS.alert,
						scale: 0.52,
					},
				});
				return;
			}

			if (distance < nearRadius && now - previous.lastNearAt > 6500) {
				applySmartMood({
					signal: "near",
					priority: 12,
					until: now + 4200,
					animation: "curious",
					duration: 4200,
					screenContent: {
						value: "?",
						color: SMART_SIGNAL_COLORS.alert,
						scale: 0.58,
					},
				});
			}
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			markActivity();
			const now = Date.now();
			const burst = keyBurstRef.current;
			if (now - burst.startedAt > 1800) {
				burst.startedAt = now;
				burst.count = 0;
			}
			burst.count += 1;

			if (burst.count >= 12 && now - burst.lastReactedAt > 6000) {
				burst.lastReactedAt = now;
				applySmartMood({
					signal: "typing",
					priority: 18,
					until: now + 5200,
					animation: "thinking",
					duration: 5200,
					screenContent: {
						value: "...",
						color: SMART_SIGNAL_COLORS.focus,
						scale: 0.5,
					},
				});
			}
		};

		const handleVisibilityChange = () => {
			const now = Date.now();
			if (document.visibilityState === "hidden") {
				hiddenAtRef.current = now;
				blurredAtRef.current = now;
				return;
			}

			markActivity();
			if (hiddenAtRef.current && now - hiddenAtRef.current > 45000) {
				applySmartMood({
					signal: "return",
					priority: 22,
					until: now + 4200,
					animation: "surprised",
					duration: 4200,
					screenContent: {
						value: "hi!",
						color: SMART_SIGNAL_COLORS.warm,
						scale: 0.5,
					},
				});
			}
			hiddenAtRef.current = undefined;
		};

		const handleWindowBlur = () => {
			blurredAtRef.current = Date.now();
		};

		const handleWindowFocus = () => {
			const now = Date.now();
			const blurredAt = blurredAtRef.current;
			markActivity();

			if (
				document.visibilityState === "visible" &&
				blurredAt &&
				now - blurredAt > 15000
			) {
				applySmartMood({
					signal: "focus",
					priority: 20,
					until: now + 3800,
					animation: "happy",
					duration: 3800,
					screenContent: {
						value: "back",
						color: SMART_SIGNAL_COLORS.warm,
						scale: 0.46,
					},
				});
			}

			blurredAtRef.current = undefined;
		};

		const interval = window.setInterval(() => {
			const now = Date.now();
			if (smartMoodRef.current && now > smartMoodRef.current.until) {
				setSmartMood(undefined);
			}

			if (now - activityRef.current > 10 * 60 * 1000) {
				applySmartMood({
					signal: "idle",
					priority: 14,
					until: now + 12000,
					animation: "cozy",
					duration: 12000,
					screenContent: {
						value: "zzz",
						color: SMART_SIGNAL_COLORS.sleep,
						scale: 0.5,
					},
				});
				return;
			}

			const timeMood = getTimeSmartMood(new Date(now));
			if (
				timeMood &&
				(!smartMoodRef.current || now > smartMoodRef.current.until)
			) {
				applySmartMood(timeMood);
			}
		}, 1200);

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("scroll", markActivity, { passive: true });
		window.addEventListener("blur", handleWindowBlur);
		window.addEventListener("focus", handleWindowFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.clearInterval(interval);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("scroll", markActivity);
			window.removeEventListener("blur", handleWindowBlur);
			window.removeEventListener("focus", handleWindowFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [containerRef, enabled]);

	return smartMood;
};
