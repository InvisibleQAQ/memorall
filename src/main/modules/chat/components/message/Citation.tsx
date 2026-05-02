import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Network, Sparkles } from "lucide-react";
import { eq } from "drizzle-orm";
import { cn } from "@/lib/utils";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/main/components/ui/popover";
import { serviceManager } from "@/services";
import { logError } from "@/utils/logger";

interface CitationProps {
	type: "node" | "edge";
	uuid: string;
	label: string;
}

export const Citation: React.FC<CitationProps> = React.memo(
	({ type, uuid, label }) => {
		const { t } = useTranslation("chat");
		const [open, setOpen] = useState(false);
		const [data, setData] = useState<{
			name?: string;
			summary?: string;
			nodeType?: string;
			edgeType?: string;
			factText?: string;
			sourceNode?: string;
			destNode?: string;
		} | null>(null);
		const [loading, setLoading] = useState(false);

		const loadData = React.useCallback(async () => {
			if (data || loading) return;

			setLoading(true);
			try {
				await serviceManager.databaseService.use(async ({ db, schema }) => {
					if (type === "node") {
						const result = await db
							.select({
								name: schema.nodes.name,
								summary: schema.nodes.summary,
								nodeType: schema.nodes.nodeType,
							})
							.from(schema.nodes)
							.where(eq(schema.nodes.id, uuid))
							.limit(1);

						if (result[0]) {
							setData({
								name: result[0].name,
								summary: result[0].summary || "",
								nodeType: result[0].nodeType,
							});
						}
					} else {
						const result = await db
							.select({
								edgeType: schema.edges.edgeType,
								factText: schema.edges.factText,
								sourceId: schema.edges.sourceId,
								destinationId: schema.edges.destinationId,
							})
							.from(schema.edges)
							.where(eq(schema.edges.id, uuid))
							.limit(1);

						if (result[0]) {
							const [sourceNode, destNode] = await Promise.all([
								db
									.select({ name: schema.nodes.name })
									.from(schema.nodes)
									.where(eq(schema.nodes.id, result[0].sourceId))
									.limit(1),
								db
									.select({ name: schema.nodes.name })
									.from(schema.nodes)
									.where(eq(schema.nodes.id, result[0].destinationId))
									.limit(1),
							]);

							setData({
								edgeType: result[0].edgeType,
								factText: result[0].factText || "",
								sourceNode: sourceNode[0]?.name,
								destNode: destNode[0]?.name,
							});
						}
					}
				});
			} catch (error) {
				logError("Failed to load citation data:", error);
			} finally {
				setLoading(false);
			}
		}, [data, loading, type, uuid]);

		return (
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						className={cn(
							"inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-medium",
							"transition-all duration-200",
							"hover:scale-105",
							type === "node"
								? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
								: "bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50",
						)}
						onClick={() => {
							if (!data && !loading) {
								loadData();
							}
						}}
					>
						{type === "node" ? (
							<Network className="w-3 h-3" />
						) : (
							<Link2 className="w-3 h-3" />
						)}
						<span>{label}</span>
					</button>
				</PopoverTrigger>
				<PopoverContent className="w-80" align="start">
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							{type === "node" ? (
								<Network className="w-4 h-4 text-blue-600 dark:text-blue-400" />
							) : (
								<Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
							)}
							<h4 className="font-semibold text-sm">
								{type === "node" ? t("citation.node") : t("citation.edge")}
							</h4>
						</div>

						{loading ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Sparkles className="w-4 h-4 animate-spin" />
								<span>{t("citation.loading")}</span>
							</div>
						) : data ? (
							<div className="space-y-2">
								{type === "node" ? (
									<>
										<div>
											<div className="text-xs text-muted-foreground">
												{t("citation.name")}
											</div>
											<div className="text-sm font-medium">{data.name}</div>
										</div>
										{data.nodeType && (
											<div>
												<div className="text-xs text-muted-foreground">
													{t("citation.type")}
												</div>
												<div className="text-sm">{data.nodeType}</div>
											</div>
										)}
										{data.summary && (
											<div>
												<div className="text-xs text-muted-foreground">
													{t("citation.summary")}
												</div>
												<div className="text-sm text-muted-foreground line-clamp-3">
													{data.summary}
												</div>
											</div>
										)}
									</>
								) : (
									<>
										{data.sourceNode && data.destNode && (
											<div>
												<div className="text-xs text-muted-foreground">
													{t("citation.connection")}
												</div>
												<div className="text-sm">
													<span className="font-medium">{data.sourceNode}</span>
													<span className="text-muted-foreground mx-1">→</span>
													<span className="font-medium">{data.destNode}</span>
												</div>
											</div>
										)}
										{data.edgeType && (
											<div>
												<div className="text-xs text-muted-foreground">
													{t("citation.relationship")}
												</div>
												<div className="text-sm font-medium">
													{data.edgeType}
												</div>
											</div>
										)}
										{data.factText && (
											<div>
												<div className="text-xs text-muted-foreground">
													{t("citation.fact")}
												</div>
												<div className="text-sm text-muted-foreground">
													{data.factText}
												</div>
											</div>
										)}
									</>
								)}
								<div className="pt-2 border-t">
									<div className="text-xs text-muted-foreground font-mono truncate">
										ID: {uuid}
									</div>
								</div>
							</div>
						) : (
							<div className="text-sm text-muted-foreground">
								{t("citation.clickToLoad")}
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		);
	},
);

Citation.displayName = "Citation";
