import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
	useAgentConfigStore,
	GRAPH_REGISTRY,
} from "@/main/stores/agent-config";
import { Button } from "@/main/components/ui/button";
import { Separator } from "@/main/components/ui/separator";
import { Label } from "@/main/components/ui/label";
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
import type { AgentConfigSummary } from "../types";

const SkillsSection = React.lazy(() =>
	import("./SkillsSection").then((module) => ({
		default: module.SkillsSection,
	})),
);

interface AgentConfigFormProps {
	className?: string;
	summary?: AgentConfigSummary | null;
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------
export const AgentConfigForm: React.FC<AgentConfigFormProps> = ({
	className,
	summary,
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

	const currentGraphMeta = GRAPH_REGISTRY.find(
		(graph) => graph.id === currentGraphType,
	);

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
		<div className={cn("space-y-6", className)}>
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
				{/* Skills row — button is last item inline with chips */}
				<React.Suspense
					fallback={
						<div className="flex min-h-[32px] items-center gap-3">
							<span className="w-12 shrink-0 text-sm text-muted-foreground">
								{ta("skills.label")}
							</span>
							<span className="text-[11px] text-muted-foreground/50">…</span>
						</div>
					}
				>
					<SkillsSection />
				</React.Suspense>

				{/* MCPs row — button is last item inline with chips */}
				<MCPServersSection />
			</div>

			<Separator />

			{/* ── Features grid ──────────────────────────────────────────── */}
			<FeaturesGrid summary={summary} />

			<Separator />

			{/* ── Instructions — Tiptap WYSIWYG ─────────────────────────── */}
			<SystemPromptEditor />

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
