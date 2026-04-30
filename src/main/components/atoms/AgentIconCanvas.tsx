import React, { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
	ANIMATION_SEQUENCE,
	FACE_FRAMES,
	SCREEN_COLUMNS,
	SCREEN_ROWS,
	type AgentIconAnimation,
	type AgentScreenFrame,
} from "./AgentIconFrames";
import { getAgentCostumeByVariant, type AgentCostumeVariant } from "./costumes";

export type AgentIconSize = "xs" | "sm" | "md" | "lg" | "xl" | number;
export type { AgentIconAnimation, AgentScreenFrame };
export type AgentScreenPalette = Record<string, string>;

export type AgentScreenContent =
	| string
	| {
			value: string;
			kind?: "text" | "emoji";
			color?: string;
			background?: string;
			fontFamily?: string;
			fontWeight?: string | number;
			scale?: number;
	  };

type ScreenBounds = { x: number; y: number; w: number; h: number; r: number };

/** Overrides for the agent shell gradient colours. */
export type AgentCostumeColors = {
	shellTop?: string;
	shellMid?: string;
	shellBot?: string;
};

/** Context passed to every costume overlay so it can draw accessories. */
export type AgentCostumeDrawContext = {
	ctx: CanvasRenderingContext2D;
	canvas: HTMLCanvasElement;
	size: number;
	time: number;
	/** Normalised pointer direction + proximity [0-1]. */
	interaction: { x: number; y: number; strength: number };
	/** Shell geometry constants (mirrors drawAgent internals). */
	shell: { x: number; y: number; w: number; h: number; r: number };
};

export type AgentCostumeScreenContext = {
	ctx: CanvasRenderingContext2D;
	canvas: HTMLCanvasElement;
	size: number;
	time: number;
	interaction: { x: number; y: number; strength: number };
	screen: ScreenBounds;
};

/**
 * A costume is pure data — no imports from this file needed at the call site.
 * Define each costume in its own file under costumes/ and pass it as a prop.
 */
export type AgentCostume = {
	/** Optional shell colour tint applied before drawing. */
	colors?: AgentCostumeColors;
	/** Optional screen animation frames shown inside the agent display. */
	screenFrames?: AgentScreenFrame[];
	/** Optional screen palette overrides for costume-specific display art. */
	screenPalette?: Partial<AgentScreenPalette>;
	/** Optional screen content for text, numbers, or emoji. */
	screenContent?: AgentScreenContent;
	/** Optional frame duration for costume-specific screen animation. */
	frameDuration?: number;
	/** Optional custom screen renderer for art that does not fit pixel frames. */
	screen?: (cx: AgentCostumeScreenContext) => void;
	/** Called after the core agent is drawn; add hats, scarves, armour, etc. */
	overlay?: (cx: AgentCostumeDrawContext) => void;
};

export interface AgentIconCanvasProps {
	size?: AgentIconSize;
	animation?: AgentIconAnimation;
	screenFrames?: AgentScreenFrame[];
	screenPalette?: Partial<AgentScreenPalette>;
	screenContent?: AgentScreenContent;
	faceColor?: string;
	faceDimColor?: string;
	frameDuration?: number;
	costume?: AgentCostume;
	variant?: AgentCostumeVariant;
	className?: string;
	"aria-label"?: string;
}

const DEFAULT_SIZE = 48;
const SIZE_MAP = {
	xs: 24,
	sm: 32,
	md: 40,
	lg: 48,
	xl: 72,
} satisfies Record<Exclude<AgentIconSize, number>, number>;

const DEFAULT_SCREEN_PALETTE: AgentScreenPalette = {
	".": "transparent",
	"0": "transparent",
	"1": "rgba(23, 231, 231, 0.35)",
	"2": "#17e7e7",
	"3": "#ffffff",
	"4": "#ef4444",
	"5": "#facc15",
	"6": "#2563eb",
	"7": "#22c55e",
	"8": "#111827",
	"9": "#f8fafc",
};

