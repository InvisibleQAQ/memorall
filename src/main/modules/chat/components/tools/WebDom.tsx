import React from "react";
import { ExternalLink, MousePointerClick } from "lucide-react";
import type { ActionRenderer } from "@/main/modules/chat/components/types";
import type { MessageActionItem } from "@/main/modules/chat/components/types";
import { Badge } from "@/main/components/ui/badge";
import { defaultActionRenderer } from "./DefaultActionRenderer";
import {
	getBoolean,
	getNumber,
	getString,
	getStructuredToolPayload,
	isRecord,
	openToolUrl,
	ToolCodeBlock,
	ToolDetail,
	ToolDetailsGrid,
	ToolRawPayload,
	ToolSection,
	ToolStateBadge,
} from "./ToolCommon";

const extractWebDomPayload = (
	item: MessageActionItem,
): Record<string, unknown> | null => {
	const payload = getStructuredToolPayload(item);
	if (!payload) {
		return null;
	}

	return getString(payload, "actionType") === "web_dom_action" ? payload : null;
};

const renderElementSummary = (
	element: Record<string, unknown>,
	index: number,
): React.ReactNode => {
	const label = getString(element, "label");
	const elementIndex = getNumber(element, "index");
	const tagName = getString(element, "tagName");
	const type = getString(element, "type");
	const id = getString(element, "id");
	const name = getString(element, "name");
	const placeholder = getString(element, "placeholder");
	const ariaLabel = getString(element, "ariaLabel");
	const title = getString(element, "title");
	const role = getString(element, "role");
	const text = getString(element, "text");
	const value = getString(element, "value");
	const visible = getBoolean(element, "visible");
	const disabled = getBoolean(element, "disabled");
	const acceptsTextInput = getBoolean(element, "acceptsTextInput");

	return (
		<div
			key={`${elementIndex ?? index}`}
			className="rounded-lg border border-border/60 bg-background p-3"
		>
			<div className="flex flex-wrap items-start gap-2">
				<div className="text-sm font-medium text-foreground break-words">
					{label || tagName || `Element ${elementIndex ?? index}`}
				</div>
				<div className="flex flex-wrap gap-1">
					{elementIndex !== undefined ? (
						<Badge variant="outline" className="text-[10px]">
							index {elementIndex}
						</Badge>
					) : null}
					{tagName ? (
						<Badge variant="outline" className="text-[10px] font-mono">
							{tagName}
						</Badge>
					) : null}
					{visible !== undefined ? (
						<ToolStateBadge
							ok={visible}
							label={visible ? "visible" : "hidden"}
						/>
					) : null}
					{disabled !== undefined ? (
						<ToolStateBadge
							ok={!disabled}
							label={disabled ? "disabled" : "enabled"}
						/>
					) : null}
					{acceptsTextInput ? (
						<Badge variant="outline" className="text-[10px]">
							text input
						</Badge>
					) : null}
				</div>
			</div>
			<div className="mt-3">
				<ToolDetailsGrid>
					{type ? <ToolDetail label="Type" value={type} mono /> : null}
					{id ? <ToolDetail label="ID" value={id} mono /> : null}
					{name ? <ToolDetail label="Name" value={name} mono /> : null}
					{placeholder ? (
						<ToolDetail label="Placeholder" value={placeholder} />
					) : null}
					{ariaLabel ? (
						<ToolDetail label="Aria label" value={ariaLabel} />
					) : null}
					{title ? <ToolDetail label="Title" value={title} /> : null}
					{role ? <ToolDetail label="Role" value={role} mono /> : null}
				</ToolDetailsGrid>
			</div>
			{text ? (
				<div className="mt-3">
					<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
						Text
					</div>
					<ToolCodeBlock>{text}</ToolCodeBlock>
				</div>
			) : null}
			{value ? (
				<div className="mt-3">
					<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
						Value
					</div>
					<ToolCodeBlock>{value}</ToolCodeBlock>
				</div>
			) : null}
		</div>
	);
};

export const webDomRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const payload = extractWebDomPayload(item);
	if (!payload) {
		return defaultActionRenderer(item, isOpen);
	}

	const success = getBoolean(payload, "success");
	const error = getString(payload, "error");
	const action = getString(payload, "action");
	const selector = getString(payload, "selector");
	const sessionId = getString(payload, "sessionId");
	const url = getString(payload, "url");
	const note = getString(payload, "note");
	const result = payload.result;

	return (
		<div className="space-y-3">
			<ToolSection>
				<div className="flex items-start gap-3">
					<div className="mt-0.5 rounded-md border border-border/60 bg-muted/20 p-2">
						<MousePointerClick className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<ToolStateBadge ok={success} />
							{action ? (
								<Badge variant="outline" className="text-[10px] font-mono">
									{action}
								</Badge>
							) : null}
							{selector ? (
								<Badge variant="outline" className="text-[10px] font-mono">
									{selector}
								</Badge>
							) : null}
						</div>
						{url ? (
							<div className="flex items-center gap-2 text-xs text-muted-foreground">
								<span className="min-w-0 flex-1 truncate font-mono">{url}</span>
								<button
									type="button"
									className="shrink-0 text-muted-foreground hover:text-foreground"
									onClick={() => openToolUrl(url)}
									title="Open URL"
								>
									<ExternalLink className="h-3.5 w-3.5" />
								</button>
							</div>
						) : null}
					</div>
				</div>

				{error ? (
					<div className="mt-3 rounded-md border border-red-600/20 bg-red-600/5 px-3 py-2 text-xs text-red-700">
						{error}
					</div>
				) : null}

				<div className="mt-3">
					<ToolDetailsGrid>
						{sessionId ? (
							<ToolDetail label="Session" value={sessionId} mono />
						) : null}
						{action ? <ToolDetail label="Action" value={action} mono /> : null}
						{selector ? (
							<ToolDetail label="Selector" value={selector} mono />
						) : null}
					</ToolDetailsGrid>
				</div>

				{note ? (
					<div className="mt-3 rounded-md border border-border/60 bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
						{note}
					</div>
				) : null}
			</ToolSection>

			{Array.isArray(result) ? (
				<ToolSection title={`Matched Elements (${result.length})`}>
					<div className="space-y-3">
						{result.map((entry, index) =>
							isRecord(entry) ? renderElementSummary(entry, index) : null,
						)}
					</div>
				</ToolSection>
			) : isRecord(result) ? (
				<ToolSection title="Action Result">
					{renderElementSummary(result, 0)}
				</ToolSection>
			) : null}

			<ToolRawPayload payload={payload} />
		</div>
	);
};
