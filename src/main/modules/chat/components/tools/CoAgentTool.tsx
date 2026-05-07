import React from "react";
import type { MessageActionItem } from "@/main/modules/chat/components/types";
import {
	ToolCodeBlock,
	ToolDetail,
	ToolDetailsGrid,
	ToolItemRawIO,
	ToolSection,
	ToolStateBadge,
	getBoolean,
	getNumber,
	getString,
	getToolCallArguments,
	isRecord,
} from "./ToolCommon";

const CO_AGENT_LABELS: Record<string, string> = {
	co_agent_query: "Query page",
	co_agent_move: "Move cursor",
	co_agent_observe: "Observe page",
	co_agent_scroll: "Scroll page",
	co_agent_click: "Click element",
	co_agent_input: "Type text",
	co_agent_error: "Co-agent error",
};

const DESCRIPTION_OUTPUT_MARKER = "\noutput:\n";

export const isCoAgentAction = (name: string): boolean =>
	name === "co_agent_error" || name.startsWith("co_agent_");

export const getCoAgentActionTitle = (name: string): string | null =>
	CO_AGENT_LABELS[name] ?? (isCoAgentAction(name) ? "Co-agent action" : null);

const getDescriptionOutput = (description: string): string => {
	const markerIndex = description.indexOf(DESCRIPTION_OUTPUT_MARKER);
	return markerIndex === -1
		? description.trim()
		: description.slice(markerIndex + DESCRIPTION_OUTPUT_MARKER.length).trim();
};

const compact = (value: string | undefined, max = 180): string | undefined => {
	const text = value?.replace(/\s+/g, " ").trim();
	if (!text) return undefined;
	return text.length > max ? `${text.slice(0, max)}...` : text;
};

const getStructuredPayload = (
	item: MessageActionItem,
): Record<string, unknown> | null => {
	if (isRecord(item.metadata) && typeof item.metadata.actionType === "string") {
		return item.metadata;
	}

	const output = getDescriptionOutput(item.description);
	try {
		const parsed = JSON.parse(output);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const getCoAgentActionStatus = (
	item: MessageActionItem,
): { ok?: boolean; label: string } => {
	const payload = getStructuredPayload(item);
	if (payload) {
		const success = getBoolean(payload, "success");
		if (success === true) return { ok: true, label: "done" };
		if (success === false) return { ok: false, label: "failed" };
	}

	const output = getDescriptionOutput(item.description).toLowerCase();
	if (output.includes("failed") || output.includes("error:")) {
		return { ok: false, label: "failed" };
	}
	if (output.includes(" ok")) {
		return { ok: true, label: "done" };
	}
	return { label: "done" };
};

const getTargetSummary = (
	args: Record<string, unknown> | null,
	payload: Record<string, unknown> | null,
): string | undefined => {
	const selector =
		getString(payload ?? {}, "selector") ?? getString(args ?? {}, "selector");
	if (selector) return selector;

	const x = getNumber(args ?? {}, "x");
	const y = getNumber(args ?? {}, "y");
	if (x !== undefined && y !== undefined) {
		return `${Math.round(x)}, ${Math.round(y)}`;
	}

	const scope = getString(args ?? {}, "scope");
	if (scope) return scope;

	return undefined;
};

const getOutputPreview = (
	item: MessageActionItem,
	payload: Record<string, unknown> | null,
): string | undefined => {
	if (payload) {
		return (
			compact(getString(payload, "description")) ??
			compact(getString(payload, "error")) ??
			compact(getString(payload, "note"))
		);
	}

	const output = getDescriptionOutput(item.description);
	const usefulLine = output
		.split("\n")
		.map((line) => line.trim())
		.find(
			(line) =>
				line &&
				!line.startsWith("co_agent_") &&
				!line.startsWith("scope:") &&
				!line.startsWith("page:") &&
				!line.startsWith("url:"),
		);
	return compact(usefulLine ?? output);
};

export const getCoAgentActionPreview = (
	item: MessageActionItem,
): string | null => {
	if (!isCoAgentAction(item.name)) return null;
	const args = getToolCallArguments(item);
	const payload = getStructuredPayload(item);
	const target = getTargetSummary(args, payload);
	const preview = getOutputPreview(item, payload);

	return [target, preview].filter(Boolean).join(" - ") || null;
};

export const coAgentToolRenderer = (
	item: MessageActionItem,
	isOpen: boolean,
): React.ReactNode | null => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const payload = getStructuredPayload(item);
	const status = getCoAgentActionStatus(item);
	const target = getTargetSummary(args, payload);
	const output = getDescriptionOutput(item.description);

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<ToolStateBadge ok={status.ok} label={status.label} />
				<span className="text-xs font-medium text-foreground">
					{getCoAgentActionTitle(item.name)}
				</span>
				{target ? (
					<span className="min-w-0 truncate rounded-md border border-border/50 bg-muted/20 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
						{target}
					</span>
				) : null}
			</div>

			{args ? (
				<ToolSection title="Input">
					<ToolDetailsGrid>
						{Object.entries(args).map(([key, value]) => (
							<ToolDetail
								key={key}
								label={key}
								value={
									typeof value === "string"
										? value
										: JSON.stringify(value, null, 2)
								}
								mono
							/>
						))}
					</ToolDetailsGrid>
				</ToolSection>
			) : null}

			<ToolSection title="Result">
				<ToolCodeBlock>{output || "No output returned."}</ToolCodeBlock>
			</ToolSection>

			<ToolItemRawIO
				item={item}
				input={args ?? undefined}
				output={payload ?? output}
			/>
		</div>
	);
};
