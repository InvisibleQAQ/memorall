import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import { Badge } from "@/main/components/ui/badge";
import { cn } from "@/lib/utils";
import { coerceDate, normalizeAgentPresetStatus } from "../types";
import type { Flow } from "@/services/database/types";

interface AgentPresetListProps {
	presets: Flow[];
	selectedPresetId: string | null;
	searchQuery: string;
	isLoading: boolean;
	isCreating: boolean;
	scrollMode?: "contained" | "page";
	onSearchChange: (value: string) => void;
	onSelectPreset: (presetId: string) => void;
	onCreatePreset: () => void;
}

const getStatusBadgeClassName = (
	status: ReturnType<typeof normalizeAgentPresetStatus>,
) =>
	status === "active"
		? "border-emerald-200 bg-emerald-50 text-emerald-700"
		: "border-amber-200 bg-amber-50 text-amber-700";

export const AgentPresetList: React.FC<AgentPresetListProps> = ({
	presets,
	selectedPresetId,
	searchQuery,
	isLoading,
	isCreating,
	scrollMode = "contained",
	onSearchChange,
	onSelectPreset,
	onCreatePreset,
}) => {
	const { t } = useTranslation("agents");

	return (
		<div
			className={cn(
				"flex flex-col",
				scrollMode === "contained" ? "h-full min-h-0" : "",
			)}
		>
			<div className="border-b px-4 py-4">
				<div className="flex items-center justify-between gap-3">
					<div className="space-y-1">
						<p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
							{t("list.eyebrow")}
						</p>
						<h2 className="text-lg font-semibold">{t("list.title")}</h2>
						<p className="text-sm text-muted-foreground">
							{t("list.subtitle")}
						</p>
					</div>
					<Button
						type="button"
						size="sm"
						onClick={onCreatePreset}
						disabled={isCreating}
						className="shrink-0"
					>
						<Plus size={14} className="mr-1.5" />
						{t("actions.create")}
					</Button>
				</div>
				<div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
					<Search size={14} className="text-muted-foreground" />
					<Input
						value={searchQuery}
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder={t("list.searchPlaceholder")}
						className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
					/>
				</div>
			</div>

			<div
				className={cn(
					scrollMode === "contained" ? "flex-1 min-h-0 overflow-y-auto" : "",
				)}
			>
				<div className="space-y-2 p-3">
					<div className="flex items-center justify-between px-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
						<span>{t("list.count", { count: presets.length })}</span>
						<span>{t("list.caption")}</span>
					</div>

					{isLoading ? (
						<div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
							{t("state.loading")}
						</div>
					) : presets.length === 0 ? (
						<div className="rounded-xl border border-dashed px-4 py-10 text-center">
							<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								<Sparkles size={18} className="text-muted-foreground" />
							</div>
							<p className="text-sm font-medium">{t("list.emptyTitle")}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{t("list.emptyDescription")}
							</p>
						</div>
					) : (
						presets.map((preset) => {
							const normalizedStatus = normalizeAgentPresetStatus(
								preset.status,
							);
							const updatedAt = coerceDate(preset.updatedAt);
							const isSelected = preset.id === selectedPresetId;

							return (
								<button
									key={preset.id}
									type="button"
									onClick={() => onSelectPreset(preset.id)}
									className={cn(
										"w-full rounded-xl border px-3 py-3 text-left transition-colors",
										"hover:border-foreground/20 hover:bg-muted/30",
										isSelected
											? "border-foreground/20 bg-muted/40 shadow-sm"
											: "border-border bg-background",
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0 space-y-1">
											<p className="truncate text-sm font-semibold">
												{preset.name}
											</p>
											<p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
												{preset.description?.trim() || t("list.noDescription")}
											</p>
										</div>
										<Badge
											variant="outline"
											className={cn(
												"shrink-0 border text-[10px] uppercase",
												getStatusBadgeClassName(normalizedStatus),
											)}
										>
											{t(`status.${normalizedStatus}`)}
										</Badge>
									</div>
									<div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
										<span className="truncate">
											{updatedAt
												? t("list.updatedAt", {
														value: updatedAt.toLocaleString(),
													})
												: t("list.updatedAtUnknown")}
										</span>
										{isSelected ? (
											<Badge
												variant="secondary"
												className="shrink-0 text-[10px]"
											>
												{t("list.selected")}
											</Badge>
										) : null}
									</div>
								</button>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
};
