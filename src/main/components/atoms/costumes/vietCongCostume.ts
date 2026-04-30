import type {
	AgentCostume,
	AgentCostumeDrawContext,
	AgentCostumeScreenContext,
} from "../AgentIconCanvas";

function drawStar(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	outerRadius: number,
	innerRadius: number,
) {
	ctx.beginPath();
	for (let i = 0; i < 10; i += 1) {
		const angle = -Math.PI / 2 + (i * Math.PI) / 5;
		const radius = i % 2 === 0 ? outerRadius : innerRadius;
		const px = x + Math.cos(angle) * radius;
		const py = y + Math.sin(angle) * radius;
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
}

function screen({ ctx, screen: bounds, time }: AgentCostumeScreenContext) {
	const wave = Math.sin(time / 520) * bounds.w * 0.012;

	ctx.save();
	ctx.beginPath();
	ctx.roundRect(bounds.x, bounds.y, bounds.w, bounds.h, bounds.r);
	ctx.clip();

	const flagGradient = ctx.createLinearGradient(
		bounds.x,
		bounds.y,
		bounds.x,
		bounds.y + bounds.h,
	);
	flagGradient.addColorStop(0, "#ef342d");
	flagGradient.addColorStop(0.5, "#da251d");
	flagGradient.addColorStop(1, "#b91518");
	ctx.fillStyle = flagGradient;
	ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

	ctx.globalAlpha = 0.18;
	ctx.strokeStyle = "#ff7a4d";
	ctx.lineWidth = Math.max(0.7, bounds.w * 0.008);
	for (
		let x = bounds.x + bounds.w * 0.04;
		x < bounds.x + bounds.w;
		x += bounds.w * 0.075
	) {
		ctx.beginPath();
		ctx.moveTo(x + wave, bounds.y);
		ctx.lineTo(x - wave, bounds.y + bounds.h);
		ctx.stroke();
	}
	for (
		let y = bounds.y + bounds.h * 0.08;
		y < bounds.y + bounds.h;
		y += bounds.h * 0.12
	) {
		ctx.beginPath();
		ctx.moveTo(bounds.x, y);
		ctx.lineTo(bounds.x + bounds.w, y);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;

	ctx.shadowColor = "rgba(255, 222, 0, 0.72)";
	ctx.shadowBlur = bounds.w * 0.045;
	ctx.fillStyle = "#ffdf00";
	drawStar(
		ctx,
		bounds.x + bounds.w * 0.51 + wave,
		bounds.y + bounds.h * 0.48,
		bounds.h * 0.33,
		bounds.h * 0.13,
	);
	ctx.fill();
	ctx.restore();
}

function overlay({ ctx, size, interaction, shell }: AgentCostumeDrawContext) {
	const s = size;
	const headX = interaction.x * interaction.strength * s * 0.035;
	const headY = interaction.y * interaction.strength * s * 0.025;

	ctx.save();
	ctx.translate(headX, headY);

	// Khan ran scarf.
	const scarfW = shell.w * 0.84;
	const scarfX = shell.x + (shell.w - scarfW) / 2;
	const scarfY = shell.y + shell.h * 0.855;
	const scarfH = s * 0.145;
	const checkSize = scarfW / 12;

	ctx.save();
	ctx.beginPath();
	ctx.roundRect(scarfX, scarfY, scarfW, scarfH, s * 0.024);
	ctx.clip();
	const scarfGradient = ctx.createLinearGradient(0, scarfY, 0, scarfY + scarfH);
	scarfGradient.addColorStop(0, "#f8fafc");
	scarfGradient.addColorStop(0.54, "#d9dde2");
	scarfGradient.addColorStop(1, "#b8bec7");
	ctx.fillStyle = scarfGradient;
	ctx.fillRect(scarfX, scarfY, scarfW, scarfH);
	const cols = Math.ceil(scarfW / checkSize) + 1;
	const rows = Math.ceil(scarfH / checkSize) + 1;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			ctx.fillStyle =
				(r + c) % 2 === 0 ? "rgba(10, 12, 16, 0.9)" : "rgba(255,255,255,0.72)";
			ctx.fillRect(
				scarfX + c * checkSize,
				scarfY + r * checkSize,
				checkSize,
				checkSize,
			);
		}
	}
	ctx.fillStyle = "rgba(255,255,255,0.22)";
	ctx.fillRect(scarfX, scarfY, scarfW, scarfH * 0.24);
	ctx.restore();
	ctx.strokeStyle = "rgba(0,0,0,0.22)";
	ctx.lineWidth = Math.max(0.8, s * 0.012);
	ctx.beginPath();
	ctx.roundRect(scarfX, scarfY, scarfW, scarfH, s * 0.024);
	ctx.stroke();

	// Non la conical hat.
	const tipX = shell.x + shell.w / 2;
	const tipY = s * 0.015;
	const brimCY = shell.y + s * 0.012;
	const brimRX = shell.w * 0.54;
	const brimRY = s * 0.036;

	ctx.save();
	ctx.shadowColor = "rgba(0,0,0,0.22)";
	ctx.shadowBlur = s * 0.045;
	ctx.shadowOffsetY = s * 0.014;
	const hatGrad = ctx.createLinearGradient(tipX - brimRX, 0, tipX + brimRX, 0);
	hatGrad.addColorStop(0, "#8a661d");
	hatGrad.addColorStop(0.5, "#d5ad4f");
	hatGrad.addColorStop(1, "#8a661d");
	ctx.fillStyle = hatGrad;
	ctx.beginPath();
	ctx.moveTo(tipX, tipY);
	ctx.lineTo(tipX - brimRX, brimCY);
	ctx.lineTo(tipX + brimRX, brimCY);
	ctx.closePath();
	ctx.fill();
	ctx.restore();

	ctx.save();
	const brimGrad = ctx.createRadialGradient(
		tipX,
		brimCY - brimRY * 0.3,
		0,
		tipX,
		brimCY,
		brimRX * 0.82,
	);
	brimGrad.addColorStop(0, "#dfbd62");
	brimGrad.addColorStop(1, "#8a661d");
	ctx.fillStyle = brimGrad;
	ctx.beginPath();
	ctx.ellipse(tipX, brimCY, brimRX, brimRY, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "rgba(53, 34, 6, 0.34)";
	ctx.lineWidth = Math.max(0.45, s * 0.006);
	ctx.stroke();
	ctx.restore();

	ctx.restore();
}

export const vietCongCostume: AgentCostume = {
	colors: {
		shellTop: "#fffef2",
		shellMid: "#f9f8e6",
		shellBot: "#d8d4bc",
	},
	screenPalette: {
		"2": "#ffdf00",
		"4": "#da251d",
		"5": "#ffdf00",
	},
	frameDuration: 360,
	screen,
	overlay,
};
