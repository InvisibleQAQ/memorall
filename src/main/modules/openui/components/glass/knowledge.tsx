import React from "react";
import {
	BuiltinActionType,
	defineComponent,
	useTriggerAction,
} from "@openuidev/react-lang";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const glassCard =
	"rounded-xl border border-white/15 bg-white/8 backdrop-blur-sm";

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
		<div className={glassCard}>
			<div className="flex items-center gap-2 border-b border-white/10 p-3">
				<span className="font-semibold">{props.name}</span>
				<span className="rounded-full bg-white/15 px-2 py-0.5 text-xs">
					{props.entityType}
				</span>
			</div>
			<div className="space-y-2 p-3">
				{props.summary ? (
					<p className="text-sm text-foreground/60">{props.summary}</p>
				) : null}
				{props.facts.length > 0 ? (
					<>
						<div className="h-px bg-white/10" />
						<ul className="space-y-1.5">
							{props.facts.map((fact, i) => (
								<li key={i} className="flex gap-2 text-sm">
									<span className="text-foreground/40">·</span>
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
	props: z.object({ title: z.string().optional(), facts: z.array(factSchema) }),
	component: ({ props }) => (
		<div className={glassCard}>
			{props.title ? (
				<div className="border-b border-white/10 p-3 font-semibold">
					{props.title}
				</div>
			) : null}
			<div className="space-y-2 p-3">
				{props.facts.map((fact, i) => (
					<div
						key={i}
						className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-sm"
					>
						<div className="font-medium">{fact.subject}</div>
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
		<div className={glassCard}>
			{props.title ? (
				<div className="border-b border-white/10 p-3 font-semibold">
					{props.title}
				</div>
			) : null}
			<div className="space-y-3 p-3">
				{props.events.map((event, i) => (
					<div key={i} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
						<div className="text-foreground/50">{event.date}</div>
						<div className="border-l border-white/15 pl-3">
							<div className="font-medium">{event.title}</div>
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
	props: z.object({ entities: z.array(entitySchema) }),
	component: ({ props }) => {
		const { t } = useTranslation("common");
		return (
			<div className="overflow-hidden rounded-xl border border-white/15 backdrop-blur-sm">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-white/15 bg-white/10">
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
								className="border-b border-white/10 bg-white/5 last:border-0 hover:bg-white/10 transition-colors"
							>
								<td className="px-3 py-2 font-medium">{entity.name}</td>
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
		return (
			<div className={glassCard}>
				<div className="border-b border-white/10 p-3 font-semibold">
					{props.title}
				</div>
				<div className="space-y-3 p-3">
					{props.summary ? (
						<p className="text-sm text-foreground/60">{props.summary}</p>
					) : null}
					<div className="grid grid-cols-2 gap-3 text-sm">
						<div className="rounded-lg border border-white/10 bg-white/5 p-3">
							<div className="text-xs text-foreground/50">
								{t("common.entities")}
							</div>
							<div className="text-xl font-semibold">{props.entityCount}</div>
						</div>
						<div className="rounded-lg border border-white/10 bg-white/5 p-3">
							<div className="text-xs text-foreground/50">
								{t("common.facts")}
							</div>
							<div className="text-xl font-semibold">{props.factCount}</div>
						</div>
					</div>
					{typeof props.confidence === "number" ? (
						<div className="space-y-1.5 text-sm">
							<div className="flex justify-between">
								<span>{t("common.confidence")}</span>
								<span className="text-foreground/60">
									{Math.round(props.confidence)}%
								</span>
							</div>
							<div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
								<div
									className="h-full rounded-full bg-gradient-to-r from-white/40 to-white/70 transition-all"
									style={{ width: `${props.confidence}%` }}
								/>
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
	props: z.object({ label: z.string(), prompt: z.string().optional() }),
	component: ({ props }) => {
		const triggerAction = useTriggerAction();
		return (
			<button
				type="button"
				className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-left text-sm backdrop-blur-sm transition-colors hover:bg-white/20"
				onClick={() =>
					triggerAction(props.prompt ?? props.label, undefined, {
						type: BuiltinActionType.ContinueConversation,
						params: {},
					})
				}
			>
				{props.label}
			</button>
		);
	},
});

export const FollowUpBlock = defineComponent({
	name: "FollowUpBlock",
	description: "Suggested follow-up prompts the user can click.",
	props: z.object({ items: z.array(FollowUpItem.ref) }),
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