const resolveSize = (size: AgentIconSize) =>
	typeof size === "number" ? size : SIZE_MAP[size];

const resolveScreenPalette = (
	screenPalette?: Partial<AgentScreenPalette>,
	faceColor?: string,
	faceDimColor?: string,
): AgentScreenPalette => ({
	...DEFAULT_SCREEN_PALETTE,
	...screenPalette,
	...(faceDimColor ? { "1": faceDimColor } : {}),
	...(faceColor ? { "2": faceColor } : {}),
});

const getLoopAnimation = (time: number): AgentIconAnimation => {
	const index = Math.floor(time / 1800) % ANIMATION_SEQUENCE.length;
	return ANIMATION_SEQUENCE[index];
};

const mergeCostumes = (
	base?: AgentCostume,
	override?: AgentCostume,
): AgentCostume | undefined => {
	if (!base) return override;
	if (!override) return base;

	return {
		...base,
		...override,
		colors: {
			...base.colors,
			...override.colors,
		},
		screenPalette: {
			...base.screenPalette,
			...override.screenPalette,
		},
	};
};

const getFrame = (
	animation: AgentIconAnimation,
	time: number,
	customFrames?: AgentScreenFrame[],
	frameDuration = 260,
) => {
	const frames = customFrames?.length ? customFrames : FACE_FRAMES[animation];
	const index = Math.floor(time / frameDuration) % frames.length;
	return frames[index] ?? FACE_FRAMES.idle[0];
};

const normalizeScreenContent = (
	content: AgentScreenContent,
): Exclude<AgentScreenContent, string> => {
	if (typeof content === "string") {
		return {
			value: content,
			kind: "text",
		};
	}

	return content;
};

const drawScreenContent = (
	ctx: CanvasRenderingContext2D,
	content: AgentScreenContent,
	bounds: ScreenBounds,
	palette: AgentScreenPalette,
) => {
	const normalized = normalizeScreenContent(content);
	const value = normalized.value.trim();
	if (!value) return;

	ctx.save();
	ctx.beginPath();
	ctx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, bounds.r);
	ctx.clip();

	if (normalized.background) {
		ctx.fillStyle = normalized.background;
		ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
	}

	const isEmoji = normalized.kind === "emoji";
	const maxFontSize = bounds.h * (normalized.scale ?? (isEmoji ? 0.78 : 0.72));
	const minFontSize = Math.max(8, bounds.h * 0.18);
	const fontFamily =
		normalized.fontFamily ??
		(isEmoji
			? '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
			: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace');
	const fontWeight = normalized.fontWeight ?? (isEmoji ? "400" : "800");
	let fontSize = maxFontSize;
	const contentColor = normalized.color ?? palette["2"] ?? "#17e7e7";

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = contentColor;

	do {
		ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
		if (ctx.measureText(value).width <= bounds.w * 0.9) break;
		fontSize -= 1;
	} while (fontSize > minFontSize);

	ctx.shadowColor = isEmoji ? "rgba(255,255,255,0.2)" : contentColor;
	ctx.shadowBlur = isEmoji ? bounds.w * 0.015 : bounds.w * 0.035;
	ctx.fillText(value, bounds.x + bounds.w / 2, bounds.y + bounds.h * 0.52);
	ctx.restore();
};

const createVisibilityObserver = (
	canvas: HTMLCanvasElement,
	onVisibilityChange: (isVisible: boolean) => void,
) => {
	if (!("IntersectionObserver" in window)) {
		onVisibilityChange(true);
		return undefined;
	}

	const observer = new IntersectionObserver(
		([entry]) => onVisibilityChange(Boolean(entry?.isIntersecting)),
		{ threshold: 0.01 },
	);
	observer.observe(canvas);
	return observer;
};

const getThemeColor = (
	canvas: HTMLCanvasElement,
	name: string,
	fallback: string,
) => {
	const value = getComputedStyle(canvas).getPropertyValue(name).trim();
	return value ? `hsl(${value})` : fallback;
};

