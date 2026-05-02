import React from "react";
import { useTranslation } from "react-i18next";
import { Palette, Smile, Type } from "lucide-react";
import { AgentIcon, type AgentScreenContent } from "@/components/AgentIcon";
import { Button } from "@/main/components/ui/button";
import { Label } from "@/main/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/main/components/ui/popover";
import { cn } from "@/lib/utils";
import type { AgentPresetDraft, AgentPresetIconScreenKind } from "../types";

const ICON_COLOR_SWATCHES = [
	"#17e7e7",
	"#22c55e",
	"#facc15",
	"#fb7185",
	"#a78bfa",
	"#f97316",
	"#f8fafc",
	"#38bdf8",
];

const EMOJI_PICKER_OPTIONS = [
	"✨",
	"🔥",
	"💡",
	"🧠",
	"🧭",
	"📚",
	"📝",
	"🔎",
	"⚡",
	"🎯",
	"🛠️",
	"📊",
	"💬",
	"🌱",
	"🚀",
	"🧩",
	"🗂️",
	"✅",
	"🤖",
	"👩‍💻",
	"👨‍💻",
	"🧑‍🏫",
	"🧑‍🔬",
	"🧑‍🎨",
	"🧑‍💼",
	"🧑‍🚀",
	"📌",
	"📎",
	"📖",
	"🧾",
	"🗒️",
	"📅",
	"⏱️",
	"🧮",
	"🧪",
	"🔬",
	"🔐",
	"🛡️",
	"🌐",
	"📰",
	"💰",
	"🛒",
	"🍽️",
	"✈️",
	"🎓",
	"🏷️",
	"⭐",
	"❤️",
];

const getIconScreenDefaultValue = (kind: AgentPresetIconScreenKind) =>
	kind === "emoji" ? "✨" : "Hi";

interface AgentIconScreenPickerProps {
	metadataDraft: AgentPresetDraft;
	iconScreenContent?: AgentScreenContent;
	onMetadataChange: <K extends keyof AgentPresetDraft>(
		field: K,
		value: AgentPresetDraft[K],
	) => void;
}

export const AgentIconScreenPicker: React.FC<AgentIconScreenPickerProps> = ({
	metadataDraft,
	iconScreenContent,
	onMetadataChange,
}) => {
	const { t } = useTranslation("agents");
	const currentKind = metadataDraft.iconScreen?.kind ?? "text";
	const currentValue =
		metadataDraft.iconScreen?.value ?? getIconScreenDefaultValue(currentKind);
	const currentColor =
		metadataDraft.iconScreen?.kind === "text"
			? (metadataDraft.iconScreen.color ?? "#17e7e7")
			: "#17e7e7";

	const updateIconScreen = (
		kind: AgentPresetIconScreenKind,
		value = currentValue,
		color = currentColor,
	) => {
		const nextValue = value.trim() || getIconScreenDefaultValue(kind);
		onMetadataChange("iconScreen", {
			kind,
			value: nextValue.slice(0, 24),
			color: kind === "text" ? color : undefined,
		});
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={t("fields.iconScreenEdit")}
					className="group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<AgentIcon size="xl" screenContent={iconScreenContent} />
					<span className="pointer-events-none absolute inset-x-2 bottom-1 rounded bg-background/85 px-1 py-0.5 text-[10px] font-medium text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
						{t("fields.iconScreenEditShort")}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 space-y-4 p-4">
				<div className="flex items-center gap-3">
					<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-muted/20">
						<AgentIcon size="lg" screenContent={iconScreenContent} />
					</div>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-foreground">
							{t("fields.iconScreen")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("fields.iconScreenHint")}
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() =>
							updateIconScreen(
								"text",
								currentKind === "text"
									? currentValue
									: getIconScreenDefaultValue("text"),
							)
						}
						className={cn(
							"flex h-9 items-center justify-center gap-2 rounded-md border text-xs transition-colors",
							currentKind === "text"
								? "border-primary bg-primary/10 text-foreground"
								: "border-border bg-background text-muted-foreground hover:text-foreground",
						)}
					>
						<Type size={14} />
						{t("fields.iconScreenText")}
					</button>
					<button
						type="button"
						onClick={() =>
							updateIconScreen(
								"emoji",
								currentKind === "emoji"
									? currentValue
									: getIconScreenDefaultValue("emoji"),
							)
						}
						className={cn(
							"flex h-9 items-center justify-center gap-2 rounded-md border text-xs transition-colors",
							currentKind === "emoji"
								? "border-primary bg-primary/10 text-foreground"
								: "border-border bg-background text-muted-foreground hover:text-foreground",
						)}
					>
						<Smile size={14} />
						{t("fields.iconScreenEmoji")}
					</button>
				</div>

				<div className="space-y-2">
					<Label className="text-xs text-muted-foreground">
						{currentKind === "emoji"
							? t("fields.iconScreenEmoji")
							: t("fields.iconScreenText")}
					</Label>
					<input
						value={currentValue}
						onChange={(event) =>
							updateIconScreen(currentKind, event.target.value, currentColor)
						}
						placeholder={t("fields.iconScreenPlaceholder")}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-ring"
					/>
				</div>

				{currentKind === "emoji" ? (
					<div className="grid max-h-60 grid-cols-6 gap-1.5 overflow-y-auto pr-1">
						{EMOJI_PICKER_OPTIONS.map((emoji) => (
							<button
								key={emoji}
								type="button"
								onClick={() => updateIconScreen("emoji", emoji)}
								className={cn(
									"flex h-9 items-center justify-center rounded-md border text-lg transition-colors hover:bg-muted",
									currentValue === emoji
										? "border-primary bg-primary/10"
										: "border-border bg-background",
								)}
							>
								{emoji}
							</button>
						))}
					</div>
				) : (
					<div className="space-y-2">
						<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<Palette size={13} />
							{t("fields.iconScreenColor")}
						</div>
						<div className="flex flex-wrap items-center gap-2">
							{ICON_COLOR_SWATCHES.map((color) => (
								<button
									key={color}
									type="button"
									onClick={() => updateIconScreen("text", currentValue, color)}
									aria-label={color}
									className={cn(
										"h-7 w-7 rounded-md border transition-transform hover:scale-105",
										currentColor.toLowerCase() === color.toLowerCase()
											? "border-foreground"
											: "border-border",
									)}
									style={{ backgroundColor: color }}
								/>
							))}
							<input
								type="color"
								value={currentColor}
								onChange={(event) =>
									updateIconScreen("text", currentValue, event.target.value)
								}
								aria-label={t("fields.iconScreenColor")}
								className="h-7 w-9 rounded-md border border-border bg-background p-1"
							/>
						</div>
					</div>
				)}

				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-8 w-full text-xs"
					onClick={() => onMetadataChange("iconScreen", null)}
					disabled={!metadataDraft.iconScreen}
				>
					{t("fields.iconScreenDefault")}
				</Button>
			</PopoverContent>
		</Popover>
	);
};
