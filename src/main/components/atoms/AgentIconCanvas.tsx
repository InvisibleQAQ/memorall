import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type AgentIconAnimation =
	| "idle"
	| "blink"
	| "look-around"
	| "happy"
	| "talk"
	| "thinking"
	| "sleepy"
	| "excited"
	| "scan"
	| "loading";

export type AgentIconSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

interface AgentIconCanvasProps {
	size?: AgentIconSize;
	animation?: AgentIconAnimation;
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

const ANIMATION_SEQUENCE: AgentIconAnimation[] = [
	"idle",
	"blink",
	"look-around",
	"happy",
	"talk",
	"thinking",
	"sleepy",
	"excited",
	"scan",
	"loading",
];

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

const getLoopAnimation = (time: number): AgentIconAnimation => {
	const index = Math.floor(time / 1800) % ANIMATION_SEQUENCE.length;
	return ANIMATION_SEQUENCE[index];
};

const resolveSize = (size: AgentIconSize) =>
	typeof size === "number" ? size : SIZE_MAP[size];

type FaceFrame = string[];
type InteractionState = {
	x: number;
	y: number;
	strength: number;
};

const FACE_FRAMES: Record<AgentIconAnimation, FaceFrame[]> = {
	idle: [],
	blink: [
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....222222.....",
			"....2......2....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"................",
			"................",
			"................",
			".....222222.....",
			"....2......2....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	"look-around": [
		[
			"................",
			"................",
			"................",
			"................",
			"..222....222....",
			"..222....222....",
			"..222....222....",
			"................",
			"................",
			"....222222......",
			"...2......2.....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"....222....222..",
			"....222....222..",
			"....222....222..",
			"................",
			"................",
			"......222222....",
			".....2......2...",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	happy: [
		[
			"................",
			"................",
			"................",
			"...2.2....2.2...",
			"..2...2..2...2..",
			"................",
			"................",
			"................",
			"................",
			"....22222222....",
			"...2........2...",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	talk: [
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			"......2222......",
			"......2222......",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....222222.....",
			"....2......2....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	thinking: [
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....2..1..1....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....1..2..1....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....1..1..2....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	sleepy: [
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"................",
			"................",
			"................",
			"................",
			".....222222.....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	excited: [
		[
			"................",
			"................",
			"................",
			"....2......2....",
			"...222....222...",
			"..22222..22222..",
			"...222....222...",
			"....2......2....",
			"................",
			"...2222222222...",
			"..2..........2..",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	scan: [
		[
			"................",
			"................",
			"..111111111111..",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			".....222222.....",
			"....2......2....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"..111111111111..",
			"................",
			".....222222.....",
			"....2......2....",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
	loading: [
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			"....22111111....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
		[
			"................",
			"................",
			"................",
			"................",
			"...222....222...",
			"...222....222...",
			"...222....222...",
			"................",
			"................",
			"....11112222....",
			"................",
			"................",
			"................",
			"................",
			"................",
			"................",
		],
	],
};

const DEFAULT_FACE_FRAME = FACE_FRAMES.blink[0];

const getFaceFrame = (animation: AgentIconAnimation, time: number) => {
	const frames = FACE_FRAMES[animation].length
		? FACE_FRAMES[animation]
		: FACE_FRAMES.blink;
	const index = Math.floor(time / 220) % frames.length;
	return frames[index] ?? DEFAULT_FACE_FRAME;
};

const drawFaceFrame = (
	ctx: CanvasRenderingContext2D,
	frame: FaceFrame,
	screenX: number,
	screenY: number,
	screenW: number,
	screenH: number,
	color: string,
	dimColor: string,
) => {
	const rows = frame.length;
	const cols = frame[0]?.length ?? 1;
	const cell = Math.min(screenW / cols, screenH / rows);
	const originX = screenX + (screenW - cols * cell) / 2;
	const originY = screenY + (screenH - rows * cell) / 2;

	for (let y = 0; y < rows; y += 1) {
		const row = frame[y];
		for (let x = 0; x < cols; x += 1) {
			const value = row[x];
			if (value !== "1" && value !== "2") continue;
			ctx.fillStyle = value === "2" ? color : dimColor;
			roundedRect(
				ctx,
				originX + x * cell,
				originY + y * cell,
				cell * 0.92,
				cell * 0.92,
				cell * 0.35,
			);
		}
	}
};

const drawAgent = (
	ctx: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	size: number,
	animation: AgentIconAnimation,
	time: number,
	interaction: InteractionState,
) => {
	const phase = time / 1000;
	const border = getThemeColor(canvas, "--border", "#d8dce6");
	const cyan = "#17e7e7";
	const glow = "rgba(23, 231, 231, 0.72)";
	const screenDark = "#151822";

	ctx.clearRect(0, 0, size, size);
	ctx.imageSmoothingEnabled = true;

	const s = size;
	const headX = interaction.x * interaction.strength * s * 0.035;
	const headY = interaction.y * interaction.strength * s * 0.025;
	const shellX = s * 0.05;
	const shellY = s * 0.12;
	const shellW = s * 0.9;
	const shellH = s * 0.76;
	const shellR = s * 0.32;
	const screenX = s * 0.14;
	const screenY = s * 0.24;
	const screenW = s * 0.72;
	const screenH = s * 0.54;
	const screenR = s * 0.21;

	ctx.save();
	ctx.translate(headX, headY);

	ctx.save();
	ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
	ctx.shadowBlur = s * 0.12;
	ctx.shadowOffsetY = s * 0.05;
	const shellGradient = ctx.createLinearGradient(0, shellY, 0, shellY + shellH);
	shellGradient.addColorStop(0, "#ffffff");
	shellGradient.addColorStop(0.42, "#f9fafb");
	shellGradient.addColorStop(1, "#d7dde5");
	ctx.fillStyle = shellGradient;
	roundedRect(ctx, shellX, shellY, shellW, shellH, shellR);
	ctx.restore();

	ctx.strokeStyle = border;
	ctx.lineWidth = Math.max(1, s * 0.018);
	ctx.beginPath();
	ctx.roundRect(shellX, shellY, shellW, shellH, shellR);
	ctx.stroke();

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
	drawFaceFrame(
		ctx,
		getFaceFrame(animation, time),
		screenX + screenW * 0.05,
		screenY + screenH * 0.1 + Math.sin(phase * 2) * s * 0.003,
		screenW * 0.9,
		screenH * 0.8,
		cyan,
		"rgba(23, 231, 231, 0.35)",
	);
	ctx.restore();

	ctx.restore();
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

export const AgentIconCanvas: React.FC<AgentIconCanvasProps> = ({
	size = DEFAULT_SIZE,
	animation = "idle",
	className,
	"aria-label": ariaLabel = "Agent",
}) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const interactionRef = useRef<InteractionState>({ x: 0, y: 0, strength: 0 });
	const resolvedSize = resolveSize(size);

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

		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		window.addEventListener("pointerleave", handlePointerLeave);

		const render = (time: number) => {
			if (disposed) return;
			const activeAnimation =
				animation === "idle" ? getLoopAnimation(time) : animation;
			drawAgent(
				context,
				canvas,
				resolvedSize,
				activeAnimation,
				time,
				interactionRef.current,
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
	}, [animation, resolvedSize]);

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
