import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import NiceModal from "@ebay/nice-modal-react";
import {
	Bot,
	CalendarClock,
	ChevronDown,
	FileText,
	Network,
	MoreHorizontal,
	RotateCcw,
	Save,
	Sparkles,
	Trash2,
	Undo2,
	Wrench,
} from "lucide-react";
import {
	useAgentConfigStore,
	GRAPH_REGISTRY,
} from "@/main/stores/agent-config";
import { Button } from "@/main/components/ui/button";
import type { AgentScreenContent } from "@/components/AgentIcon";
import { Separator } from "@/main/components/ui/separator";
import { Label } from "@/main/components/ui/label";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/main/components/ui/hover-card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { cn } from "@/lib/utils";
import { MCPServersSection } from "./MCPServersSection";
import { FeaturesGrid } from "./FeaturesGrid";
import { SystemPromptEditor } from "./SystemPromptEditor";
import { AgentIconScreenPicker } from "./AgentIconScreenPicker";
import { AgentCronJobsSection } from "./AgentCronJobsSection";
import {
	AgentDeleteDialog,
	AgentResetConfigDialog,
} from "./AgentConfigFormDialogs";
import { HoverBadgeList } from "./AgentHoverInfo";
import { CursorPoint } from "@/components/AgentCursor";
import { AGENT_WIZARD_CURSOR_KEYS } from "@/main/modules/agent-wizard";
import type { AgentConfigSummary, AgentPresetDraft } from "../types";
import type { Topic } from "@/services/database/types";
import type { AgentCronJobDraft } from "../hooks/use-agent-cron-jobs";

const SkillsSection = React.lazy(() =>
	import("./SkillsSection").then((module) => ({
		default: module.SkillsSection,
	})),
);

export interface AgentConfigFormActions {
	canSave: boolean;
	isBusy: boolean;
	hasUnsavedChanges: boolean;
	saveLabel?: string;
	canOptimize?: boolean;
	canDelete: boolean;
	isDeleting: boolean;
	onSave: () => void;
	onOptimize?: () => void;
	onRevert: () => void;
	onDelete: (options?: { deleteLinkedMemory: boolean }) => void;
	onResetConfig: () => void;
}

export interface AgentCronJobFormState {
	drafts: AgentCronJobDraft[];
	isLoading: boolean;
	isSaving: boolean;
	error: string | null;
	onAdd: (status: "active" | "paused" | "draft") => void;
	onUpdate: (id: string, updates: Partial<AgentCronJobDraft>) => void;
	onRemove: (id: string) => void;
}

interface AgentConfigFormProps {
	className?: string;
	metadataDraft?: AgentPresetDraft;
	configSummary?: AgentConfigSummary | null;
	memoryTopic?: Topic | null;
	onMetadataChange?: <K extends keyof AgentPresetDraft>(
		field: K,
		value: AgentPresetDraft[K],
	) => void;
	formActions?: AgentConfigFormActions;
	cronJobs?: AgentCronJobFormState;
}

// ─── Compact summary helpers ──────────────────────────────────────────────────

const StatItem: React.FC<{
	icon: React.ReactNode;
	label: string;
	hoverItems?: string[];
	hoverEmptyLabel?: string;
	hoverBadgeClassName?: string;
	hoverBadgeVariant?: "outline" | "secondary";
}> = ({
	icon,
	label,
	hoverItems,
	hoverEmptyLabel,
	hoverBadgeClassName,
	hoverBadgeVariant,
}) => {
	const inner = (
		<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
			{icon}
			{label}
		</span>
	);

	if (!hoverItems || !hoverEmptyLabel) return inner;

	return (
		<HoverBadgeList
			title={label}
			items={hoverItems}
			emptyLabel={hoverEmptyLabel}
			badgeClassName={hoverBadgeClassName}
			badgeVariant={hoverBadgeVariant}
		>
			<span className="cursor-help transition-colors hover:text-foreground">
				{inner}
			</span>
		</HoverBadgeList>
	);
};

