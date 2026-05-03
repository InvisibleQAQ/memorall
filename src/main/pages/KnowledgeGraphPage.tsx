import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
	Search,
	Network,
	Plus,
	MoreHorizontal,
	Pencil,
	Trash2,
	Tags,
	Loader2,
} from "lucide-react";
import { eq, sql, or } from "drizzle-orm";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";

import { ScrollArea } from "@/main/components/ui/scroll-area";
import { Input } from "@/main/components/ui/input";
import { Badge } from "@/main/components/ui/badge";
import { Button } from "@/main/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import { PageHeader } from "@/main/components/ui/page-header";

import { D3KnowledgeGraph } from "@/main/modules/knowledge/components/D3KnowledgeGraph";
import {
	CreateTopicDialog,
	EditTopicDialog,
} from "@/main/modules/topics/modals";
import { topicService } from "@/main/modules/topics/services/topic-service";
import type { Topic } from "@/services/database/entities/topics";
import type {
	GrowType,
	RecallType,
} from "@/services/database/entities/topic-types";
import type { Node, Edge } from "@/services/database/types";
import { serviceManager } from "@/services";
import { logError, logInfo } from "@/utils/logger";

type TopicWithCount = Topic & { fileCount: number };

const DEFAULT_TOPIC_ID = "default" as const;
const PANEL_STORAGE_KEY = "memorall.knowledge.workspace-panels.v2";
const DEFAULT_PANEL_SIZES = [22, 78] as const;
const MIN_PANEL_SIZES = [16, 36] as const;
const DESKTOP_BREAKPOINT = 1180;
const DESKTOP_SEPARATOR_TRACK = 2;

const clampPair = (
	nextPrimary: number,
	total: number,
	minPrimary: number,
	minSecondary: number,
): [number, number] => {
	const clampedPrimary = Math.min(
		total - minSecondary,
		Math.max(minPrimary, nextPrimary),
	);
	return [clampedPrimary, total - clampedPrimary];
};

const readStoredPanelSizes = (): [number, number] => {
	if (typeof window === "undefined") return [...DEFAULT_PANEL_SIZES];
	try {
		const raw = window.localStorage.getItem(PANEL_STORAGE_KEY);
		if (!raw) return [...DEFAULT_PANEL_SIZES];
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.length === 2 &&
			parsed.every((value) => typeof value === "number")
		) {
			return [parsed[0], parsed[1]];
		}
	} catch {
		// Fall back to defaults when localStorage is unavailable or corrupt.
	}
	return [...DEFAULT_PANEL_SIZES];
};

const GROW_LABELS: Record<GrowType, string> = {
	"knowledge-graph": "Graph",
	structmem: "StructMem",
};

const RECALL_LABELS: Record<RecallType, string> = {
	smart: "Smart",
	quick: "Quick",
	llm: "LLM",
	structmem: "StructMem",
};

// ---------------------------------------------------------------------------
// TopicRow – clickable sidebar row for selecting / managing a topic
// ---------------------------------------------------------------------------

interface TopicRowProps {
	name: string;
	fileCount?: number;
	growType?: GrowType;
	recallType?: RecallType;
	isSelected: boolean;
	isDefault?: boolean;
	isDeleting?: boolean;
	onSelect: () => void;
	onEdit?: () => void;
	onDelete?: () => void;
}

