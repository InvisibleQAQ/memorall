import React from "react";
import {
	BuiltinActionType,
	defineComponent,
	useTriggerAction,
} from "@openuidev/react-lang";
import { useTranslation } from "react-i18next";
import { z } from "zod";

export const KnowledgeCard = defineComponent({
	name: "KnowledgeCard",
	description:
		"Shows one knowledge entity with type badge, summary, and facts.",
	props: z.object({
		name: z.string(),
		entityType: z.string(),
		facts: z.array(z.string()).default([]),
		summary: z.string().optional(),
	}),
	component: ({ props }) => (
		<div className="border-2 border-dashed border-foreground/40 font-mono">
			<div className="flex items-center gap-2 border-b border-dashed border-foreground/30 p-3">
				<span className="font-semibold">{props.name}</span>
				<span className="border border-foreground/40 px-1 text-xs">
					{props.entityType}
				</span>
			</div>
			<div className="space-y-2 p-3">
				{props.summary ? (
					<p className="text-sm text-foreground/60">{props.summary}</p>
				) : null}
				{props.facts.length > 0 ? (
					<>
						<div className="text-xs text-foreground/40">{"─".repeat(20)}</div>
						<ul className="space-y-1">
							{props.facts.map((fact, i) => (
								<li key={i} className="flex gap-2 text-sm">
									<span className="text-foreground/40">-</span>
									<span>{fact}</span>
								</li>
							))}
						</ul>
					</>
				) : null}
			</div>
		</div>
	),
});

const factSchema = z.object({
	subject: z.string(),
	predicate: z.string(),
	object: z.string(),
	date: z.string().optional(),
});

export const FactList = defineComponent({
	name: "FactList",
	description: "List of subject-predicate-object knowledge facts.",
	props: z.object({
		title: z.string().optional(),
		facts: z.array(factSchema),
	}),
	component: ({ props }) => (
		<div className="border-2 border-dashed border-foreground/40 font-mono">
			{props.title ? (
				<div className="border-b border-dashed border-foreground/30 p-3 font-semibold">
					{props.title}
				</div>
			) : null}
			<div className="space-y-2 p-3">
				{props.facts.map((fact, i) => (
					<div
						key={i}
						className="border border-dashed border-foreground/20 p-2 text-sm"
					>
						<div className="font-semibold">{fact.subject}</div>
						<div className="text-foreground/60">
							{fact.predicate} {fact.object}
						</div>
						{fact.date ? (
							<div className="mt-0.5 text-xs text-foreground/40">
								{fact.date}
							</div>
						) : null}
					</div>
				))}
			</div>
		</div>
	),
});

const timelineEventSchema = z.object({
	date: z.string(),
	title: z.string(),
	description: z.string().optional(),
});

export const Timeline = defineComponent({
	name: "Timeline",
	description: "Chronological events with dates.",
	props: z.object({
		title: z.string().optional(),
		events: z.array(timelineEventSchema),
	}),
	component: ({ props }) => (
		<div className="border-2 border-dashed border-foreground/40 font-mono">
			{props.title ? (
				<div className="border-b border-dashed border-foreground/30 p-3 font-semibold">
					{props.title}
				</div>
			) : null}
			<div className="space-y-3 p-3">
				{props.events.map((event, i) => (
					<div key={i} className="grid grid-cols-[7rem_1fr] gap-2 text-sm">
						<div className="text-foreground/50">{event.date}</div>
						<div className="border-l border-dashed border-foreground/30 pl-3">
							<div className="font-semibold">{event.title}</div>
							{event.description ? (
								<div className="mt-0.5 text-foreground/60">
									{event.description}
								</div>
							) : null}
						</div>
					</div>
				))}
			</div>
		</div>
	),
});

const entitySchema = z.object({
	name: z.string(),
	entityType: z.string(),
	summary: z.string().optional(),
});