const PromptPill: React.FC<{
	label: string;
	value: string;
	preview: string;
}> = ({ label, value, preview }) => (
	<HoverCard openDelay={120} closeDelay={60}>
		<HoverCardTrigger asChild>
			<button
				type="button"
				className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
			>
				<FileText size={11} />
				<span>
					{label} · {value}
				</span>
			</button>
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

const toAgentScreenContent = (
	iconScreen: AgentPresetDraft["iconScreen"],
): AgentScreenContent | undefined =>
	iconScreen
		? {
				kind: iconScreen.kind,
				value: iconScreen.value,
				color: iconScreen.color,
				scale: iconScreen.kind === "emoji" ? 0.72 : 0.52,
			}
		: undefined;

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export const AgentConfigForm: React.FC<AgentConfigFormProps> = ({
	className,
	metadataDraft,
	configSummary,
	memoryTopic,
	onMetadataChange,
	formActions,
	cronJobs,
}) => {
	const { t } = useTranslation(["chat", "agents", "common"]);
	const ta = (key: string, opts?: Record<string, unknown>) =>
		t(key, { ns: "agents", ...opts });
	const {
		currentGraphType,
		isLegacyConfig,
		isLoading,
		isSaving,
		setGraphType,
		convertToUnified,
	} = useAgentConfigStore();

	const [showBaseGraph, setShowBaseGraph] = React.useState(false);
	const iconScreenContent = toAgentScreenContent(
		metadataDraft?.iconScreen ?? null,
	);

	const currentGraphMeta = GRAPH_REGISTRY.find(
		(graph) => graph.id === currentGraphType,
	);

	const openResetConfigDialog = () => {
		if (!formActions) return;
		void NiceModal.show(AgentResetConfigDialog, {
			onResetConfig: formActions.onResetConfig,
		});
	};

	const openDeleteDialog = () => {
		if (!formActions) return;
		void NiceModal.show(AgentDeleteDialog, {
			agentName: metadataDraft?.name,
			memoryTopic,
			canDelete: formActions.canDelete,
			isDeleting: formActions.isDeleting,
			onDelete: formActions.onDelete,
		});
	};

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center px-6 py-12">
				<div className="text-sm text-muted-foreground">
					{t("agentSettings.loading")}
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-6 max-w-3xl mx-auto", className)}>
			{/* ── Identity + general info ───────────────────────────────── */}
			{metadataDraft && onMetadataChange && (
				<>
					<div className="space-y-3">
						{/* Icon + Name row + inline actions */}
						<div className="flex items-center gap-3">
							<CursorPoint cursorKey={AGENT_WIZARD_CURSOR_KEYS.iconScreen}>
								<AgentIconScreenPicker
									metadataDraft={metadataDraft}
									iconScreenContent={iconScreenContent}
									onMetadataChange={onMetadataChange}
									ta={ta}
								/>
							</CursorPoint>

							<CursorPoint
								cursorKey={AGENT_WIZARD_CURSOR_KEYS.name}
								className="min-w-0 flex-1"
							>
								<input
									id="agent-preset-name"
									value={metadataDraft.name}
									onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
										onMetadataChange("name", e.target.value)
									}
									placeholder={ta("fields.namePlaceholder")}
									className="w-full min-w-0 bg-transparent p-0 text-xl font-bold text-foreground placeholder:text-muted-foreground/40 border-0 outline-none"
								/>
							</CursorPoint>

							{/* Inline action buttons */}
							{formActions && (
								<div className="flex shrink-0 items-center gap-1">
									{formActions.hasUnsavedChanges && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-8 px-2.5 text-xs"
											onClick={formActions.onRevert}
											disabled={formActions.isBusy}
										>
											<Undo2 size={13} className="mr-1" />
											{ta("actions.revert")}
										</Button>
									)}

									{formActions.onOptimize ? (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
											onClick={formActions.onOptimize}
											disabled={!formActions.canOptimize || formActions.isBusy}
										>
											<Sparkles size={13} className="mr-1" />
											{ta("actions.optimize")}
										</Button>
									) : null}

									<Button
										type="button"
										size="sm"
										className="h-8 px-3 text-xs"
										onClick={formActions.onSave}
										disabled={!formActions.canSave}
									>
										<Save size={13} className="mr-1" />
										{formActions.isBusy
											? ta("actions.saving")
											: (formActions.saveLabel ?? ta("actions.save"))}
									</Button>

									{/* More menu for destructive actions */}
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0"
											>
												<MoreHorizontal size={15} />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-44">
											<DropdownMenuItem onSelect={openResetConfigDialog}>
												<RotateCcw size={13} className="mr-2" />
												{ta("actions.resetConfig")}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												disabled={
													!formActions.canDelete || formActions.isDeleting
												}
												onSelect={openDeleteDialog}
											>
												<Trash2 size={13} className="mr-2" />
												{ta("actions.delete")}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							)}
						</div>

						{/* Description */}
						<CursorPoint cursorKey={AGENT_WIZARD_CURSOR_KEYS.description}>
							<textarea
								id="agent-preset-description"
								value={metadataDraft.description}
								onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
									onMetadataChange("description", e.target.value)
								}
								placeholder={ta("fields.descriptionPlaceholder")}
								rows={2}
								className="w-full bg-transparent p-0 text-sm text-muted-foreground placeholder:text-muted-foreground/40 border-0 outline-none resize-none"
							/>
						</CursorPoint>

						{/* Compact stats row */}
						<CursorPoint
							cursorKey={[
								AGENT_WIZARD_CURSOR_KEYS.status,
								AGENT_WIZARD_CURSOR_KEYS.graphType,
								AGENT_WIZARD_CURSOR_KEYS.growType,
								AGENT_WIZARD_CURSOR_KEYS.recallType,
							]}
							className="flex flex-wrap items-center gap-x-3 gap-y-1.5"
						>
							<StatItem
								icon={<Bot size={12} />}
								label={configSummary?.graphLabel ?? ta("state.loading")}
							/>
							<span className="text-border select-none">·</span>
							<StatItem
								icon={<Sparkles size={12} />}
								label={ta("summary.featuresValue", {
									count: configSummary?.enabledFeatureCount ?? 0,
								})}
								hoverItems={configSummary?.enabledFeatureLabels}
								hoverEmptyLabel={ta("summary.noFeaturesEnabled")}
							/>
							<span className="text-border select-none">·</span>
							<StatItem
								icon={<Wrench size={12} />}
								label={ta("summary.toolsValue", {
									count: configSummary?.enabledToolCount ?? 0,
								})}
								hoverItems={configSummary?.enabledToolNames}
								hoverEmptyLabel={ta("summary.noToolsEnabled")}
								hoverBadgeClassName="font-mono"
								hoverBadgeVariant="outline"
							/>
							<span className="text-border select-none">·</span>
							<StatItem
								icon={<CalendarClock size={12} />}
								label={
									configSummary?.lastUpdatedAt
										? configSummary.lastUpdatedAt.toLocaleDateString()
										: ta("summary.lastUpdatedUnknown")
								}
							/>
							{memoryTopic ? (
								<>
									<span className="text-border select-none">·</span>
									<Link
										to={`/knowledge-graph?topicId=${encodeURIComponent(
											memoryTopic.id,
										)}`}
										className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
									>
										<Network size={12} />
										{ta("summary.openMemoryGraph")}
									</Link>
								</>
							) : null}
						</CursorPoint>

						{/* Prompt pills */}
						<CursorPoint
							cursorKey={AGENT_WIZARD_CURSOR_KEYS.contextPrompt}
							className="flex flex-wrap gap-2"
						>
							<PromptPill
								label={ta("summary.systemPrompt")}
								value={
									configSummary
										? ta("summary.systemPromptValue", {
												count: configSummary.systemPromptLength,
												mode: configSummary.hasCustomSystemPrompt
													? ta("summary.custom")
													: ta("summary.default"),
											})
										: ta("state.loading")
								}
								preview={
									configSummary?.systemPromptPreview ?? ta("state.loading")
								}
							/>
							<PromptPill
								label={ta("summary.contextPrompt")}
								value={
									configSummary
										? ta("summary.contextPromptValue", {
												count: configSummary.contextPromptLength,
												mode: configSummary.hasCustomContextPrompt
													? ta("summary.custom")
													: ta("summary.default"),
											})
										: ta("state.loading")
								}
								preview={
									configSummary?.contextPromptPreview ?? ta("state.loading")
								}
							/>
						</CursorPoint>
					</div>

					<Separator />
				</>
			)}

			{/* Legacy config warning */}
			{isLegacyConfig ? (
				<div className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-950">
					<div className="space-y-1">
						<p className="font-semibold">
							{t("agentSettings.legacyConfigTitle")}
						</p>
						<p className="text-xs leading-relaxed text-amber-900/80">
							{t("agentSettings.legacyConfigDescription")}
						</p>
					</div>
					<div>
						<Button
							type="button"
							size="sm"
							onClick={() => void convertToUnified()}
							disabled={isSaving}
						>
							{isSaving
								? t("agentSettings.converting")
								: t("agentSettings.convertToUnified")}
						</Button>
					</div>
				</div>
			) : null}

			{/* ── Skills + MCPs rows ─────────────────────────────────────── */}
			<div className="space-y-1.5">
				<React.Suspense
					fallback={
						<div className="flex min-h-[32px] items-center gap-3">
							<span className="w-20 shrink-0 text-sm text-muted-foreground">
								{ta("skills.label")}
							</span>
							<span className="text-[11px] text-muted-foreground/50">…</span>
						</div>
					}
				>
					<SkillsSection />
				</React.Suspense>
				<MCPServersSection />
				{metadataDraft && cronJobs ? (
					<CursorPoint cursorKey={AGENT_WIZARD_CURSOR_KEYS.cronJobs}>
						<AgentCronJobsSection
							agentStatus={metadataDraft.status}
							drafts={cronJobs.drafts}
							isLoading={cronJobs.isLoading}
							isSaving={cronJobs.isSaving}
							error={cronJobs.error}
							onAdd={cronJobs.onAdd}
							onUpdate={cronJobs.onUpdate}
							onRemove={cronJobs.onRemove}
						/>
					</CursorPoint>
				) : null}
			</div>

			<Separator />

			{/* ── Features grid ──────────────────────────────────────────── */}
			<CursorPoint
				cursorKey={[
					AGENT_WIZARD_CURSOR_KEYS.features,
					AGENT_WIZARD_CURSOR_KEYS.tools,
					AGENT_WIZARD_CURSOR_KEYS.multiAgent,
				]}
			>
				<FeaturesGrid summary={configSummary} />
			</CursorPoint>

			<Separator />

			{/* ── Instructions — Tiptap WYSIWYG ─────────────────────────── */}
			<CursorPoint cursorKey={AGENT_WIZARD_CURSOR_KEYS.systemPrompt}>
				<SystemPromptEditor />
			</CursorPoint>

			<Separator />

			{/* ── Advanced (base graph) ──────────────────────────────────── */}
			<div>
				<button
					type="button"
					onClick={() => setShowBaseGraph((v) => !v)}
					className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronDown
						size={13}
						className={cn(
							"transition-transform",
							showBaseGraph ? "rotate-180" : "",
						)}
					/>
					{ta("advanced.label")}
				</button>

				{showBaseGraph && (
					<div className="mt-3 space-y-3 rounded-2xl glass p-4 sm:p-5">
						<div className="space-y-1">
							<Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								{t("agentSettings.baseGraph")}
							</Label>
							<p className="text-sm font-semibold">
								{currentGraphMeta
									? t(currentGraphMeta.nameKey)
									: currentGraphType}
							</p>
						</div>
						<Select
							value={currentGraphType}
							onValueChange={(value) =>
								setGraphType(value as typeof currentGraphType)
							}
						>
							<SelectTrigger className="h-10 rounded-xl border-border/70 bg-background/80 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{GRAPH_REGISTRY.map((graph) => (
									<SelectItem
										key={graph.id}
										value={graph.id}
										className="text-xs"
									>
										{t(graph.nameKey)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{currentGraphMeta ? (
							<p className="text-[11px] leading-relaxed text-muted-foreground">
								{t(currentGraphMeta.descKey)}
							</p>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
};