const roundedRect = (
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) => {
	ctx.beginPath();
	ctx.roundRect(x, y, width, height, radius);
	ctx.fill();
};

const drawScreenFrame = (
	ctx: CanvasRenderingContext2D,
	frame: AgentScreenFrame,
	x: number,
	y: number,
	width: number,
	height: number,
	palette: AgentScreenPalette,
) => {
	const rows = Math.max(frame.length, SCREEN_ROWS);
	const cols = Math.max(SCREEN_COLUMNS, ...frame.map((row) => row.length));
	const cell = Math.min(width / cols, height / rows);
	const originX = x + (width - cols * cell) / 2;
	const originY = y + (height - rows * cell) / 2;

	for (let row = 0; row < rows; row += 1) {
		const line = frame[row] ?? "";
		for (let col = 0; col < cols; col += 1) {
			const color = palette[line[col]];
			if (!color || color === "transparent") continue;
			ctx.fillStyle = color;
			roundedRect(
				ctx,
				originX + col * cell,
				originY + row * cell,
				cell * 0.86,
				cell * 0.86,
				cell * 0.28,
			);
		}
	}
};

type InteractionState = {
	x: number;
	y: number;
	strength: number;
};

const getPointerInteraction = (
	canvas: HTMLCanvasElement,
	pointerX: number,
	pointerY: number,
	size: number,
): InteractionState => {
	const rect = canvas.getBoundingClientRect();
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;
	const dx = pointerX - centerX;
	const dy = pointerY - centerY;
	const distance = Math.hypot(dx, dy);
	const range = Math.max(size * 3, 120);
	const strength = Math.max(0, 1 - distance / range);

	return {
		x: distance > 0 ? dx / distance : 0,
		y: distance > 0 ? dy / distance : 0,
		strength,
	};
};

