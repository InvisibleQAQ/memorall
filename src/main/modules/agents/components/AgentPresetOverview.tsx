import React from "react";
import { useTranslation } from "react-i18next";
import {
	AlertTriangle,
	Bot,
	CalendarClock,
	FileText,
	Sparkles,
	Trash2,
	Wrench,
} from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/main/components/ui/alert-dialog";
import { Badge } from "@/main/components/ui/badge";
import { Button } from "@/main/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/main/components/ui/card";
import { Input } from "@/main/components/ui/input";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { Textarea } from "@/main/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Flow } from "@/services/database/types";
import type { AgentConfigSummary, AgentPresetDraft } from "../types";

interface AgentPresetOverviewProps {
	selectedPreset: Flow | null;
	metadataDraft: AgentPresetDraft;
	configSummary: AgentConfigSummary | null;
	hasMetadataChanges: boolean;
	hasConfigChanges: boolean;
	canDeletePreset: boolean;
	isDeleting: boolean;
	scrollMode?: "contained" | "page";
	onMetadataChange: <K extends keyof AgentPresetDraft>(
		field: K,
		value: AgentPresetDraft[K],
	) => void;
	onDeletePreset: () => void;
}

const SummaryCard: React.FC<{
	icon: React.ReactNode;
	label: string;
	value: string;
	highlight?: boolean;
}> = ({ icon, label, value, highlight = false }) => (
	<Card
		className={cn(
			"border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-sm",
			highlight ? "border-foreground/10" : "",
		)}
	>
		<CardContent className="flex items-start gap-3 p-4">
			<div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
				{icon}
			</div>
			<div className="space-y-1">
				<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
					{label}
				</p>
				<p className="text-sm font-semibold leading-snug">{value}</p>
			</div>
		</CardContent>
	</Card>
);

