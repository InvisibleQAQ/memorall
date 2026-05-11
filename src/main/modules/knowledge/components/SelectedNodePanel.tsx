import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, X, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/main/components/ui/card";
import { Badge } from "@/main/components/ui/badge";
import { Button } from "@/main/components/ui/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/main/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { D3Node, ConnectedEdge } from "./types";

interface SelectedNodePanelProps {
	node: D3Node;
	connectedEdges: ConnectedEdge[];
	nodeColors: Record<string, string>;
	isDark: boolean;
	onClose: () => void;
	onDelete: () => void;
	onDeleteEdge: (edgeId: string) => void;
	deletingEdgeId: string | null;
	deleting: boolean;
}

export const SelectedNodePanel = memo(
	({
		node,
		connectedEdges,
		nodeColors,
		isDark,
		onClose,
		onDelete,
		onDeleteEdge,
		deletingEdgeId,
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
												<div className="flex items-center justify-between gap-2 mb-2">
													{connection.direction === "outgoing" ? (
														<div className="flex items-center gap-2">
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
														</div>
													) : (
														<div className="flex items-center gap-2">
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
														</div>
													)}
													<Button
														variant="ghost"
														size="sm"
														onClick={() => onDeleteEdge(connection.edge.id)}
														disabled={deletingEdgeId === connection.edge.id}
														className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
														title={t("edge.delete")}
													>
														{deletingEdgeId === connection.edge.id ? (
															<Loader2 className="h-3 w-3 animate-spin" />
														) : (
															<Trash2 className="h-3 w-3" />
														)}
													</Button>
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