const drawAgent = (
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	size: number,
	frame: AgentScreenFrame,
	time: number,
	interaction: InteractionState,
	palette: AgentScreenPalette,
	costume?: AgentCostumeColors,
	screen?: AgentCostume["screen"],
	screenContent?: AgentScreenContent,
) => {
	const border = getThemeColor(canvas, "--border", "#d8dce6");
	const glow = palette["2"] ?? "#17e7e7";
	const screenDark = "#151822";

	ctx.clearRect(0, 0, size, size);
	ctx.imageSmoothingEnabled = true;

	const s = size;
	const headX = interaction.x * interaction.strength * s * 0.035;
	const headY = interaction.y * interaction.strength * s * 0.025;
	const shellX = s * 0.055;
	const shellY = s * 0.115;
	const shellW = s * 0.89;
	const shellH = s * 0.69;
	const shellR = s * 0.29;
	const screenX = s * 0.115;
	const screenY = s * 0.285;
	const screenW = s * 0.77;
	const screenH = s * 0.48;
	const screenR = s * 0.2;

	ctx.save();
	ctx.translate(headX, headY);

	ctx.save();
	ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
	ctx.shadowBlur = s * 0.085;
	ctx.shadowOffsetY = s * 0.035;
	const shellGradient = ctx.createLinearGradient(0, shellY, 0, shellY + shellH);
	shellGradient.addColorStop(0, costume?.shellTop ?? "#ffffff");
	shellGradient.addColorStop(0.42, costume?.shellMid ?? "#f9fafb");
	shellGradient.addColorStop(1, costume?.shellBot ?? "#d7dde5");
	ctx.fillStyle = shellGradient;
	roundedRect(ctx, shellX, shellY, shellW, shellH, shellR);
	ctx.restore();

	ctx.strokeStyle = border;
	ctx.lineWidth = Math.max(1, s * 0.012);
	ctx.beginPath();
	ctx.roundRect(shellX, shellY, shellW, shellH, shellR);
	ctx.stroke();

	ctx.save();
	ctx.globalAlpha = 1;
	const chromeY = shellY + shellH * 0.155;
	const chromeDot = Math.max(2.4, s * 0.032);
	ctx.fillStyle = "#ef4444";
	roundedRect(
		ctx,
		shellX + shellW * 0.2,
		chromeY,
		chromeDot,
		chromeDot,
		chromeDot / 2,
	);
	ctx.fillStyle = "#facc15";
	roundedRect(
		ctx,
		shellX + shellW * 0.3,
		chromeY,
		chromeDot,
		chromeDot,
		chromeDot / 2,
	);
	ctx.fillStyle = "#22c55e";
	roundedRect(
		ctx,
		shellX + shellW * 0.4,
		chromeY,
		chromeDot,
		chromeDot,
		chromeDot / 2,
	);
	ctx.fillStyle = "rgba(15, 23, 42, 0.22)";
	roundedRect(
		ctx,
		shellX + shellW * 0.54,
		chromeY - chromeDot * 0.12,
		shellW * 0.24,
		chromeDot * 1.2,
		chromeDot * 0.6,
	);
	ctx.restore();

	ctx.save();
	ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
	ctx.shadowBlur = s * 0.08;
	ctx.shadowOffsetY = s * 0.03;
	const screenGradient = ctx.createRadialGradient(
		s * 0.44,
		s * 0.36,
		s * 0.05,
		s * 0.5,
		s * 0.5,
		s * 0.38,
	);
	screenGradient.addColorStop(0, "#3b4050");
	screenGradient.addColorStop(0.48, "#1f2330");
	screenGradient.addColorStop(1, screenDark);
	ctx.fillStyle = screenGradient;
	roundedRect(ctx, screenX, screenY, screenW, screenH, screenR);
	ctx.restore();

	ctx.save();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
	ctx.lineWidth = Math.max(1, s * 0.012);
	ctx.beginPath();
	ctx.roundRect(screenX, screenY, screenW, screenH, screenR);
	ctx.stroke();
	ctx.restore();

	ctx.save();
	ctx.globalAlpha = 0.45;
	ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
	ctx.lineWidth = s * 0.045;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(shellX + shellW * 0.14, shellY + shellH * 0.2);
	ctx.quadraticCurveTo(
		shellX + shellW * 0.19,
		shellY + shellH * 0.08,
		shellX + shellW * 0.36,
		shellY + shellH * 0.1,
	);
	ctx.stroke();
	ctx.restore();

	ctx.save();
	ctx.shadowColor = glow;
	ctx.shadowBlur = s * 0.06;
	ctx.translate(
		interaction.x * interaction.strength * s * 0.035,
		interaction.y * interaction.strength * s * 0.02,
	);
	const contentScreen = {
		x: screenX + screenW * 0.035,
		y: screenY + screenH * 0.065 + Math.sin(time / 500) * s * 0.003,
		w: screenW * 0.93,
		h: screenH * 0.87,
		r: screenR * 0.58,
	};
	if (screenContent) {
		drawScreenContent(ctx, screenContent, contentScreen, palette);
	} else if (screen) {
		screen({
			ctx,
			canvas,
			size,
			time,
			interaction,
			screen: contentScreen,
		});
	} else {
		drawScreenFrame(
			ctx,
			frame,
			contentScreen.x,
			contentScreen.y,
			contentScreen.w,
			contentScreen.h,
			palette,
		);
	}
	ctx.restore();

	ctx.restore();
};

