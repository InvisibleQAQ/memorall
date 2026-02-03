import React from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { Play, Square } from "lucide-react";
import type { FlowNodeData } from "@/main/stores/flow-builder";

const FoundationNode: React.FC<{
	label: string;
	handle: "in" | "out";
	icon: React.ReactNode;
}> = ({ label, handle, icon }) => {
	const handleStyle = { top: "50%", transform: "translateY(-50%)" };
	return (
		<div className="flex flex-col items-center gap-2">
			<div className="flow-foundation-node flex items-center justify-center text-muted-foreground">
				{handle === "in" && (
					<Handle
						id="in"
						type="target"
						position={Position.Left}
						style={handleStyle}
					/>
				)}
				{handle === "out" && (
					<Handle
						id="out"
						type="source"
						position={Position.Right}
						style={handleStyle}
					/>
				)}
				<span className="text-foreground">{icon}</span>
			</div>
		</div>
	);
};

export const FlowStartNode: React.FC<NodeProps<Node<FlowNodeData>>> = () => {
	const { t } = useTranslation();
	return (
		<FoundationNode
			label={t("flowBuilder.nodeTypes.start", { defaultValue: "Start" })}
			handle="out"
			icon={<Play className="h-4 w-4" />}
		/>
	);
};

export const FlowEndNode: React.FC<NodeProps<Node<FlowNodeData>>> = () => {
	const { t } = useTranslation();
	return (
		<FoundationNode
			label={t("flowBuilder.nodeTypes.end", { defaultValue: "End" })}
			handle="in"
			icon={<Square className="h-4 w-4" />}
		/>
	);
};

export const FlowStepNode: React.FC<NodeProps<Node<FlowNodeData>>> = ({
	data,
}) => {
	const { t } = useTranslation();
	const nodeData = data;

	const typeLabel = t("flowBuilder.nodeTypes.step", { defaultValue: "Step" });

	return (
		<div className="flow-step-node">
			<Handle id="in" type="target" position={Position.Left} />
			<Handle id="out" type="source" position={Position.Right} />
			<div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
				<span>{typeLabel}</span>
			</div>
			<div className="font-semibold text-sm text-foreground">
				{nodeData.label || typeLabel}
			</div>
		</div>
	);
};

export const flowNodeTypes = {
	flowStart: FlowStartNode,
	flowEnd: FlowEndNode,
	flowStep: FlowStepNode,
};
