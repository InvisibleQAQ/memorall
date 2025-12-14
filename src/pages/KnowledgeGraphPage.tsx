import React, { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Search, Network } from "lucide-react";
import { D3KnowledgeGraph } from "@/modules/knowledge/components/D3KnowledgeGraph";
import type { Node, Edge } from "@/services/database/types";
import { serviceManager } from "@/services";
import { logError, logInfo } from "@/utils/logger";
import { eq, sql, or } from "drizzle-orm";
import { useTranslation } from "react-i18next";

interface Topic {
	id: string; // UI dropdown ID (prefixed with "topic_" or "default")
	label: string; // display name
}

interface KnowledgeGraphPageProps {}

export const KnowledgeGraphPage: React.FC<KnowledgeGraphPageProps> = () => {
	const { t } = useTranslation("knowledge");
	const [nodes, setNodes] = useState<Node[]>([]);
	const [edges, setEdges] = useState<Edge[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [topics, setTopics] = useState<Topic[]>([]);
	const [selectedTopicId, setSelectedTopicId] = useState<string>("default");

	useEffect(() => {
		loadTopics();
	}, []);

	useEffect(() => {
		loadGraphData();
	}, [selectedTopicId]);

	const loadTopics = async () => {
		try {
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				// Query topics table directly
				const allTopics = await db.select().from(schema.topics);

				const topicList: Topic[] = [
					{ id: "default", label: t("topic.defaultNoTopic") },
				];

				// Add each topic with its name
				allTopics.forEach((topic) => {
					topicList.push({
						id: `topic_${topic.id}`, // UI dropdown ID (prefixed)
						label: topic.name,
					});
				});

				setTopics(topicList);
			});
		} catch (error) {
			logError("Failed to load topics:", error);
		}
	};

	const loadGraphData = async () => {
		try {
			setLoading(true);
			await serviceManager.databaseService.use(async ({ db, schema }) => {
				// Determine graph filter value
				// Strip "topic_" prefix to get actual UUID
				const graphFilter =
					selectedTopicId === "default"
						? ""
						: selectedTopicId.replace(/^topic_/, "");

				logInfo("[KNOWLEDGE_GRAPH] Loading graph data:", {
					selectedTopicId,
					graphFilter,
					isDefault: selectedTopicId === "default",
				});

				// Filter nodes by graph
				const filteredNodes =
					selectedTopicId === "default"
						? await db
								.select()
								.from(schema.nodes)
								.where(
									or(
										eq(schema.nodes.graph, ""),
										sql`${schema.nodes.graph} IS NULL`,
									),
								)
						: await db
								.select()
								.from(schema.nodes)
								.where(eq(schema.nodes.graph, graphFilter));

				// Filter edges by graph
				const filteredEdges =
					selectedTopicId === "default"
						? await db
								.select()
								.from(schema.edges)
								.where(
									or(
										eq(schema.edges.graph, ""),
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
		// Reload graph data immediately after deletion
		loadGraphData();
		// Clear selection
		setSelectedNodeId(null);
	};

	const filteredNodes = nodes.filter((node) =>
		node.name.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="flex flex-col sm:flex-row h-full overflow-hidden bg-background">
			{/* Sidebar with node list - hidden on small screens */}
			<div className="hidden sm:block sm:w-72 border-r border-border bg-card">
				<div className="p-3 space-y-3 border-b border-border">
					{/* Topic Selector */}
					<div>
						<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
							{t("topic.label")}
						</label>
						<Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
							<SelectTrigger className="w-full">
								<SelectValue placeholder={t("topic.selectPlaceholder")} />
							</SelectTrigger>
							<SelectContent>
								{topics.map((topic) => (
									<SelectItem key={topic.id} value={topic.id}>
										{topic.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Search */}
					<div>
						<div className="relative">
							<Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
				</div>

				<ScrollArea className="h-full">
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

			{/* Main graph area */}
			<div className="flex-1 flex flex-col">
				{/* Topic selector for small screens (popup mode) */}
				<div className="sm:hidden p-3 border-b border-border bg-card">
					<label className="text-xs font-medium text-muted-foreground mb-1.5 block">
						{t("topic.label")}
					</label>
					<Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("topic.selectPlaceholder")} />
						</SelectTrigger>
						<SelectContent>
							{topics.map((topic) => (
								<SelectItem key={topic.id} value={topic.id}>
									{topic.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Graph content */}
				<div className="flex-1 overflow-hidden h-full">
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
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