export const AgentIconCanvas: React.FC<AgentIconCanvasProps> = ({
	size = DEFAULT_SIZE,
	animation = "idle",
	screenFrames,
	screenPalette,
	screenContent,
	faceColor,
	faceDimColor,
	frameDuration,
	costume,
	variant,
	className,
	"aria-label": ariaLabel = "Agent",
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const interactionRef = useRef<InteractionState>({ x: 0, y: 0, strength: 0 });
	const resolvedSize = resolveSize(size);
	const resolvedCostume = useMemo(
		() => mergeCostumes(getAgentCostumeByVariant(variant), costume),
		[costume, variant],
	);
	const resolvedScreenPalette = useMemo(
		() => ({
			...resolvedCostume?.screenPalette,
			...screenPalette,
		}),
		[resolvedCostume?.screenPalette, screenPalette],
	);
	const resolvedPalette = useMemo(
		() => resolveScreenPalette(resolvedScreenPalette, faceColor, faceDimColor),
		[faceColor, faceDimColor, resolvedScreenPalette],
	);
	const activeScreenFrames = screenFrames ?? resolvedCostume?.screenFrames;
	const activeScreenContent = screenContent ?? resolvedCostume?.screenContent;
	const activeFrameDuration = frameDuration ?? resolvedCostume?.frameDuration;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const context = canvas.getContext("2d");
		if (!context) return;

		const pixelRatio = window.devicePixelRatio || 1;
		canvas.width = resolvedSize * pixelRatio;
		canvas.height = resolvedSize * pixelRatio;
		canvas.style.width = `${resolvedSize}px`;
		canvas.style.height = `${resolvedSize}px`;
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

		const reduceMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		let frameId = 0;
		let disposed = false;
		let isCanvasVisible = true;
		let isDocumentVisible = document.visibilityState === "visible";

		const handlePointerMove = (event: PointerEvent) => {
			if (!isCanvasVisible || !isDocumentVisible) return;
			interactionRef.current = getPointerInteraction(
				canvas,
				event.clientX,
				event.clientY,
				resolvedSize,
			);
		};

		const handlePointerLeave = () => {
			interactionRef.current = { x: 0, y: 0, strength: 0 };
		};

		const requestNextFrame = () => {
			if (!reduceMotion && isCanvasVisible && isDocumentVisible) {
				frameId = window.requestAnimationFrame(render);
			}
		};

		const handleVisibilityChange = () => {
			isDocumentVisible = document.visibilityState === "visible";
			if (frameId) window.cancelAnimationFrame(frameId);
			if (isDocumentVisible) {
				frameId = window.requestAnimationFrame(render);
			}
		};

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});
		window.addEventListener("pointerleave", handlePointerLeave);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		const visibilityObserver = createVisibilityObserver(
			canvas,
			(nextIsVisible) => {
				isCanvasVisible = nextIsVisible;
				if (frameId) window.cancelAnimationFrame(frameId);
				if (nextIsVisible) {
					frameId = window.requestAnimationFrame(render);
				}
			},
		);

		const render = (time: number) => {
			if (disposed || !isCanvasVisible || !isDocumentVisible) return;
			const activeAnimation =
				animation === "idle" && !activeScreenFrames
					? getLoopAnimation(time)
					: animation;
			const currentFrame = getFrame(
				activeAnimation,
				time,
				activeScreenFrames,
				activeFrameDuration,
			);

			drawAgent(
				context,
				canvas,
				resolvedSize,
				currentFrame,
				time,
				interactionRef.current,
				resolvedPalette,
				resolvedCostume?.colors,
				resolvedCostume?.screen,
				activeScreenContent,
			);

			resolvedCostume?.overlay?.({
				ctx: context,
				canvas,
				size: resolvedSize,
				time,
				interaction: interactionRef.current,
				shell: {
					x: resolvedSize * 0.055,
					y: resolvedSize * 0.115,
					w: resolvedSize * 0.89,
					h: resolvedSize * 0.69,
					r: resolvedSize * 0.29,
				},
			});

			requestNextFrame();
		};

		render(0);

		return () => {
			disposed = true;
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerleave", handlePointerLeave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			visibilityObserver?.disconnect();
			if (frameId) window.cancelAnimationFrame(frameId);
		};
	}, [
		activeFrameDuration,
		activeScreenContent,
		activeScreenFrames,
		animation,
		resolvedCostume,
		resolvedPalette,
		resolvedSize,
	]);

	return (
		<canvas
			ref={canvasRef}
			aria-label={ariaLabel}
			className={cn("block shrink-0", className)}
			height={resolvedSize}
			role="img"
			width={resolvedSize}
		/>
	);
};
