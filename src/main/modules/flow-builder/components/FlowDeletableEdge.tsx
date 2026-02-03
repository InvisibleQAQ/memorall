import React, { memo } from "react";
import {
	BaseEdge,
	EdgeLabelRenderer,
	getBezierPath,
	type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";

type FlowEdgeData = {
	onDelete?: (edgeId: string) => void;
};

export const FlowDeletableEdge = memo(
	({
		id,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		markerEnd,
		selected,
		data,
	}: EdgeProps) => {
		const [edgePath, labelX, labelY] = getBezierPath({
			sourceX,
			sourceY,
			targetX,
			targetY,
			sourcePosition,
			targetPosition,
		});

		const edgeData = data as FlowEdgeData | undefined;

		return (
			<>
				<BaseEdge id={id} path={edgePath} markerEnd={markerEnd} />
				{selected && (
					<EdgeLabelRenderer>
						<button
							className="flow-edge-delete"
							style={{
								transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
							}}
							onClick={(event) => {
								event.stopPropagation();
								edgeData?.onDelete?.(id);
							}}
							aria-label="Delete connection"
							type="button"
						>
							<Trash2 className="flow-edge-delete-icon" />
						</button>
					</EdgeLabelRenderer>
				)}
			</>
		);
	},
);
