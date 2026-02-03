import React, { useCallback } from "react";
import "@xyflow/react/dist/style.css";
import "./flow-builder.css";
import { useFlowBuilderStore } from "@/main/stores/flow-builder";
import {
	FlowBuilderHeader,
	FlowBuilderStepsPanel,
	FlowBuilderCanvas,
	FlowBuilderInspector,
	CreateFlowDialog,
} from "./components";

export const FlowBuilderPage: React.FC = () => {
	const {
		flows,
		catalog,
		selectedFlowId,
		flowName,
		flowDescription,
		flowStatus,
		serviceKeys,
		flowStates,
		nodes,
		edges,
		isLoading,
		isSaving,
		isDirty,
		error,
		initialize,
		selectFlow,
		createFlow,
		saveFlow,
		deleteFlow,
		setFlowMeta,
		addStateField,
		removeStateField,
		updateStateField,
		onNodesChange,
		onEdgesChange,
		onConnect,
		addNodeForStep,
	} = useFlowBuilderStore();

	const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
	const [leftPanelOpen, setLeftPanelOpen] = React.useState(true);
	const [rightPanelOpen, setRightPanelOpen] = React.useState(true);
	const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(
		null,
	);
	const [isDeleting, setIsDeleting] = React.useState(false);

	React.useEffect(() => {
		initialize();
	}, [initialize]);

	const handleCreateFlow = useCallback(
		async (name: string) => {
			await createFlow(name);
		},
		[createFlow],
	);

	const handleNodeClick = useCallback((nodeId: string) => {
		setSelectedNodeId(nodeId);
	}, []);

	const handleDropStep = useCallback(
		(stepId: string, position: { x: number; y: number }) => {
			addNodeForStep(stepId, position);
		},
		[addNodeForStep],
	);

	const handleDeleteFlow = useCallback(async () => {
		if (!selectedFlowId) return;
		setIsDeleting(true);
		try {
			await deleteFlow(selectedFlowId);
			setSelectedNodeId(null);
		} finally {
			setIsDeleting(false);
		}
	}, [deleteFlow, selectedFlowId]);

	return (
		<div className="h-full flex flex-col flow-builder min-h-0 max-h-full">
			<FlowBuilderHeader
				flows={flows}
				selectedFlowId={selectedFlowId}
				isDirty={isDirty}
				isSaving={isSaving}
				isDeleting={isDeleting}
				onSelectFlow={selectFlow}
				onSave={saveFlow}
				onDelete={handleDeleteFlow}
				onCreateClick={() => setIsCreateModalOpen(true)}
			/>

			<div className="flex-1 grid grid-cols-[auto_1fr_auto] gap-0 min-h-0 h-full max-h-full">
				<FlowBuilderStepsPanel
					steps={catalog.steps}
					isOpen={leftPanelOpen}
					onOpenChange={setLeftPanelOpen}
				/>

				<FlowBuilderCanvas
					nodes={nodes}
					edges={edges}
					selectedFlowId={selectedFlowId}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					onNodeClick={handleNodeClick}
					onDropStep={handleDropStep}
				/>

				<FlowBuilderInspector
					isOpen={rightPanelOpen}
					onOpenChange={setRightPanelOpen}
					flowName={flowName}
					flowDescription={flowDescription}
					flowStatus={flowStatus}
					serviceKeys={serviceKeys}
					flowStates={flowStates}
					catalog={catalog}
					selectedNodeId={selectedNodeId}
					error={error}
					isLoading={isLoading}
					onFlowMetaChange={setFlowMeta}
					onAddStateField={addStateField}
					onRemoveStateField={removeStateField}
					onUpdateStateField={updateStateField}
				/>
			</div>

			<CreateFlowDialog
				open={isCreateModalOpen}
				onOpenChange={setIsCreateModalOpen}
				onCreateFlow={handleCreateFlow}
			/>
		</div>
	);
};