export const EntityList = defineComponent({
	name: "EntityList",
	description: "Compact list of knowledge entities.",
	props: z.object({
		entities: z.array(entitySchema),
	}),
	component: ({ props }) => {
		const { t } = useTranslation("common");
		return (
			<div className="border-2 border-dashed border-foreground/40 font-mono">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-dashed border-foreground/40">
							<th className="px-3 py-2 text-left font-semibold">
								{t("common.name")}
							</th>
							<th className="px-3 py-2 text-left font-semibold">
								{t("common.type")}
							</th>
							<th className="px-3 py-2 text-left font-semibold">
								{t("common.summary")}
							</th>
						</tr>
					</thead>
					<tbody>
						{props.entities.map((entity, i) => (
							<tr
								key={`${entity.name}-${i}`}
								className="border-b border-dashed border-foreground/20 last:border-0"
							>
								<td className="px-3 py-2 font-semibold">{entity.name}</td>
								<td className="px-3 py-2">{entity.entityType}</td>
								<td className="px-3 py-2 text-foreground/60">
									{entity.summary ?? ""}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	},
});

export const TopicSummary = defineComponent({
	name: "TopicSummary",
	description: "Stats card for a knowledge topic.",
	props: z.object({
		title: z.string(),
		entityCount: z.number().int().min(0),
		factCount: z.number().int().min(0),
		confidence: z.number().min(0).max(100).optional(),
		summary: z.string().optional(),
	}),
	component: ({ props }) => {
		const { t } = useTranslation("common");
		const filled =
			typeof props.confidence === "number"
				? Math.round(props.confidence / 5)
				: 0;
		return (
			<div className="border-2 border-dashed border-foreground/40 font-mono">
				<div className="border-b border-dashed border-foreground/30 p-3 font-semibold">
					[{props.title}]
				</div>
				<div className="space-y-3 p-3">
					{props.summary ? (
						<p className="text-sm text-foreground/60">{props.summary}</p>
					) : null}
					<div className="grid grid-cols-2 gap-3 text-sm">
						<div className="border border-dashed border-foreground/30 p-2">
							<div className="text-xs text-foreground/50">
								{t("common.entities")}
							</div>
							<div className="text-xl font-semibold">{props.entityCount}</div>
						</div>
						<div className="border border-dashed border-foreground/30 p-2">
							<div className="text-xs text-foreground/50">
								{t("common.facts")}
							</div>
							<div className="text-xl font-semibold">{props.factCount}</div>
						</div>
					</div>
					{typeof props.confidence === "number" ? (
						<div className="space-y-1 text-sm">
							<div className="flex justify-between">
								<span>{t("common.confidence")}</span>
								<span className="text-foreground/60">
									{Math.round(props.confidence)}%
								</span>
							</div>
							<div className="text-xs tracking-tight">
								[{"█".repeat(filled)}
								{"░".repeat(20 - filled)}]
							</div>
						</div>
					) : null}
				</div>
			</div>
		);
	},
});

export const FollowUpItem = defineComponent({
	name: "FollowUpItem",
	description: "Suggested follow-up prompt.",
	props: z.object({
		label: z.string(),
		prompt: z.string().optional(),
	}),
	component: ({ props }) => {
		const triggerAction = useTriggerAction();
		return (
			<button
				type="button"
				className="border border-dashed border-foreground/50 px-3 py-1.5 text-left font-mono text-sm transition-colors hover:border-foreground hover:bg-foreground/5"
				onClick={() =>
					triggerAction(props.prompt ?? props.label, undefined, {
						type: BuiltinActionType.ContinueConversation,
						params: {},
					})
				}
			>
				▷ {props.label}
			</button>
		);
	},
});

export const FollowUpBlock = defineComponent({
	name: "FollowUpBlock",
	description: "Suggested follow-up prompts the user can click.",
	props: z.object({
		items: z.array(FollowUpItem.ref),
	}),
	component: ({ props, renderNode }) => (
		<div className="flex flex-wrap gap-2">{renderNode(props.items)}</div>
	),
});

export const knowledgeComponents = [
	KnowledgeCard,
	FactList,
	Timeline,
	EntityList,
	TopicSummary,
	FollowUpItem,
	FollowUpBlock,
];
