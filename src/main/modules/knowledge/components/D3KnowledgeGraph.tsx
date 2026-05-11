import React, {
	useEffect,
	useRef,
	useState,
	useMemo,
	useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import * as d3 from "d3";
import { inArray, eq, and } from "drizzle-orm";

import { Loader2 } from "lucide-react";
import { serviceManager } from "@/services";
import { logError } from "@/utils/logger";
import { useTheme } from "@/main/components/molecules/ThemeContext";
import { cn } from "@/lib/utils";

import type {
	D3Node,
	D3Edge,
	GraphData,
	ConnectedEdge,
	D3KnowledgeGraphProps,
} from "./types";
import {
	NODE_RADIUS,
	generateNodeColors,
	getThemeColors,
	hashString,
} from "./constants";
import { ControlPanel } from "./ControlPanel";
import { Legend } from "./Legend";
import { StatsPanel } from "./StatsPanel";
import { HoverTooltip } from "./HoverTooltip";
import { SelectedNodePanel } from "./SelectedNodePanel";

export const D3KnowledgeGraph: React.FC<D3KnowledgeGraphProps> = ({
	selectedPageId,
	selectedNodeId,
	graphData: externalGraphData,
	width = 800,
	height = 600,
	variant = "default",
	onNodeDeleted,
	onEdgeDeleted,
	onNodeSelect,
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
	const [connectedEdges, setConnectedEdges] = useState<ConnectedEdge[]>([]);
	const [deleting, setDeleting] = useState(false);
	const [deletingEdgeId, setDeletingEdgeId] = useState<string | null>(null);

	const { actualTheme } = useTheme();
	const isDark = actualTheme === "dark";
	const isInline = variant === "inline";

	const themeColors = useMemo(() => getThemeColors(isDark), [isDark]);

	const uniqueNodeTypes = useMemo(() => {
		const types = new Set(graphData.nodes.map((node) => node.nodeType));
		return Array.from(types).sort();
	}, [graphData.nodes]);

	const nodeColors = useMemo(
		() => generateNodeColors(uniqueNodeTypes, isDark),
		[uniqueNodeTypes, isDark],
	);

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

	useEffect(() => {
		return () => {
			if (simulationRef.current) simulationRef.current.stop();
			if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		loadGraphData();
	}, [selectedPageId, externalGraphData]);

	useEffect(() => {
		if (graphData.nodes.length > 0) renderGraph();
	}, [graphData, width, height, isDark]);

	useEffect(() => {
		if (selectedNodeId && graphData.nodes.length > 0) {
			const node = graphData.nodes.find((n) => n.id === selectedNodeId);
			if (node) {
				setSelectedNode(node);
				setConnectedEdges(getConnectedEdges(node));
			}
		}
	}, [selectedNodeId, graphData.nodes, getConnectedEdges]);

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
						group: hashString(node.nodeType || "default") % 6,
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
				group: hashString(node.nodeType || "default") % 6,
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

	const handleNodeClick = useCallback(
		(node: D3Node) => {
			setSelectedNode((prev) => {
				if (prev?.id === node.id) {
					setConnectedEdges([]);
					onNodeSelect?.(null);
					return null;
				}
				setConnectedEdges(getConnectedEdges(node));
				onNodeSelect?.(node.id);
				return node;
			});
		},
		[getConnectedEdges, onNodeSelect],
	);

	const handleNodeHover = useCallback((node: D3Node | null) => {
		if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
		hoverTimeoutRef.current = setTimeout(() => setHoveredNode(node), 50);
	}, []);

	const handleEdgeHover = useCallback((edge: D3Edge | null) => {
		if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
		hoverTimeoutRef.current = setTimeout(() => setHoveredEdge(edge), 50);
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

			if (onNodeDeleted) onNodeDeleted();
		} catch (error) {
			logError("Failed to delete node:", error);
		} finally {
			setDeleting(false);
		}
	}, [selectedNode, selectedPageId, onNodeDeleted, loadGraphData]);

	const handleDeleteEdge = useCallback(
		async (edgeId: string) => {
			const confirmed = window.confirm(t("edge.deleteConfirm"));
			if (!confirmed) return;

			try {
				setDeletingEdgeId(edgeId);

				if (onEdgeDeleted) {
					await onEdgeDeleted(edgeId);
				} else {
					await serviceManager.databaseService.use(async ({ db, schema }) => {
						await db.delete(schema.edges).where(eq(schema.edges.id, edgeId));
					});
					await loadGraphData();
				}

				setConnectedEdges((prev) =>
					prev.filter((connection) => connection.edge.id !== edgeId),
				);
			} catch (error) {
				logError("Failed to delete edge:", error);
			} finally {
				setDeletingEdgeId(null);
			}
		},
		[onEdgeDeleted, loadGraphData, t],
	);

	const handleZoomIn = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			d3.select(svgRef.current)
				.transition()
				.duration(300)
				.call(zoomBehaviorRef.current.scaleBy, 1.3);
		}
	}, []);

	const handleZoomOut = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			d3.select(svgRef.current)
				.transition()
				.duration(300)
				.call(zoomBehaviorRef.current.scaleBy, 0.7);
		}
	}, []);

	const handleResetZoom = useCallback(() => {
		if (svgRef.current && zoomBehaviorRef.current) {
			d3.select(svgRef.current)
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

		const iconSymbol = defs
			.append("symbol")
			.attr("id", "package-icon")
			.attr("viewBox", "0 0 24 24");

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

		graphData.nodes.forEach((node) => {
			if (node.originalX === undefined) node.originalX = node.x || 0;
			if (node.originalY === undefined) node.originalY = node.y || 0;
		});

		const springForce = (alpha: number) => {
			const springStrength = 0.005;
			const minDistance = 100;
			const maxDistance = 300;

			graphData.nodes.forEach((node) => {
				if (node.originalX !== undefined && node.originalY !== undefined) {
					if (!node.fx && !node.fy) {
						const dx = node.originalX - (node.x || 0);
						const dy = node.originalY - (node.y || 0);
						const distance = Math.sqrt(dx * dx + dy * dy);

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
				d3.forceCollide().radius(() => 2),
			)
			.force("spring", springForce);

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
						setTimeout(() => {
							d.fx = null;
							d.fy = null;
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
					"transition-colors",
					isInline
						? "bg-transparent"
						: cn(
								"border rounded-lg",
								isDark
									? "border-gray-700 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800"
									: "border-gray-200 bg-gray-50",
							),
				)}
			/>

			{!isInline && (
				<ControlPanel
					onZoomIn={handleZoomIn}
					onZoomOut={handleZoomOut}
					onResetZoom={handleResetZoom}
					isDark={isDark}
				/>
			)}

			{!isInline && (
				<Legend
					nodeColors={nodeColors}
					uniqueNodeTypes={uniqueNodeTypes}
					isDark={isDark}
				/>
			)}

			{!isInline && (
				<StatsPanel
					nodeCount={graphData.nodes.length}
					edgeCount={graphData.edges.length}
					isDark={isDark}
				/>
			)}

			{selectedNode && (
				<SelectedNodePanel
					node={selectedNode}
					connectedEdges={connectedEdges}
					nodeColors={nodeColors}
					isDark={isDark}
					onClose={() => {
						setSelectedNode(null);
						setConnectedEdges([]);
						onNodeSelect?.(null);
					}}
					onDelete={handleDeleteNode}
					onDeleteEdge={handleDeleteEdge}
					deletingEdgeId={deletingEdgeId}
					deleting={deleting}
				/>
			)}

			{hoveredNode && !selectedNode && (
				<HoverTooltip node={hoveredNode} isDark={isDark} />
			)}
		</div>
	);
};
