import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/main/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import type { AgentWizardDraft } from "@/main/modules/agent-wizard";
import {
	DEFAULT_GROW_TYPE,
	DEFAULT_RECALL_TYPE,
	GROW_TYPES,
	getValidRecallTypes,
	type GrowType,
	type RecallType,
} from "@/services/database/entities/topic-types";

export type CreateAgentTopicOptions = {
	growType: GrowType;
	recallType: RecallType;
};

export type CreateAgentOptions = CreateAgentTopicOptions & {
	status?: AgentWizardDraft["status"];
};

const getGrowLabels = (
	t: (key: string, opts?: Record<string, unknown>) => string,
): Record<GrowType, string> => ({
	"knowledge-graph": t("wizard.growType.knowledgeGraph", { ns: "agents" }),
	structmem: t("wizard.growType.structmem", { ns: "agents" }),
});

const getRecallLabels = (
	t: (key: string, opts?: Record<string, unknown>) => string,
): Record<RecallType, string> => ({
	smart: t("wizard.recallType.smart", { ns: "agents" }),
	quick: t("wizard.recallType.quick", { ns: "agents" }),
	llm: t("wizard.recallType.llm", { ns: "agents" }),
	structmem: t("wizard.recallType.structmem", { ns: "agents" }),
});

const MemoryTypeSelectFields: React.FC<{
	growType: GrowType;
	recallType: RecallType;
	onGrowTypeChange: (value: GrowType) => void;
	onRecallTypeChange: (value: RecallType) => void;
	labelPrefix?: string;
}> = ({
	growType,
	recallType,
	onGrowTypeChange,
	onRecallTypeChange,
	labelPrefix,
}) => {
	const { t } = useTranslation(["topics", "agents"]);
	const growLabels = getGrowLabels(t);
	const recallLabels = getRecallLabels(t);
	const validRecallTypes = getValidRecallTypes(growType);
	const label = (key: string) =>
		labelPrefix ? t(`${labelPrefix}:${key}`) : t(key);

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			<div className="space-y-2">
				<Label>{label("types.growType")}</Label>
				<Select
					value={growType}
					onValueChange={(value) => {
						const nextGrowType = value as GrowType;
						const nextRecallTypes = getValidRecallTypes(nextGrowType);
						onGrowTypeChange(nextGrowType);
						if (!nextRecallTypes.includes(recallType)) {
							onRecallTypeChange(nextRecallTypes[0]);
						}
					}}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{GROW_TYPES.map((type) => (
							<SelectItem key={type} value={type}>
								{growLabels[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="space-y-2">
				<Label>{label("types.recallType")}</Label>
				<Select
					value={recallType}
					onValueChange={(value) => onRecallTypeChange(value as RecallType)}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{validRecallTypes.map((type) => (
							<SelectItem key={type} value={type}>
								{recallLabels[type]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
};

export const AgentMemoryTypeFields: React.FC<{
	resetToken: number;
	setExtra: (extra: CreateAgentTopicOptions) => void;
}> = ({ resetToken, setExtra }) => {
	const [growType, setGrowType] = React.useState<GrowType>(DEFAULT_GROW_TYPE);
	const [recallType, setRecallType] =
		React.useState<RecallType>(DEFAULT_RECALL_TYPE);

	React.useEffect(() => {
		setGrowType(DEFAULT_GROW_TYPE);
		setRecallType(DEFAULT_RECALL_TYPE);
	}, [resetToken]);

	React.useEffect(() => {
		setExtra({ growType, recallType });
	}, [growType, recallType, setExtra]);

	return (
		<MemoryTypeSelectFields
			growType={growType}
			recallType={recallType}
			onGrowTypeChange={setGrowType}
			onRecallTypeChange={setRecallType}
		/>
	);
};

export const AgentMemoryTypeDialog: React.FC<{
	open: boolean;
	defaultValue: CreateAgentTopicOptions;
	isBusy: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (options: CreateAgentTopicOptions) => void;
}> = ({ open, defaultValue, isBusy, onOpenChange, onSubmit }) => {
	const { t } = useTranslation(["agents", "topics", "common"]);
	const [growType, setGrowType] = React.useState<GrowType>(
		defaultValue.growType,
	);
	const [recallType, setRecallType] = React.useState<RecallType>(
		defaultValue.recallType,
	);

	React.useEffect(() => {
		if (!open) return;
		setGrowType(defaultValue.growType);
		setRecallType(defaultValue.recallType);
	}, [defaultValue.growType, defaultValue.recallType, open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{t("topics:types.title")}</DialogTitle>
					<DialogDescription>
						{t("agents:wizard.memoryTypeDialog.description")}
					</DialogDescription>
				</DialogHeader>

				<MemoryTypeSelectFields
					growType={growType}
					recallType={recallType}
					onGrowTypeChange={setGrowType}
					onRecallTypeChange={setRecallType}
					labelPrefix="topics"
				/>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isBusy}
					>
						{t("common:buttons.cancel")}
					</Button>
					<Button
						type="button"
						onClick={() => onSubmit({ growType, recallType })}
						disabled={isBusy}
					>
						{isBusy ? t("agents:actions.saving") : t("agents:actions.submit")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
