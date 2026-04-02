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
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/main/components/ui/hover-card";
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
import { HoverBadgeList, TruncatedHoverText } from "./AgentHoverInfo";

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
	hoverItems?: string[];
	hoverEmptyLabel?: string;
	hoverBadgeClassName?: string;
	hoverBadgeVariant?: "outline" | "secondary";
}> = ({
	icon,
	label,
	value,
	highlight = false,
	hoverItems,
	hoverEmptyLabel,
	hoverBadgeClassName,
	hoverBadgeVariant,
}) => {
	const card = (
		<Card
			className={cn(
				"h-full border-border/70 bg-gradient-to-br from-background via-background to-muted/20 shadow-sm",
				highlight ? "border-foreground/10" : "",
			)}
		>
			<CardContent className="flex min-h-[84px] items-start gap-3 p-4">
				<div className="mt-0.5 rounded-lg bg-muted p-2 text-muted-foreground">
					{icon}
				</div>
				<div className="min-w-0 space-y-1">
					<p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{label}
					</p>
					<p
						title={value}
						className="truncate text-sm font-semibold leading-snug"
					>
						{value}
					</p>
				</div>
			</CardContent>
		</Card>
	);

	if (!hoverItems || !hoverEmptyLabel) {
		return card;
	}

	return (
		<HoverBadgeList
			title={label}
			items={hoverItems}
			emptyLabel={hoverEmptyLabel}
			badgeClassName={hoverBadgeClassName}
			badgeVariant={hoverBadgeVariant}
		>
			<div className="h-full cursor-help">{card}</div>
		</HoverBadgeList>
	);
};

const PromptPreviewItem: React.FC<{
	icon: React.ReactNode;
	label: string;
	value: string;
	preview: string;
}> = ({ icon, label, value, preview }) => (
	<HoverCard openDelay={120} closeDelay={60}>
		<HoverCardTrigger asChild>
			<div className="flex cursor-help items-start gap-3 rounded-lg border bg-muted/20 px-3 py-3">
				<div className="rounded-lg bg-background p-2 text-muted-foreground">
					{icon}
				</div>
				<div className="min-w-0 space-y-1">
					<p className="text-sm font-medium">{label}</p>
					<p className="truncate text-sm text-muted-foreground">{value}</p>
				</div>
			</div>
		</HoverCardTrigger>
		<HoverCardContent
			align="start"
			className="w-[min(42rem,calc(100vw-2rem))] p-3"
		>
			<div className="space-y-2">
				<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
					{label}
				</p>
				<pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/20 p-3 font-mono text-xs leading-relaxed text-foreground">
					{preview}
				</pre>
			</div>
		</HoverCardContent>
	</HoverCard>
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
			<div className="border-b bg-gradient-to-r from-background via-background to-muted/30 px-4 py-4 sm:px-5">
				<div className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
					<div className="min-w-0 space-y-1.5">
						<p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
							{t("overview.eyebrow")}
						</p>
						<div className="flex min-w-0 items-center gap-2">
							<TruncatedHoverText
								as="h2"
								text={metadataDraft.name.trim() || t("overview.untitled")}
								className="flex-1 text-lg font-semibold"
							/>
							<Badge
								variant="outline"
								className={cn(
									"shrink-0 text-[10px] uppercase",
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
										className="shrink-0 text-[10px]"
									>
										{badge}
									</Badge>
								))
							) : (
								<Badge variant="secondary" className="shrink-0 text-[10px]">
									{t("overview.saved")}
								</Badge>
							)}
						</div>
						<TruncatedHoverText
							as="p"
							text={t("overview.subtitle")}
							className="max-w-xl text-sm text-muted-foreground"
						/>
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
							hoverItems={configSummary?.enabledFeatureLabels}
							hoverEmptyLabel={t("summary.noFeaturesEnabled")}
						/>
						<SummaryCard
							icon={<Wrench size={16} />}
							label={t("summary.tools")}
							value={t("summary.toolsValue", {
								count: configSummary?.enabledToolCount ?? 0,
							})}
							hoverItems={configSummary?.enabledToolNames}
							hoverEmptyLabel={t("summary.noToolsEnabled")}
							hoverBadgeClassName="font-mono"
							hoverBadgeVariant="outline"
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
							<PromptPreviewItem
								icon={<FileText size={16} />}
								label={t("summary.systemPrompt")}
								value={
									configSummary
										? t("summary.systemPromptValue", {
												count: configSummary.systemPromptLength,
												mode: configSummary.hasCustomSystemPrompt
													? t("summary.custom")
													: t("summary.default"),
											})
										: t("state.loading")
								}
								preview={
									configSummary?.systemPromptPreview ?? t("state.loading")
								}
							/>

							<PromptPreviewItem
								icon={<FileText size={16} />}
								label={t("summary.contextPrompt")}
								value={
									configSummary
										? t("summary.contextPromptValue", {
												count: configSummary.contextPromptLength,
												mode: configSummary.hasCustomContextPrompt
													? t("summary.custom")
													: t("summary.default"),
											})
										: t("state.loading")
								}
								preview={
									configSummary?.contextPromptPreview ?? t("state.loading")
								}
							/>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};
