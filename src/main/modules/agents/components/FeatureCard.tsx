import React from "react";
import { useTranslation } from "react-i18next";
import {
	AppWindow,
	Bot,
	Briefcase,
	ChevronRight,
	Database,
	FileOutput,
	FilePlus,
	FileText,
	FolderOpen,
	GitFork,
	Globe,
	HardDrive,
	Languages,
	ListChecks,
	Newspaper,
	Plug,
	Quote,
	Shapes,
	Terminal,
	TrendingUp,
	Wrench,
} from "lucide-react";
import NiceModal from "@ebay/nice-modal-react";
import { AgentFeatureDetailModal } from "@/main/modules/agents/modals/AgentFeatureDetailModal";
import { Button } from "@/main/components/ui/button";
import { Badge } from "@/main/components/ui/badge";
import { Switch } from "@/main/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FeatureIcon } from "@/services/flows/flow-builder-catalog";
import type { AgentFeatureDefinition } from "@/main/stores/agent-config";

// ---------------------------------------------------------------------------
// Lucide icon lookup — add names here as new features register them
// ---------------------------------------------------------------------------
const LUCIDE_MAP: Record<
	string,
	React.ComponentType<{ size?: number; className?: string }>
> = {
	AppWindow,
	Bot,
	Briefcase,
	Database,
	FileOutput,
	FilePlus,
	FileText,
	FolderOpen,
	GitFork,
	Globe,
	HardDrive,
	Languages,
	ListChecks,
	Newspaper,
	Plug,
	Quote,
	Terminal,
	TrendingUp,
	Wrench,
};

const FEATURE_ICON_ACCENTS: Record<string, string> = {
	"rag-knowledge": "#22c55e",
	"knowledge-retrieval": "#22c55e",
	citations: "#a855f7",
	"agent-node": "#f59e0b",
	"fs-feature": "#06b6d4",
	"documents-fs-feature": "#3b82f6",
	"documents-feature": "#94a3b8",
	"nodejs-sandbox-feature": "#f97316",
	"web-feature": "#0ea5e9",
	"news-collection-feature": "#eab308",
	"travel-planner-feature": "#6366f1",
	"meal-planner-feature": "#ec4899",
	"daily-briefing-feature": "#facc15",
	"planner-feature": "#14b8a6",
	"job-application-feature": "#8b5cf6",
	"language-tutor-feature": "#10b981",
	"shopping-assistant-feature": "#f43f5e",
	"multi-agent-feature": "#818cf8",
	"finance-tracker-feature": "#22c55e",
	"artifact-feature": "#6366f1",
	"document-convert-feature": "#f59e0b",
	"pdf-generate-feature": "#ef4444",
	"co-agent-feature": "#10b981",
};

const getFeatureAccent = (feature: AgentFeatureDefinition): string =>
	FEATURE_ICON_ACCENTS[feature.name] ?? "#64748b";

// ---------------------------------------------------------------------------
// FeatureIcon renderer
// ---------------------------------------------------------------------------
const FeatureIconDisplay: React.FC<{
	icon: FeatureIcon | undefined;
	size?: number;
	className?: string;
}> = ({ icon, size = 16, className }) => {
	if (!icon) {
		return <Shapes size={size} className={className} />;
	}
	if (icon.type === "emoji") {
		return (
			<span
				className={cn("leading-none", className)}
				style={{ fontSize: size + 2 }}
				role="img"
			>
				{icon.name}
			</span>
		);
	}
	const LucideIcon = LUCIDE_MAP[icon.name];
	if (!LucideIcon) {
		return <Shapes size={size} className={className} />;
	}
	return <LucideIcon size={size} className={className} />;
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface FeatureCardProps {
	feature: AgentFeatureDefinition;
	enabled?: boolean;
	onToggle?: (checked: boolean) => void;
	toolCount?: number;
	totalToolCount?: number;
	hasDetail?: boolean;
	displayName: string;
	displayDesc: string;
}

// ---------------------------------------------------------------------------
// FeatureCard
// ---------------------------------------------------------------------------
export const FeatureCard: React.FC<FeatureCardProps> = ({
	feature,
	enabled = false,
	onToggle,
	toolCount,
	totalToolCount,
	hasDetail = false,
	displayName,
	displayDesc,
}) => {
	const { t } = useTranslation("chat");
	const icon =
		"icon" in feature ? (feature.icon as FeatureIcon | undefined) : undefined;
	const accent = getFeatureAccent(feature);

	const showToolsBadge =
		toolCount !== undefined && totalToolCount !== undefined;
	const showDetailBtn = hasDetail && feature.name !== "mcp-feature";

	return (
		<div
			style={
				{
					"--feature-accent": accent,
					borderColor: enabled ? `${accent}55` : undefined,
				} as React.CSSProperties
			}
			className={cn(
				"group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-4 transition-colors hover:border-[color:var(--feature-accent)]/50",
				enabled
					? "bg-[linear-gradient(135deg,color-mix(in_srgb,var(--feature-accent)_10%,transparent),transparent_55%)]"
					: "border-border/30 bg-card/50",
			)}
		>
			{/* Header row: icon + name/desc + toggle */}
			<div className="flex items-start gap-3">
				{/* Icon box */}
				<div
					className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors"
					style={{
						backgroundColor: `${accent}24`,
						borderColor: `${accent}33`,
						color: accent,
					}}
				>
					<FeatureIconDisplay
						icon={icon}
						size={16}
						className="text-[color:var(--feature-accent)]"
					/>
				</div>

				{/* Name + description */}
				<div className="min-w-0 flex-1 space-y-0.5">
					<div className="flex items-center gap-1.5">
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full shrink-0",
								enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
							)}
						/>
						<p className="truncate text-sm font-semibold leading-tight">
							{displayName}
						</p>
					</div>
					<p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
						{displayDesc}
					</p>
				</div>

				{/* Toggle (only for toggleable features) */}
				{onToggle && feature.type !== "config" && (
					<Switch
						checked={enabled}
						onCheckedChange={onToggle}
						className="shrink-0"
					/>
				)}
				{onToggle &&
					feature.type === "config" &&
					feature.configKey !== "tools" && (
						<Switch
							checked={enabled}
							onCheckedChange={onToggle}
							className="shrink-0"
						/>
					)}
			</div>

			{/* Footer row: badge + detail — always rendered for consistent card height */}
			<div className="flex items-center justify-between gap-2">
				{showToolsBadge ? (
					<Badge variant="secondary" className="text-[10px]">
						{toolCount}/{totalToolCount}
					</Badge>
				) : feature.type === "catalog" ? (
					<Badge variant="secondary" className="text-[10px]">
						{t("agentSettings.toolCount", { count: feature.tools.length })}
					</Badge>
				) : (
					<span />
				)}
				{showDetailBtn && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 rounded-lg px-2 text-[10px]"
						onClick={() =>
							void NiceModal.show(AgentFeatureDetailModal, {
								featureName: feature.name,
							})
						}
					>
						<ChevronRight size={10} className="mr-1" />
						{t("agentSettings.detail")}
					</Button>
				)}
			</div>
		</div>
	);
};