export const AgentPresetOverview: React.FC<AgentPresetOverviewProps> = ({
	selectedPreset,
	metadataDraft,
	configSummary,
	hasMetadataChanges,
	hasConfigChanges,
	canDeletePreset,
	isDeleting,
	scrollMode = "contained",
	onMetadataChange,
	onDeletePreset,
}) => {
	const { t } = useTranslation("agents");

	if (!selectedPreset) {
		return (
			<div
				className={cn(
					"flex items-center justify-center px-6 py-12 text-center",
					scrollMode === "contained" ? "h-full" : "min-h-[280px]",
				)}
			>
				<div className="max-w-sm space-y-2">
					<p className="text-lg font-semibold">{t("overview.emptyTitle")}</p>
					<p className="text-sm text-muted-foreground">
						{t("overview.emptyDescription")}
					</p>
				</div>
			</div>
		);
	}

	const unsavedBadges = [
		hasMetadataChanges ? t("overview.metadataDraft") : null,
		hasConfigChanges ? t("overview.configDraft") : null,
	].filter(Boolean) as string[];

	return (
		<div
			className={cn(
				"flex flex-col",
				scrollMode === "contained" ? "h-full min-h-0" : "",
			)}
		>
			<div className="border-b bg-gradient-to-r from-background via-background to-muted/30 px-5 py-5">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-2">
						<p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
							{t("overview.eyebrow")}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-xl font-semibold">
								{metadataDraft.name.trim() || t("overview.untitled")}
							</h2>
							<Badge
								variant="outline"
								className={cn(
									"text-[10px] uppercase",
									metadataDraft.status === "active"
										? "border-emerald-200 bg-emerald-50 text-emerald-700"
										: "border-amber-200 bg-amber-50 text-amber-700",
								)}
							>
								{t(`status.${metadataDraft.status}`)}
							</Badge>
							{unsavedBadges.length > 0 ? (
								unsavedBadges.map((badge) => (
									<Badge
										key={badge}
										variant="secondary"
										className="text-[10px]"
									>
										{badge}
									</Badge>
								))
							) : (
								<Badge variant="secondary" className="text-[10px]">
									{t("overview.saved")}
								</Badge>
							)}
						</div>
						<p className="max-w-xl text-sm text-muted-foreground">
							{t("overview.subtitle")}
						</p>
					</div>

					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="shrink-0 text-destructive"
								disabled={!canDeletePreset || isDeleting}
							>
								<Trash2 size={14} className="mr-1.5" />
								{t("actions.delete")}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{t("delete.title")}</AlertDialogTitle>
								<AlertDialogDescription>
									{t("delete.description", {
										name: metadataDraft.name || t("overview.untitled"),
									})}
								</AlertDialogDescription>
							</AlertDialogHeader>
							{!canDeletePreset ? (
								<div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
									<AlertTriangle size={16} className="mt-0.5 shrink-0" />
									<span>{t("delete.lastPresetHint")}</span>
								</div>
							) : null}
							<AlertDialogFooter>
								<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
								<AlertDialogAction
									onClick={onDeletePreset}
									disabled={!canDeletePreset || isDeleting}
								>
									{t("actions.delete")}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			<div
				className={cn(
					scrollMode === "contained" ? "flex-1 min-h-0 overflow-y-auto" : "",
				)}
			>
				<div className="space-y-5 p-5">
					<Card className="border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-sm">
						<CardHeader className="pb-3">
							<CardTitle>{t("overview.metadataTitle")}</CardTitle>
							<CardDescription>
								{t("overview.metadataDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="agent-preset-name">{t("fields.name")}</Label>
								<Input
									id="agent-preset-name"
									value={metadataDraft.name}
									onChange={(event) =>
										onMetadataChange("name", event.target.value)
									}
									placeholder={t("fields.namePlaceholder")}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="agent-preset-description">
									{t("fields.description")}
								</Label>
								<Textarea
									id="agent-preset-description"
									value={metadataDraft.description}
									onChange={(event) =>
										onMetadataChange("description", event.target.value)
									}
									placeholder={t("fields.descriptionPlaceholder")}
									className="min-h-[108px] resize-y"
								/>
							</div>

							<div className="space-y-2">
								<Label>{t("fields.status")}</Label>
								<Select
									value={metadataDraft.status}
									onValueChange={(value) =>
										onMetadataChange(
											"status",
											value as AgentPresetDraft["status"],
										)
									}
								>
									<SelectTrigger className="h-10">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="active">{t("status.active")}</SelectItem>
										<SelectItem value="draft">{t("status.draft")}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</CardContent>
					</Card>

					<div className="grid gap-3 sm:grid-cols-2">
						<SummaryCard
							icon={<Bot size={16} />}
							label={t("summary.graph")}
							value={configSummary?.graphLabel ?? t("state.loading")}
							highlight
						/>
						<SummaryCard
							icon={<Sparkles size={16} />}
							label={t("summary.features")}
							value={t("summary.featuresValue", {
								count: configSummary?.enabledFeatureCount ?? 0,
							})}
						/>
						<SummaryCard
							icon={<Wrench size={16} />}
							label={t("summary.tools")}
							value={t("summary.toolsValue", {
								count: configSummary?.enabledToolCount ?? 0,
							})}
						/>
						<SummaryCard
							icon={<CalendarClock size={16} />}
							label={t("summary.lastUpdated")}
							value={
								configSummary?.lastUpdatedAt
									? configSummary.lastUpdatedAt.toLocaleString()
									: t("summary.lastUpdatedUnknown")
							}
						/>
					</div>

					<Card className="border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-sm">
						<CardHeader className="pb-3">
							<CardTitle>{t("summary.promptsTitle")}</CardTitle>
							<CardDescription>
								{t("summary.promptsDescription")}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-3">
								<div className="rounded-lg bg-background p-2 text-muted-foreground">
									<FileText size={16} />
								</div>
								<div className="space-y-1">
									<p className="text-sm font-medium">
										{t("summary.systemPrompt")}
									</p>
									<p className="text-sm text-muted-foreground">
										{configSummary
											? t("summary.systemPromptValue", {
													count: configSummary.systemPromptLength,
													mode: configSummary.hasCustomSystemPrompt
														? t("summary.custom")
														: t("summary.default"),
												})
											: t("state.loading")}
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3 rounded-lg border bg-muted/20 px-3 py-3">
								<div className="rounded-lg bg-background p-2 text-muted-foreground">
									<FileText size={16} />
								</div>
								<div className="space-y-1">
									<p className="text-sm font-medium">
										{t("summary.contextPrompt")}
									</p>
									<p className="text-sm text-muted-foreground">
										{configSummary
											? t("summary.contextPromptValue", {
													count: configSummary.contextPromptLength,
													mode: configSummary.hasCustomContextPrompt
														? t("summary.custom")
														: t("summary.default"),
												})
											: t("state.loading")}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};
