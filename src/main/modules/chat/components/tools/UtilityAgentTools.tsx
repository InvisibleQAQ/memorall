import React from "react";
import { Bot, Clock3, ScrollText } from "lucide-react";
import type {
	ActionRenderer,
	MessageActionItem,
} from "@/main/modules/chat/components/types";
import { defaultActionRenderer } from "./DefaultActionRenderer";
import {
	getToolCallArguments,
	ToolCodeBlock,
	ToolDetail,
	ToolDetailsGrid,
	ToolItemRawIO,
	ToolSection,
} from "./ToolCommon";

const DESCRIPTION_OUTPUT_MARKER = "\noutput:\n";

const getActionOutput = (item: MessageActionItem): string => {
	const description = item.description?.trim() || "";
	const markerIndex = description.indexOf(DESCRIPTION_OUTPUT_MARKER);

	if (markerIndex === -1) {
		return description;
	}

	return description
		.slice(markerIndex + DESCRIPTION_OUTPUT_MARKER.length)
		.trim();
};

const getStringArg = (
	args: Record<string, unknown> | null,
	key: string,
): string | undefined =>
	typeof args?.[key] === "string" ? args[key] : undefined;

const extractLoadedSkill = (
	output: string,
): { name: string; body: string } | null => {
	const match = output.match(
		/^<skill name="([^"]+)">\n?([\s\S]*?)\n?<\/skill>$/,
	);
	if (!match) {
		return null;
	}

	return {
		name: match[1],
		body: match[2].trim(),
	};
};

const extractCurrentTime = (
	output: string,
): { timezone?: string; value: string } | null => {
	const utcMatch = output.match(/^Current UTC time:\s*(.+)$/);
	if (utcMatch) {
		return { timezone: "UTC", value: utcMatch[1].trim() };
	}

	const localMatch = output.match(/^Current time in (.+?):\s*(.+)$/);
	if (localMatch) {
		return {
			timezone: localMatch[1].trim(),
			value: localMatch[2].trim(),
		};
	}

	return output ? { value: output } : null;
};

export const currentTimeToolRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const output = getActionOutput(item);
	const view = extractCurrentTime(output);

	if (!view) {
		return defaultActionRenderer(item, isOpen);
	}

	return (
		<div className="space-y-3">
			<ToolSection>
				<div className="flex items-start gap-3">
					<div className="mt-0.5 rounded-md border border-border/60 bg-muted/20 p-2">
						<Clock3 className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1 space-y-3">
						<div className="text-sm font-medium text-foreground">
							{view.value}
						</div>
						<ToolDetailsGrid>
							<ToolDetail
								label="Timezone"
								value={getStringArg(args, "timezone") || view.timezone || "UTC"}
								mono
							/>
						</ToolDetailsGrid>
					</div>
				</div>
			</ToolSection>
			<ToolItemRawIO item={item} input={args ?? undefined} output={output} />
		</div>
	);
};

export const loadSkillToolRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const output = getActionOutput(item);
	const loadedSkill = extractLoadedSkill(output);

	return (
		<div className="space-y-3">
			<ToolSection>
				<div className="flex items-start gap-3">
					<div className="mt-0.5 rounded-md border border-border/60 bg-muted/20 p-2">
						<ScrollText className="h-4 w-4 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1 space-y-3">
						<ToolDetailsGrid>
							<ToolDetail
								label="Skill"
								value={
									loadedSkill?.name ||
									getStringArg(args, "skill_name") ||
									"Unknown skill"
								}
								mono
							/>
						</ToolDetailsGrid>
						<ToolCodeBlock>
							{loadedSkill?.body || output || "No skill content returned."}
						</ToolCodeBlock>
					</div>
				</div>
			</ToolSection>
			<ToolItemRawIO item={item} input={args ?? undefined} output={output} />
		</div>
	);
};

export const sendMessageToAgentToolRenderer: ActionRenderer = (
	item,
	isOpen,
) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const output = getActionOutput(item);
	const parentMessage = getStringArg(args, "message");
	const agentId = getStringArg(args, "agentId");

	return (
		<div className="space-y-3">
			<ToolSection title="Child Agent Conversation">
				<div className="space-y-3">
					{agentId ? (
						<ToolDetailsGrid>
							<ToolDetail label="Agent ID" value={agentId} mono />
						</ToolDetailsGrid>
					) : null}
					<div className="space-y-2">
						<div className="flex justify-end">
							<div className="max-w-[90%] rounded-2xl rounded-br-md bg-primary/10 px-4 py-3 text-sm text-foreground">
								<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									Parent agent
								</div>
								<div className="whitespace-pre-wrap break-words">
									{parentMessage || "No parent message available."}
								</div>
							</div>
						</div>
						<div className="flex justify-start">
							<div className="max-w-[90%] rounded-2xl rounded-bl-md border border-border/60 bg-muted/20 px-4 py-3 text-sm text-foreground">
								<div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
									<Bot className="h-3.5 w-3.5" />
									Child agent
								</div>
								<div className="whitespace-pre-wrap break-words">
									{output || "No response returned."}
								</div>
							</div>
						</div>
					</div>
				</div>
			</ToolSection>
			<ToolItemRawIO item={item} input={args ?? undefined} output={output} />
		</div>
	);
};
