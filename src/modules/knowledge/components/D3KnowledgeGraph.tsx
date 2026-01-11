import React, {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
	memo,
} from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import { inArray, eq, and } from "drizzle-orm";

import { Card } from "@/popup/components/ui/card";
import { Badge } from "@/popup/components/ui/badge";
import { Button } from "@/popup/components/ui/button";
import {
	Loader2,
	ArrowRight,
	X,
	Trash2,
	ZoomIn,
	ZoomOut,
	Maximize2,
	Package,
} from "lucide-react";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/popup/components/ui/tabs";
import { serviceManager } from "@/services";
import type { Node, Edge } from "@/services/database/types";
import { logError, logInfo } from "@/utils/logger";
import { useTheme } from "@/popup/components/molecules/ThemeContext";
import { cn } from "@/lib/utils";

// D3 Node and Edge types
interface D3Node extends d3.SimulationNodeDatum {
	id: string;
	name: string;
	nodeType: string;
	summary?: string;
	group: number;
	radius: number;
	// Store original position for spring force
	originalX?: number;
	originalY?: number;
}

interface D3Edge {
	source: string | D3Node;
	target: string | D3Node;
	id: string;
	edgeType: string;
	factText?: string;
	weight: number;
}

interface GraphData {
	nodes: D3Node[];
	edges: D3Edge[];
}

interface ConnectedEdge {
	edge: D3Edge;
	connectedNode: D3Node;
	direction: "incoming" | "outgoing";
}

interface D3KnowledgeGraphProps {
	selectedPageId?: string;
	selectedNodeId?: string;
	graphData?: { nodes: Node[]; edges: Edge[] };
	width?: number;
	height?: number;
	onNodeDeleted?: () => void;
}

// Color palette for dynamic node coloring
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

