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

export type AgentIconSize = "xs" | "sm" | "md" | "lg" | "xl" | number;
export type { AgentIconAnimation, AgentScreenFrame };
export type AgentScreenPalette = Record<string, string>;

interface AgentIconCanvasProps {
	size?: AgentIconSize;
	animation?: AgentIconAnimation;
	screenFrames?: AgentScreenFrame[];
	screenPalette?: Partial<AgentScreenPalette>;
	faceColor?: string;
	faceDimColor?: string;
	frameDuration?: number;
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
	shellGradient.addColorStop(0, "#ffffff");
	shellGradient.addColorStop(0.42, "#f9fafb");
	shellGradient.addColorStop(1, "#d7dde5");
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
	drawScreenFrame(
		ctx,
		frame,
		screenX + screenW * 0.035,
		screenY + screenH * 0.065 + Math.sin(time / 500) * s * 0.003,
		screenW * 0.93,
		screenH * 0.87,
		palette,
	);
	ctx.restore();

	ctx.restore();
};

export const AgentIconCanvas: React.FC<AgentIconCanvasProps> = ({
	size = DEFAULT_SIZE,
	animation = "idle",
	screenFrames,
	screenPalette,
	faceColor,
	faceDimColor,
	frameDuration,
	className,
	"aria-label": ariaLabel = "Agent",
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const interactionRef = useRef<InteractionState>({ x: 0, y: 0, strength: 0 });
	const resolvedSize = resolveSize(size);
	const resolvedPalette = useMemo(
		() => resolveScreenPalette(screenPalette, faceColor, faceDimColor),
		[faceColor, faceDimColor, screenPalette],
	);

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

		const handlePointerMove = (event: PointerEvent) => {
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

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});
		window.addEventListener("pointerleave", handlePointerLeave);

		const render = (time: number) => {
			if (disposed) return;
			const activeAnimation =
				animation === "idle" && !screenFrames
					? getLoopAnimation(time)
					: animation;
			drawAgent(
				context,
				canvas,
				resolvedSize,
				getFrame(activeAnimation, time, screenFrames, frameDuration),
				time,
				interactionRef.current,
				resolvedPalette,
			);

			if (!reduceMotion) {
				frameId = window.requestAnimationFrame(render);
			}
		};

		render(0);

		return () => {
			disposed = true;
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerleave", handlePointerLeave);
			if (frameId) window.cancelAnimationFrame(frameId);
		};
	}, [animation, frameDuration, resolvedPalette, resolvedSize, screenFrames]);

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