const TopicRow: React.FC<TopicRowProps> = ({
	name,
	fileCount,
	growType,
	recallType,
	isSelected,
	isDefault = false,
	isDeleting = false,
	onSelect,
	onEdit,
	onDelete,
}) => {
	const { t } = useTranslation("topics");

	return (
		<div
			className={`group flex items-center gap-1 px-3 py-1.5 cursor-pointer transition-colors hover:bg-muted/50 ${
				isSelected ? "bg-accent border-r-2 border-primary" : ""
			}`}
			onClick={onSelect}
		>
			<div className="flex-1 min-w-0 flex items-center gap-2">
				<span
					className={`text-sm truncate ${
						isSelected ? "font-medium text-foreground" : "text-muted-foreground"
					}`}
				>
					{name}
				</span>
				{typeof fileCount === "number" && !isDefault && (
					<Badge
						variant="secondary"
						className="text-xs shrink-0 h-4 px-1.5 py-0 leading-none"
					>
						{fileCount}
					</Badge>
				)}
				{growType && recallType && !isDefault && (
					<div className="flex items-center gap-1 shrink-0">
						<Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
							{GROW_LABELS[growType]}
						</Badge>
						<Badge variant="outline" className="text-[10px] h-4 px-1 py-0">
							{RECALL_LABELS[recallType]}
						</Badge>
					</div>
				)}
			</div>

			{!isDefault && (onEdit || onDelete) && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
							disabled={isDeleting}
						>
							{isDeleting ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								<MoreHorizontal className="h-3 w-3" />
							)}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-32">
						{onEdit && (
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									onEdit();
								}}
							>
								<Pencil className="h-3.5 w-3.5 mr-2" />
								{t("manage.edit")}
							</DropdownMenuItem>
						)}
						{onDelete && (
							<DropdownMenuItem
								onClick={(e) => {
									e.stopPropagation();
									onDelete();
								}}
								className="text-destructive focus:text-destructive"
							>
								<Trash2 className="h-3.5 w-3.5 mr-2" />
								{t("manage.delete")}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// KnowledgeGraphPage
// ---------------------------------------------------------------------------

interface KnowledgeGraphPageProps {}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = () => {
	const { t } = useTranslation("knowledge");
	const { t: tTopics } = useTranslation("topics");
	const [searchParams, setSearchParams] = useSearchParams();

	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

	// Topics state
	const [topics, setTopics] = useState<TopicWithCount[]>([]);
	const [selectedTopicId, setSelectedTopicId] =
		useState<string>(DEFAULT_TOPIC_ID);
	const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null);
	const [panelSizes, setPanelSizes] =
		useState<[number, number]>(readStoredPanelSizes);
	const [isDesktop, setIsDesktop] = useState(false);
	const containerRef = React.useRef<HTMLDivElement | null>(null);

	const handleResizeStart = React.useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!isDesktop || !containerRef.current) return;
			event.preventDefault();
			const startX = event.clientX;
			const startSizes = panelSizes;
			const containerWidth = containerRef.current.getBoundingClientRect().width;
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";
			const handlePointerMove = (pointerEvent: MouseEvent) => {
				const deltaInFr =
					((pointerEvent.clientX - startX) / containerWidth) *
					(startSizes[0] + startSizes[1]);
				setPanelSizes(() => {
					const [left, right] = clampPair(
						startSizes[0] + deltaInFr,
						startSizes[0] + startSizes[1],
						MIN_PANEL_SIZES[0],
						MIN_PANEL_SIZES[1],
					);
					return [left, right];
				});
			};
			const handlePointerUp = () => {
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("mousemove", handlePointerMove);
				window.removeEventListener("mouseup", handlePointerUp);
			};
			window.addEventListener("mousemove", handlePointerMove);
			window.addEventListener("mouseup", handlePointerUp);
		},
		[isDesktop, panelSizes],
	);

	useEffect(() => {
		loadTopics();
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleViewportChange = () => {
			const isPopupSurface =
				document.documentElement.dataset.uiSurface === "popup";
			setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT && !isPopupSurface);
		};
		handleViewportChange();
		window.addEventListener("resize", handleViewportChange);
		return () => window.removeEventListener("resize", handleViewportChange);
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(panelSizes));
	}, [panelSizes]);

	useEffect(() => {
		const topicId = searchParams.get("topicId");
		if (topicId) {
			setSelectedTopicId(topicId);
			setSelectedNodeId(null);
		}
	}, [searchParams]);

	useEffect(() => {
		loadGraphData();
	}, [selectedTopicId]);

	const loadTopics = async () => {
		try {
			const data = await topicService.getTopicsWithContentCount();
			setTopics(data);
		} catch (error) {
			logError("Failed to load topics:", error);
		}
	};

	const loadGraphData = async () => {
		try {
			setLoading(true);
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				const graphFilter =
					selectedTopicId === DEFAULT_TOPIC_ID
						? DEFAULT_TOPIC_ID
						: selectedTopicId;

				logInfo("[KNOWLEDGE_GRAPH] Loading graph data:", {
					selectedTopicId,
					graphFilter,
					isDefault: selectedTopicId === DEFAULT_TOPIC_ID,
				});

				const filteredNodes =
					selectedTopicId === DEFAULT_TOPIC_ID
						? await db
								.select()
								.from(schema.nodes)
								.where(
									or(
										eq(schema.nodes.graph, DEFAULT_TOPIC_ID),
										sql`${schema.nodes.graph} IS NULL`,
									),
								)
						: await db
								.select()
								.from(schema.nodes)
								.where(eq(schema.nodes.graph, graphFilter));

				const filteredEdges =
					selectedTopicId === DEFAULT_TOPIC_ID
						? await db
								.select()
								.from(schema.edges)
								.where(
									or(
										eq(schema.edges.graph, DEFAULT_TOPIC_ID),
										sql`${schema.edges.graph} IS NULL`,
									),
								)
						: await db
								.select()
								.from(schema.edges)
								.where(eq(schema.edges.graph, graphFilter));

				logInfo("[KNOWLEDGE_GRAPH] Query results:", {
					nodesCount: filteredNodes.length,
					edgesCount: filteredEdges.length,
				});

				setNodes(filteredNodes);
				setEdges(filteredEdges);
			});
		} catch (error) {
			logError("Failed to load knowledge graph data:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleNodeDeleted = () => {
		loadGraphData();
		setSelectedNodeId(null);
	};

	const handleEdgeDeleted = async (edgeId: string) => {
		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db.delete(schema.edges).where(eq(schema.edges.id, edgeId));
			});
			await loadGraphData();
		} catch (error) {
			logError("Failed to delete edge:", error);
		}
	};

	const handleCreateTopic = async () => {
		const newTopic = await NiceModal.show(CreateTopicDialog);
		if (newTopic) {
			await loadTopics();
			logInfo("[KNOWLEDGE_GRAPH] Topic created:", newTopic);
		}
	};

	const handleEditTopic = async (topic: TopicWithCount) => {
		const result = await NiceModal.show(EditTopicDialog, { topic });
		if (result) {
			await loadTopics();
			logInfo("[KNOWLEDGE_GRAPH] Topic updated:", result);
		}
	};

	const handleDeleteTopic = async (topic: TopicWithCount) => {
		if (!confirm(t("topics.deleteConfirm", { name: topic.name }))) return;

		try {
			setDeletingTopicId(topic.id);
			await topicService.deleteTopic(topic.id);

			// Reset graph to default when the selected topic is deleted
			if (selectedTopicId === topic.id) {
				setSelectedTopicId(DEFAULT_TOPIC_ID);
			}

			await loadTopics();
			logInfo("[KNOWLEDGE_GRAPH] Topic deleted:", topic.id);
		} catch (error) {
			logError("[KNOWLEDGE_GRAPH] Failed to delete topic:", error);
		} finally {
			setDeletingTopicId(null);
		}
	};

	const handleTopicSelect = (topicId: string) => {
		setSelectedTopicId(topicId);
		setSelectedNodeId(null);
		setSearchParams(topicId === DEFAULT_TOPIC_ID ? {} : { topicId });
	};

	const filteredNodes = nodes.filter((node) =>
		node.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div
			ref={containerRef}
			className={
				isDesktop
					? "grid h-full overflow-hidden bg-background"
					: "flex h-full flex-col overflow-hidden bg-background"
			}
			style={
				isDesktop
					? {
							gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr`,
						}
					: undefined
			}
		>
			{/* ----------------------------------------------------------------
			    Sidebar – visible on sm+ screens
			    ---------------------------------------------------------------- */}
			<div
				className={
					isDesktop
						? "flex min-h-0 flex-col overflow-hidden bg-background"
						: "hidden"
				}
			>
				<PageHeader
					icon={<Network size={20} />}
					title={t("title")}
					description={t("description")}
					actions={
						<Button
							type="button"
							size="sm"
							onClick={handleCreateTopic}
							className="h-8 shrink-0 px-3 text-xs"
						>
							<Plus size={13} className="mr-1" />
							{tTopics("manage.newTopic")}
						</Button>
					}
				/>

				{/* Topics Panel */}
				<div className="flex-shrink-0 border-b border-border">
					{/* Header */}
					<div className="flex items-center gap-1.5 px-3 py-2">
						<div className="flex items-center gap-1.5">
							<Tags className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
								{t("topics.title")}
							</span>
						</div>
					</div>

					{/* Topic list – scrollable up to ~6 rows */}
					<div className="overflow-y-auto max-h-48 py-1">
						<TopicRow
							name={t("topic.defaultNoTopic")}
							isSelected={selectedTopicId === DEFAULT_TOPIC_ID}
							isDefault
							onSelect={() => handleTopicSelect(DEFAULT_TOPIC_ID)}
						/>
						{topics.map((topic) => (
							<TopicRow
								key={topic.id}
								name={topic.name}
								fileCount={topic.fileCount}
								growType={topic.growType}
								recallType={topic.recallType}
								isSelected={selectedTopicId === topic.id}
								isDeleting={deletingTopicId === topic.id}
								onSelect={() => handleTopicSelect(topic.id)}
								onEdit={() => handleEditTopic(topic)}
								onDelete={() => handleDeleteTopic(topic)}
							/>
						))}
						{topics.length === 0 && (
							<p className="px-3 py-2 text-xs text-muted-foreground">
								{t("topics.noTopics")}
							</p>
						)}
					</div>
				</div>

				{/* Knowledge Nodes Panel */}
				<div className="flex-1 flex flex-col min-h-0">
					<div className="p-3 border-b border-border flex-shrink-0">
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder={t("search.placeholder")}
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-10"
							/>
						</div>
						<div className="text-xs text-muted-foreground mt-2">
							{t("search.nodeCount", {
								filtered: filteredNodes.length,
								total: nodes.length,
							})}
						</div>
					</div>

					<ScrollArea className="flex-1">
						{loading ? (
							<div className="p-3 text-center text-muted-foreground text-sm">
								{t("status.loading")}
							</div>
						) : filteredNodes.length === 0 ? (
							<div className="p-3 text-center text-muted-foreground text-sm">
								{searchQuery ? t("search.noMatches") : t("search.noNodes")}
							</div>
						) : (
							<div className="divide-y divide-border">
								{filteredNodes.map((node) => (
									<div
										key={node.id}
										className={`p-2 cursor-pointer hover:bg-muted/50 ${
											selectedNodeId === node.id
												? "bg-accent border-r-2 border-primary"
												: ""
										}`}
										onClick={() => setSelectedNodeId(node.id)}
									>
										<div className="flex items-center justify-between gap-2">
											<span className="font-medium text-sm line-clamp-1 text-foreground flex-1">
												{node.name}
											</span>
											<Badge variant="secondary" className="text-xs shrink-0">
												{node.nodeType}
											</Badge>
										</div>
									</div>
								))}
							</div>
						)}
					</ScrollArea>
				</div>
			</div>

			<div
				role="separator"
				aria-orientation="vertical"
				className={
					isDesktop
						? "group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
						: "hidden"
				}
				onMouseDown={handleResizeStart}
			>
				<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
			</div>

			{/* ----------------------------------------------------------------
			    Main graph area
			    ---------------------------------------------------------------- */}
			<div className="flex-1 flex flex-col overflow-hidden">
				<PageHeader
					icon={<Network size={20} />}
					title={t("title")}
					description={t("description")}
					actions={
						<Button
							type="button"
							size="sm"
							onClick={handleCreateTopic}
							className="h-8 shrink-0 px-3 text-xs"
						>
							<Plus size={13} className="mr-1" />
							{tTopics("manage.newTopic")}
						</Button>
					}
					className={isDesktop ? "hidden" : ""}
				/>
				{/* Mobile bar – topic selector (<sm) */}
				<div
					className={
						isDesktop
							? "hidden"
							: "flex items-center border-b border-border bg-card p-3"
					}
				>
					<Select value={selectedTopicId} onValueChange={handleTopicSelect}>
						<SelectTrigger className="flex-1">
							<SelectValue placeholder={t("topic.selectPlaceholder")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={DEFAULT_TOPIC_ID}>
								{t("topic.defaultNoTopic")}
							</SelectItem>
							{topics.map((topic) => (
								<SelectItem key={topic.id} value={topic.id}>
									{topic.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Graph canvas */}
				<div className="flex-1 overflow-hidden">
					{loading ? (
						<div className="h-full flex items-center justify-center text-muted-foreground">
							<div className="text-center">
								<Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50 animate-pulse" />
								<p className="text-lg font-medium">{t("loading")}</p>
							</div>
						</div>
					) : nodes.length === 0 ? (
						<div className="h-full flex items-center justify-center text-muted-foreground">
							<div className="text-center">
								<Network className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
								<p className="text-lg font-medium">{t("empty.title")}</p>
								<p className="text-sm">{t("empty.description")}</p>
							</div>
						</div>
					) : (
						<div className="h-full">
							<D3KnowledgeGraph
								graphData={{ nodes, edges }}
								selectedNodeId={selectedNodeId || undefined}
								onNodeDeleted={handleNodeDeleted}
								onEdgeDeleted={handleEdgeDeleted}
								onNodeSelect={setSelectedNodeId}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