// Generate deterministic colors for node types
const generateNodeColors = (
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

const getThemeColors = (isDark: boolean) => ({
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

const NODE_RADIUS: Record<string, number> = {
	person: 12,
	organization: 14,
	location: 10,
	event: 9,
	concept: 13,
	default: 10,
};

// Lucide Package icon (simple, clean, performant)
// Will be defined once in SVG defs and reused with <use> elements

// Memoized components
interface ControlPanelProps {
	onZoomIn: () => void;
	onZoomOut: () => void;
	onResetZoom: () => void;
	isDark: boolean;
}

const ControlPanel = memo(
	({ onZoomIn, onZoomOut, onResetZoom, isDark }: ControlPanelProps) => {
		const { t } = useTranslation("knowledge");
		return (
			<div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
				<button
					onClick={onZoomIn}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.zoomIn")}
				>
					<ZoomIn className="h-5 w-5" />
				</button>
				<button
					onClick={onZoomOut}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.zoomOut")}
				>
					<ZoomOut className="h-5 w-5" />
				</button>
				<button
					onClick={onResetZoom}
					className={cn(
						"p-2 rounded-lg shadow-lg transition-all hover:scale-110",
						isDark
							? "bg-slate-800 text-gray-200 hover:bg-slate-700 border border-gray-700"
							: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200",
					)}
					title={t("visualization.resetView")}
				>
					<Maximize2 className="h-5 w-5" />
				</button>
			</div>
		);
	},
);
ControlPanel.displayName = "ControlPanel";

interface LegendProps {
	nodeColors: Record<string, string>;
	uniqueNodeTypes: string[];
	isDark: boolean;
}

const Legend = memo(({ nodeColors, uniqueNodeTypes, isDark }: LegendProps) => {
	const { t } = useTranslation("knowledge");
	const [isVisible, setIsVisible] = useState(true);

	return (
		<div
			className={cn(
				"absolute bottom-4 left-4 rounded-lg shadow-lg z-20",
				isDark
					? "bg-slate-800/95 backdrop-blur border border-gray-700"
					: "bg-white/95 backdrop-blur border border-gray-200",
			)}
		>
			<button
				onClick={() => setIsVisible(!isVisible)}
				className={cn(
					"w-full px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide hover:bg-accent transition-colors rounded-t-lg",
					isDark
						? "text-gray-400 hover:text-gray-200"
						: "text-gray-500 hover:text-gray-700",
				)}
			>
				<span>
					{t("legend.nodeTypes")} ({uniqueNodeTypes.length})
				</span>
				<svg
					className={cn(
						"w-4 h-4 transition-transform",
						isVisible ? "rotate-180" : "",
					)}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M19 9l-7 7-7-7"
					/>
				</svg>
			</button>
			{isVisible && (
				<div className="px-3 pb-3 max-h-64 overflow-y-auto space-y-2">
					{Object.entries(nodeColors)
						.filter(([type]) => type !== "default")
						.map(([type, color]) => (
							<div key={type} className="flex items-center gap-2">
								<div
									className="w-3 h-3 rounded-full shadow-sm flex-shrink-0"
									style={{
										background: `radial-gradient(circle at 30% 30%, ${color}, ${color}dd)`,
									}}
								/>
								<span
									className={cn(
										"text-xs capitalize",
										isDark ? "text-gray-300" : "text-gray-700",
									)}
								>
									{type}
								</span>
							</div>
						))}
				</div>
			)}
		</div>
	);
});
Legend.displayName = "Legend";

interface StatsPanelProps {
	nodeCount: number;
	edgeCount: number;
	isDark: boolean;
}

const StatsPanel = memo(({ nodeCount, edgeCount, isDark }: StatsPanelProps) => {
	const { t } = useTranslation("knowledge");
	return (
		<div
			className={cn(
				"absolute bottom-4 right-4 p-3 rounded-lg shadow-lg z-20",
				isDark
					? "bg-slate-800/95 backdrop-blur text-gray-300 border border-gray-700"
					: "bg-white/95 backdrop-blur text-gray-700 border border-gray-200",
			)}
		>
			<div className="text-xs space-y-1">
				<div className="flex items-center gap-2">
					<span className="font-semibold">{t("stats.nodes")}:</span>
					<span
						className={cn(
							"font-mono",
							isDark ? "text-blue-400" : "text-blue-600",
						)}
					>
						{nodeCount}
					</span>
				</div>
				<div className="flex items-center gap-2">
					<span className="font-semibold">{t("stats.edges")}:</span>
					<span
						className={cn(
							"font-mono",
							isDark ? "text-green-400" : "text-green-600",
						)}
					>
						{edgeCount}
					</span>
				</div>
			</div>
		</div>
	);
});
StatsPanel.displayName = "StatsPanel";

interface HoverTooltipProps {
	node: D3Node;
	isDark: boolean;
}

const HoverTooltip = memo(({ node, isDark }: HoverTooltipProps) => (
	<div
		className={cn(
			"absolute pointer-events-none px-3 py-2 rounded-lg shadow-xl text-sm font-medium max-w-xs z-50",
			isDark
				? "bg-slate-900/95 text-gray-100 border border-gray-700"
				: "bg-white/95 text-gray-900 border border-gray-200",
		)}
		style={{
			left: "50%",
			top: "20%",
			transform: "translateX(-50%)",
		}}
	>
		<div className="font-bold">{node.name}</div>
		<div
			className={cn("text-xs mt-1", isDark ? "text-gray-400" : "text-gray-500")}
		>
			{node.nodeType}
		</div>
	</div>
));
HoverTooltip.displayName = "HoverTooltip";

interface SelectedNodePanelProps {
	node: D3Node;
	connectedEdges: ConnectedEdge[];
	nodeColors: Record<string, string>;
	isDark: boolean;
	onClose: () => void;
	onDelete: () => void;
	deleting: boolean;
}

const SelectedNodePanel = memo(
	({
		node,
		connectedEdges,
		nodeColors,
		isDark,
		onClose,
		onDelete,
		deleting,
	}: SelectedNodePanelProps) => {
		const { t } = useTranslation("knowledge");
		return (
			<Card
				className={cn(
					"absolute top-4 left-4 w-96 max-h-[calc(100%-2rem)] flex flex-col shadow-2xl overflow-hidden backdrop-blur-sm z-20",
					isDark
						? "bg-slate-800/98 border-gray-700"
						: "bg-white/98 border-gray-200",
				)}
			>
				<div
					className={cn(
						"p-4 border-b flex-shrink-0",
						isDark ? "border-gray-700" : "border-gray-200",
					)}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="flex items-start gap-3 flex-1 min-w-0">
							<div
								className="w-8 h-8 rounded-full flex-shrink-0 shadow-lg"
								style={{
									background: `radial-gradient(circle at 30% 30%, ${
										nodeColors[node.nodeType] || nodeColors.default
									}, ${nodeColors[node.nodeType] || nodeColors.default}dd)`,
								}}
							/>
							<div className="flex-1 min-w-0">
								<h3
									className={cn(
										"font-bold text-base mb-1 break-words",
										isDark ? "text-gray-100" : "text-gray-900",
									)}
								>
									{node.name}
								</h3>
								<Badge variant="secondary" className="text-xs capitalize">
									{node.nodeType}
								</Badge>
							</div>
						</div>
						<div className="flex items-center gap-1 flex-shrink-0">
							<Button
								variant="ghost"
								size="sm"
								onClick={onDelete}
								disabled={deleting}
								className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
								title={t("node.delete")}
							>
								{deleting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Trash2 className="h-4 w-4" />
								)}
							</Button>
							<button
								onClick={onClose}
								className={cn(
									"p-1.5 rounded-md transition-colors flex-shrink-0",
									isDark
										? "text-gray-400 hover:text-gray-200 hover:bg-gray-700"
										: "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
								)}
								title={t("actions.close")}
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>

				<div className="flex-1 overflow-hidden flex flex-col min-h-0">
					<Tabs
						defaultValue="summary"
						className="flex-1 flex flex-col overflow-hidden min-h-0"
					>
						<TabsList
							className={cn(
								"grid grid-cols-2 mx-3 mt-3 mb-0 h-11 flex-shrink-0",
								isDark ? "bg-slate-900/50" : "bg-gray-100",
							)}
						>
							<TabsTrigger
								value="summary"
								className={cn(
									"rounded-md font-medium text-sm transition-all data-[state=active]:shadow-sm",
									isDark
										? "data-[state=active]:bg-slate-700 data-[state=active]:text-gray-100"
										: "data-[state=active]:bg-white data-[state=active]:text-gray-900",
								)}
							>
								{t("node.summary")}
							</TabsTrigger>
							<TabsTrigger
								value="edges"
								className={cn(
									"rounded-md font-medium text-sm transition-all data-[state=active]:shadow-sm",
									isDark
										? "data-[state=active]:bg-slate-700 data-[state=active]:text-gray-100"
										: "data-[state=active]:bg-white data-[state=active]:text-gray-900",
								)}
							>
								{t("node.edges")} ({connectedEdges.length})
							</TabsTrigger>
						</TabsList>

						<TabsContent
							value="summary"
							className="flex-1 m-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
						>
							<div className="flex-1 min-h-0 overflow-auto py-4 pl-4 pr-3">
								{node.summary ? (
									<p
										className={cn(
											"text-sm leading-relaxed",
											isDark ? "text-gray-300" : "text-gray-700",
										)}
									>
										{node.summary}
									</p>
								) : (
									<p
										className={cn(
											"text-sm italic",
											isDark ? "text-gray-500" : "text-gray-400",
										)}
									>
										{t("node.noSummary")}
									</p>
								)}
							</div>
						</TabsContent>

						<TabsContent
							value="edges"
							className="flex-1 m-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col"
						>
							<div className="flex-1 min-h-0 overflow-auto py-4 pl-4 pr-3">
								{connectedEdges.length === 0 ? (
									<p
										className={cn(
											"text-sm italic",
											isDark ? "text-gray-500" : "text-gray-400",
										)}
									>
										{t("node.noEdges")}
									</p>
								) : (
									<div className="space-y-3">
										{connectedEdges.map((connection, index) => (
											<div
												key={`${connection.edge.id}-${index}`}
												className={cn(
													"rounded-lg p-3 border transition-colors hover:scale-[1.02]",
													isDark
														? "bg-slate-900/50 border-gray-700 hover:bg-slate-900"
														: "bg-gray-50 border-gray-200 hover:bg-gray-100",
												)}
											>
												<div className="flex items-center gap-2 mb-2">
													{connection.direction === "outgoing" ? (
														<>
															<span
																className={cn(
																	"font-semibold text-xs",
																	isDark ? "text-blue-400" : "text-blue-600",
																)}
															>
																{node.name}
															</span>
															<ArrowRight
																className={cn(
																	"h-3 w-3",
																	isDark ? "text-gray-500" : "text-gray-400",
																)}
															/>
															<span
																className={cn(
																	"font-semibold text-xs",
																	isDark ? "text-green-400" : "text-green-600",
																)}
															>
																{connection.connectedNode.name}
															</span>
														</>
													) : (
														<>
															<span
																className={cn(
																	"font-semibold text-xs",
																	isDark ? "text-green-400" : "text-green-600",
																)}
															>
																{connection.connectedNode.name}
															</span>
															<ArrowRight
																className={cn(
																	"h-3 w-3",
																	isDark ? "text-gray-500" : "text-gray-400",
																)}
															/>
															<span
																className={cn(
																	"font-semibold text-xs",
																	isDark ? "text-blue-400" : "text-blue-600",
																)}
															>
																{node.name}
															</span>
														</>
													)}
												</div>

												<div className="flex items-center gap-2 flex-wrap">
													<Badge variant="outline" className="text-xs">
														{connection.edge.edgeType}
													</Badge>
													<span
														className={cn(
															"text-xs",
															isDark ? "text-gray-400" : "text-gray-500",
														)}
													>
														{connection.direction === "outgoing"
															? t("edge.outgoing")
															: t("edge.incoming")}
													</span>
												</div>

												{connection.edge.factText && (
													<div
														className={cn(
															"mt-2 text-xs p-2 rounded border",
															isDark
																? "bg-slate-950 border-gray-700 text-gray-300"
																: "bg-white border-gray-200 text-gray-600",
														)}
													>
														{connection.edge.factText}
													</div>
												)}
											</div>
										))}
									</div>
								)}
							</div>
						</TabsContent>
					</Tabs>
				</div>
			</Card>
		);
	},
);
SelectedNodePanel.displayName = "SelectedNodePanel";

export const D3KnowledgeGraph: React.FC<D3KnowledgeGraphProps> = ({
	selectedPageId,
	selectedNodeId,
	graphData: externalGraphData,
	width = 800,
	height = 600,
	onNodeDeleted,
}) => {
	const { t } = useTranslation("knowledge");
	const svgRef = useRef<SVGSVGElement>(null);
	const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);
	const zoomBehaviorRef = useRef<d3.ZoomBehavior<
		SVGSVGElement,
		unknown
	> | null>(null);
	const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	const [loading, setLoading] = useState(true);
	const [graphData, setGraphData] = useState<GraphData>({
		nodes: [],
		edges: [],
	});
	const [error, setError] = useState<string | null>(null);
	const [selectedNode, setSelectedNode] = useState<D3Node | null>(null);
	const [hoveredNode, setHoveredNode] = useState<D3Node | null>(null);
	const [hoveredEdge, setHoveredEdge] = useState<D3Edge | null>(null);
	const [highlightedEdgeFromPanel, setHighlightedEdgeFromPanel] = useState<
		string | null
	>(null);
	const [connectedEdges, setConnectedEdges] = useState<ConnectedEdge[]>([]);
	const [deleting, setDeleting] = useState(false);

	const { actualTheme } = useTheme();
	const isDark = actualTheme === "dark";

	const themeColors = useMemo(() => getThemeColors(isDark), [isDark]);

	const uniqueNodeTypes = useMemo(() => {
		const types = new Set(graphData.nodes.map((node) => node.nodeType));
		return Array.from(types).sort();
	}, [graphData.nodes]);

	const nodeColors = useMemo(
		() => generateNodeColors(uniqueNodeTypes, isDark),
		[uniqueNodeTypes, isDark],
	);

	useEffect(() => {
		return () => {
			if (simulationRef.current) {
				simulationRef.current.stop();
			}
			if (hoverTimeoutRef.current) {
				clearTimeout(hoverTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		loadGraphData();
	}, [selectedPageId, externalGraphData]);

	useEffect(() => {
		if (graphData.nodes.length > 0) {
			renderGraph();
		}
	}, [graphData, width, height, isDark]);

	// Update styling when selection or hover changes
	useEffect(() => {
		if (!svgRef.current) return;

		const svg = d3.select(svgRef.current);
		const connectedNodeIds = new Set<string>();
		const connectedEdgeIds = new Set<string>();

		if (selectedNode) {
			connectedNodeIds.add(selectedNode.id);
			graphData.edges.forEach((edge) => {
				const sourceId =
					typeof edge.source === "string" ? edge.source : edge.source.id;
				const targetId =
					typeof edge.target === "string" ? edge.target : edge.target.id;

				if (sourceId === selectedNode.id) {
					connectedNodeIds.add(targetId);
					connectedEdgeIds.add(edge.id);
				} else if (targetId === selectedNode.id) {
					connectedNodeIds.add(sourceId);
					connectedEdgeIds.add(edge.id);
				}
			});
		}

		svg
			.selectAll<SVGGElement, D3Node>("g.node-group")
			.style("opacity", (d: D3Node) => {
				if (!selectedNode) return hoveredNode?.id === d.id ? 1 : 0.85;
				if (selectedNode.id === d.id) return 1;
				return connectedNodeIds.has(d.id) ? 0.85 : 0.3;
			})
			.style("transition", "opacity 0.3s ease");

		svg
			.selectAll<SVGCircleElement, D3Node>("circle.node")
			.attr("stroke", (d: D3Node) => {
				if (selectedNode?.id === d.id) return themeColors.strokeHover;
				if (hoveredNode?.id === d.id) return themeColors.linkStrokeHover;
				return themeColors.stroke;
			})
			.attr("stroke-width", (d: D3Node) => {
				if (selectedNode?.id === d.id) return 2;
				if (hoveredNode?.id === d.id) return 2.5;
				return 1.5;
			});

		svg
			.selectAll<SVGPathElement, D3Edge>("path.link")
			.attr("stroke", (d: D3Edge) => {
				if (hoveredEdge?.id === d.id) return themeColors.linkStrokeHover;
				if (selectedNode && connectedEdgeIds.has(d.id))
					return themeColors.linkStrokeHover;
				return themeColors.linkStroke;
			})
			.attr("stroke-width", (d: D3Edge) => {
				if (hoveredEdge?.id === d.id) return 2;
				if (selectedNode && connectedEdgeIds.has(d.id)) return 1.5;
				return 1;
			})
			.attr("opacity", (d: D3Edge) => {
				if (hoveredEdge?.id === d.id) return 1;
				if (!selectedNode) return 0.6;
				return connectedEdgeIds.has(d.id) ? 0.8 : 0.15;
			})
			.style("transition", "opacity 0.3s ease, stroke 0.3s ease");
	}, [selectedNode, hoveredNode, hoveredEdge, themeColors, graphData.edges]);

	const loadGraphData = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			if (externalGraphData) {
				const d3Nodes: D3Node[] = externalGraphData.nodes.map(
					(node, index) => ({
						id: node.id,
						name: node.name,
						nodeType: node.nodeType,
						summary: node.summary || undefined,
						group: hash(node.nodeType || "default") % 6,
						radius: NODE_RADIUS[node.nodeType] || NODE_RADIUS.default,
						x:
							400 +
							Math.cos((index * 2 * Math.PI) / externalGraphData.nodes.length) *
								150,
						y:
							300 +
							Math.sin((index * 2 * Math.PI) / externalGraphData.nodes.length) *
								150,
					}),
				);

				const d3Edges: D3Edge[] = externalGraphData.edges
					.filter(
						(edge) =>
							d3Nodes.some((n) => n.id === edge.sourceId) &&
							d3Nodes.some((n) => n.id === edge.destinationId),
					)
					.map((edge) => ({
						id: edge.id,
						source: edge.sourceId,
						target: edge.destinationId,
						edgeType: edge.edgeType,
						factText: edge.factText || undefined,
						weight: 1,
					}));

				setGraphData({ nodes: d3Nodes, edges: d3Edges });
				setLoading(false);
				return;
			}

			if (!selectedPageId) {
				setGraphData({ nodes: [], edges: [] });
				setLoading(false);
				return;
			}

			const nodes = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					return await db
						.select()
						.from(schema.nodes)
						.where(eq(schema.nodes.graph, selectedPageId || ""));
				},
			);

			const edges = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					return await db
						.select()
						.from(schema.edges)
						.where(eq(schema.edges.graph, selectedPageId || ""));
				},
			);

			const d3Nodes: D3Node[] = nodes.map((node, index) => ({
				id: node.id,
				name: node.name,
				nodeType: node.nodeType,
				summary: node.summary || undefined,
				group: hash(node.nodeType || "default") % 6,
				radius: NODE_RADIUS[node.nodeType] || NODE_RADIUS.default,
				x: 400 + Math.cos((index * 2 * Math.PI) / nodes.length) * 150,
				y: 300 + Math.sin((index * 2 * Math.PI) / nodes.length) * 150,
			}));

			const d3Edges: D3Edge[] = edges
				.filter(
					(edge) =>
						d3Nodes.some((n) => n.id === edge.sourceId) &&
						d3Nodes.some((n) => n.id === edge.destinationId),
				)
				.map((edge) => ({
					id: edge.id,
					source: edge.sourceId,
					target: edge.destinationId,
					edgeType: edge.edgeType,
					factText: edge.factText || undefined,
					weight: 1,
				}));

			setGraphData({ nodes: d3Nodes, edges: d3Edges });
		} catch (err) {
			logError("Failed to load graph data:", err);
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, [selectedPageId, externalGraphData]);

	const nodeMap = useMemo(() => {
		const map = new Map<string, D3Node>();
		graphData.nodes.forEach((node) => map.set(node.id, node));
		return map;
	}, [graphData.nodes]);

	const getConnectedEdges = useCallback(
		(node: D3Node): ConnectedEdge[] => {
			const connected: ConnectedEdge[] = [];

			graphData.edges.forEach((edge) => {
				const sourceId =
					typeof edge.source === "string" ? edge.source : edge.source.id;
				const targetId =
					typeof edge.target === "string" ? edge.target : edge.target.id;

				if (sourceId === node.id) {
					const targetNode = nodeMap.get(targetId);
					if (targetNode) {
						connected.push({
							edge,
							connectedNode: targetNode,
							direction: "outgoing",
						});
					}
				} else if (targetId === node.id) {
					const sourceNode = nodeMap.get(sourceId);
					if (sourceNode) {
						connected.push({
							edge,
							connectedNode: sourceNode,
							direction: "incoming",
						});
					}
				}
			});

			return connected;
		},
		[graphData.edges, nodeMap],
	);

	const handleNodeClick = useCallback(
		(node: D3Node) => {
			setSelectedNode((prev) => {
				if (prev?.id === node.id) {
					setConnectedEdges([]);
					return null;
				}
				setConnectedEdges(getConnectedEdges(node));
				return node;
			});
		},
		[getConnectedEdges],
	);

	const handleNodeHover = useCallback((node: D3Node | null) => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current);
		}
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredNode(node);
		}, 50);
	}, []);

	const handleEdgeHover = useCallback((edge: D3Edge | null) => {
		if (hoverTimeoutRef.current) {
			clearTimeout(hoverTimeoutRef.current);
		}
		hoverTimeoutRef.current = setTimeout(() => {
			setHoveredEdge(edge);
		}, 50);
	}, []);

	const handleDeleteNode = useCallback(async () => {
		if (!selectedNode) return;

		try {
			setDeleting(true);

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				const edgesToDelete = await db
					.select()
					.from(schema.edges)
					.where(
						and(
							eq(schema.edges.graph, selectedPageId || ""),
							inArray(schema.edges.sourceId, [selectedNode.id]),
						),
					);

				const edgeIds = edgesToDelete.map((e) => e.id);
				if (edgeIds.length > 0) {
					await db
						.delete(schema.edges)
						.where(inArray(schema.edges.id, edgeIds));
				}

				await db
					.delete(schema.nodes)
					.where(eq(schema.nodes.id, selectedNode.id));
			});

			setSelectedNode(null);
			setConnectedEdges([]);
			loadGraphData();

			if (onNodeDeleted) {
				onNodeDeleted();
			}
		} catch (error) {
			logError("Failed to delete node:", error);
		} finally {
			setDeleting(false);
		}
	}, [selectedNode, selectedPageId, onNodeDeleted, loadGraphData]);

	const handleZoomIn = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			const svg = d3.select(svgRef.current);
			svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
		}
	}, []);

	const handleZoomOut = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			const svg = d3.select(svgRef.current);
			svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.7);
		}
	}, []);

	const handleResetZoom = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			const svg = d3.select(svgRef.current);
			svg
				.transition()
				.duration(500)
				.call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
		}
	}, []);

	const renderGraph = useCallback(() => {
		if (!svgRef.current) return;

		const svg = d3.select(svgRef.current);
		svg.selectAll("*").remove();

		if (graphData.nodes.length === 0) return;

		const g = svg.append("g");

		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 8])
			.on("zoom", (event) => {
				g.attr("transform", event.transform);
			});

		zoomBehaviorRef.current = zoom;
		svg.call(zoom);

		const defs = svg.append("defs");

		// Define arrow marker
		defs
			.append("marker")
			.attr("id", "arrowhead")
			.attr("viewBox", "0 -5 10 10")
			.attr("refX", 18)
			.attr("refY", 0)
			.attr("markerWidth", 4)
			.attr("markerHeight", 4)
			.attr("orient", "auto")
			.append("path")
			.attr("d", "M0,-4L8,0L0,4")
			.attr("fill", themeColors.linkStroke)
			.attr("opacity", 0.7);

		// Define Package icon as a reusable symbol (define once, use many times)
		const iconSymbol = defs
			.append("symbol")
			.attr("id", "package-icon")
			.attr("viewBox", "0 0 24 24");

		// Add package icon paths to symbol
		iconSymbol
			.append("path")
			.attr("d", "m7.5 4.27 9 5.15")
			.attr("fill", "none")
			.attr("stroke", "currentColor")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round");

		iconSymbol
			.append("path")
			.attr(
				"d",
				"M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
			)
			.attr("fill", "none")
			.attr("stroke", "currentColor")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round");

		iconSymbol
			.append("path")
			.attr("d", "m3.3 7 8.7 5 8.7-5")
			.attr("fill", "none")
			.attr("stroke", "currentColor")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round");

		iconSymbol
			.append("path")
			.attr("d", "M12 22V12")
			.attr("fill", "none")
			.attr("stroke", "currentColor")
			.attr("stroke-width", 2)
			.attr("stroke-linecap", "round")
			.attr("stroke-linejoin", "round");

		// Store initial positions for spring force
		graphData.nodes.forEach((node) => {
			if (node.originalX === undefined) {
				node.originalX = node.x || 0;
			}
			if (node.originalY === undefined) {
				node.originalY = node.y || 0;
			}
		});

		// Extremely subtle spring force - respects user's dropped position
		const springForce = (alpha: number) => {
			const springStrength = 0.005; // Barely noticeable pull (reduced from 0.02)
			const minDistance = 100; // Only apply if node is very far
			const maxDistance = 300; // Maximum distance for force scaling

			graphData.nodes.forEach((node) => {
				if (node.originalX !== undefined && node.originalY !== undefined) {
					if (!node.fx && !node.fy) {
						// Calculate distance from original position
						const dx = node.originalX - (node.x || 0);
						const dy = node.originalY - (node.y || 0);
						const distance = Math.sqrt(dx * dx + dy * dy);

						// Only apply force if node is very far from original position
						// Most dropped positions stay exactly where user placed them
						if (distance > minDistance) {
							const forceFactor = Math.min(
								(distance - minDistance) / (maxDistance - minDistance),
								1,
							);
							const adjustedStrength = springStrength * forceFactor;

							node.vx = (node.vx || 0) + dx * adjustedStrength * alpha;
							node.vy = (node.vy || 0) + dy * adjustedStrength * alpha;
						}
					}
				}
			});
		};

		const simulation = d3
			.forceSimulation<D3Node>(graphData.nodes)
			.force("charge", d3.forceManyBody().strength(-100))
			.force("center", d3.forceCenter(width / 2, height / 2))
			.force(
				"collision",
				d3.forceCollide().radius((d) => 2),
			)
			.force("spring", springForce); // Add spring force

		if (graphData.edges.length > 0) {
			simulation.force(
				"link",
				d3
					.forceLink<D3Node, D3Edge>(graphData.edges)
					.id((d) => d.id)
					.distance(90)
					.strength(0.3),
			);
		}

		simulationRef.current = simulation;

		const links = g
			.selectAll<SVGPathElement, D3Edge>("path.link")
			.data(graphData.edges)
			.enter()
			.append("path")
			.attr("class", "link")
			.attr("stroke", themeColors.linkStroke)
			.attr("stroke-width", 1)
			.attr("fill", "none")
			.attr("opacity", 0.6)
			.attr("marker-end", "url(#arrowhead)")
			.style("cursor", "pointer")
			.on("mouseenter", (_event, d) => handleEdgeHover(d))
			.on("mouseleave", () => handleEdgeHover(null));

		const nodeGroups = g
			.selectAll<SVGGElement, D3Node>("g.node-group")
			.data(graphData.nodes)
			.enter()
			.append("g")
			.attr("class", "node-group");

		nodeGroups
			.append("circle")
			.attr("class", "node-hit-area")
			.attr("r", (d) => d.radius + 12)
			.attr("fill", "transparent")
			.attr("cursor", "pointer");

		nodeGroups
			.append("circle")
			.attr("class", "node")
			.attr("r", (d) => d.radius)
			.attr("fill", (d) => nodeColors[d.nodeType] || nodeColors.default)
			.attr("stroke", themeColors.stroke)
			.attr("stroke-width", 2.5)
			.attr("pointer-events", "none");

		// Add package icon using <use> to reference the symbol (very performant)
		nodeGroups
			.append("use")
			.attr("href", "#package-icon")
			.attr("class", "node-icon")
			.attr("x", (d) => -d.radius * 0.5)
			.attr("y", (d) => -d.radius * 0.5)
			.attr("width", (d) => d.radius)
			.attr("height", (d) => d.radius)
			.attr("color", "rgba(255,255,255,0.95)")
			.attr("filter", "drop-shadow(0 1px 2px rgba(0,0,0,0.3))")
			.attr("pointer-events", "none");

		nodeGroups
			.append("text")
			.attr("text-anchor", "middle")
			.attr("dy", (d) => d.radius + 16)
			.attr("font-size", "11px")
			.attr("font-weight", "600")
			.attr("font-family", "system-ui, sans-serif")
			.attr("fill", themeColors.text)
			.attr("pointer-events", "none")
			.style(
				"text-shadow",
				isDark
					? "0 1px 2px rgba(0,0,0,0.8)"
					: "0 1px 2px rgba(255,255,255,0.8)",
			)
			.text((d) =>
				d.name.length > 15 ? d.name.substring(0, 15) + "..." : d.name,
			);

		nodeGroups.attr("opacity", 0.85);

		nodeGroups
			.on("mouseenter", (_event, d) => handleNodeHover(d))
			.on("mouseleave", () => handleNodeHover(null))
			.on("click", (event, d) => {
				event.stopPropagation();
				handleNodeClick(d);
			})
			.style("cursor", "grab")
			.call(
				d3
					.drag<SVGGElement, D3Node>()
					.on("start", (event, d) => {
						if (!event.active) simulation.alphaTarget(0.3).restart();
						d.fx = d.x;
						d.fy = d.y;
						d3.select(event.currentTarget as SVGGElement).style(
							"cursor",
							"grabbing",
						);
					})
					.on("drag", (event, d) => {
						d.fx = event.x;
						d.fy = event.y;
					})
					.on("end", (event, d) => {
						if (!event.active) simulation.alphaTarget(0);

						// Release the node to let spring force pull it back
						// Add a slight delay so the drag position is registered
						setTimeout(() => {
							d.fx = null;
							d.fy = null;
							// Restart simulation to animate spring effect
							simulation.alpha(0.3).restart();
						}, 100);

						d3.select(event.currentTarget as SVGGElement).style(
							"cursor",
							"grab",
						);
					}),
			);

		simulation.on("tick", () => {
			links.attr("d", (d) => {
				const source = d.source as D3Node;
				const target = d.target as D3Node;
				return `M${source.x},${source.y}L${target.x},${target.y}`;
			});

			nodeGroups.attr("transform", (d) => `translate(${d.x},${d.y})`);
		});

		setTimeout(() => {
			const bounds = g.node()?.getBBox();
			if (bounds && bounds.width > 0 && bounds.height > 0) {
				const fullWidth = bounds.width;
				const fullHeight = bounds.height;
				const scale = Math.min(width / fullWidth, height / fullHeight) * 0.75;
				const translate = [
					width / 2 - scale * (bounds.x + fullWidth / 2),
					height / 2 - scale * (bounds.y + fullHeight / 2),
				];

				svg.call(
					zoom.transform,
					d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale),
				);
			}
		}, 100);
	}, [
		graphData,
		width,
		height,
		themeColors,
		nodeColors,
		handleNodeHover,
		handleEdgeHover,
		handleNodeClick,
		isDark,
	]);

	const hash = (str: string): number => {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
				<span className="ml-2 text-gray-600">{t("loading")}</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full text-red-600">
				<p>{t("error", { error })}</p>
			</div>
		);
	}

	if (graphData.nodes.length === 0) {
		return (
			<div className="flex items-center justify-center h-full text-gray-500">
				<p>{t("empty.noNodes")}</p>
			</div>
		);
	}

	return (
		<div className="relative w-full h-full">
			<svg
				ref={svgRef}
				width="100%"
				height="100%"
				viewBox={`0 0 ${width} ${height}`}
				className={cn(
					"border rounded-lg transition-colors",
					isDark
						? "border-gray-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800"
						: "border-gray-200 bg-gray-50",
				)}
			/>

			<ControlPanel
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				onResetZoom={handleResetZoom}
				isDark={isDark}
			/>

			<Legend
				nodeColors={nodeColors}
				uniqueNodeTypes={uniqueNodeTypes}
				isDark={isDark}
			/>

			<StatsPanel
				nodeCount={graphData.nodes.length}
				edgeCount={graphData.edges.length}
				isDark={isDark}
			/>

			{selectedNode && (
				<SelectedNodePanel
					node={selectedNode}
					connectedEdges={connectedEdges}
					nodeColors={nodeColors}
					isDark={isDark}
					onClose={() => {
						setSelectedNode(null);
						setConnectedEdges([]);
					}}
					onDelete={handleDeleteNode}
					deleting={deleting}
				/>
			)}

			{hoveredNode && !selectedNode && (
				<HoverTooltip node={hoveredNode} isDark={isDark} />
			)}
		</div>
	);
};
