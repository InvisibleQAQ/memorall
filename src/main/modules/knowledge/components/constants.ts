const COLOR_PALETTE_DARK = [
	["#60a5fa", "#3b82f6"], // blue
	["#34d399", "#10b981"], // green
	["#fbbf24", "#f59e0b"], // amber
	["#f87171", "#ef4444"], // red
	["#a78bfa", "#8b5cf6"], // purple
	["#fb923c", "#f97316"], // orange
	["#f472b6", "#ec4899"], // pink
	["#22d3ee", "#06b6d4"], // cyan
	["#a3e635", "#84cc16"], // lime
	["#fb7185", "#f43f5e"], // rose
];

const COLOR_PALETTE_LIGHT = [
	["#3b82f6", "#1e40af"], // blue
	["#10b981", "#059669"], // green
	["#f59e0b", "#d97706"], // amber
	["#ef4444", "#dc2626"], // red
	["#8b5cf6", "#7c3aed"], // purple
	["#f97316", "#ea580c"], // orange
	["#ec4899", "#db2777"], // pink
	["#06b6d4", "#0891b2"], // cyan
	["#84cc16", "#65a30d"], // lime
	["#f43f5e", "#e11d48"], // rose
];

export const NODE_RADIUS: Record<string, number> = {
	person: 12,
	organization: 14,
	location: 10,
	event: 9,
	concept: 13,
	default: 10,
};

export const generateNodeColors = (
	nodeTypes: string[],
	isDark: boolean,
): Record<string, string> => {
	const colors: Record<string, string> = {};
	const palette = isDark ? COLOR_PALETTE_DARK : COLOR_PALETTE_LIGHT;

	nodeTypes.forEach((type, index) => {
		const paletteIndex = index % palette.length;
		colors[type] = palette[paletteIndex][0];
	});

	colors.default = isDark ? "#9ca3af" : "#6b7280";
	return colors;
};

export const getThemeColors = (isDark: boolean) => ({
	background: isDark ? "#0f172a" : "#ffffff",
	border: isDark ? "#374151" : "#e5e7eb",
	text: isDark ? "#f1f5f9" : "#374151",
	textMuted: isDark ? "#94a3b8" : "#6b7280",
	stroke: isDark ? "#1e293b" : "#ffffff",
	strokeHover: isDark ? "#60a5fa" : "#2563eb",
	linkStroke: isDark ? "#475569" : "#cbd5e1",
	linkStrokeHover: isDark ? "#60a5fa" : "#3b82f6",
	arrowFill: isDark ? "#64748b" : "#94a3b8",
	shadow: isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.15)",
});

export const hashString = (str: string): number => {
	let h = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		h = (h << 5) - h + char;
		h = h & h;
	}
	return Math.abs(h);
};
