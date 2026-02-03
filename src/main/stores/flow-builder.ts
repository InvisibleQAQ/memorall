import { create } from "zustand";
import {
	addEdge,
	applyEdgeChanges,
	applyNodeChanges,
	type Connection,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import { serviceManager } from "@/services";
import type { Flow } from "@/services/database/types";
import type {
	FlowCatalog,
	FlowConnectionInput,
	FlowLayout,
	FlowStateInput,
	FlowStepInput,
} from "@/services/flows/interfaces/flow-builder";
import { logError } from "@/utils/logger";
import { validateFlowGraph } from "@/services/flows/flow-builder-validation";
import type { CatalogStep } from "@/services/flows/flow-builder-catalog";

export interface FlowNodeData extends Record<string, unknown> {
	catalogStepId: string;
	label: string;
	stepType: string;
	isStart: boolean;
	isEnd: boolean;
}

export interface FlowBuilderState {
	flows: Flow[];
	catalog: FlowCatalog;
	selectedFlowId: string | null;
	flowName: string;
	flowDescription: string;
	flowStatus: string;
	serviceKeys: string[];
	flowStates: FlowStateInput[];
	nodes: Node<FlowNodeData>[];
	edges: Edge[];
	isLoading: boolean;
	isSaving: boolean;
	isDirty: boolean;
	error: string | null;

	initialize: () => Promise<void>;
	selectFlow: (flowId: string) => Promise<void>;
	createFlow: (name: string) => Promise<void>;
	saveFlow: () => Promise<void>;
	deleteFlow: (flowId: string) => Promise<void>;

	setFlowMeta: (meta: {
		name?: string;
		description?: string;
		status?: string;
		serviceKeys?: string[];
	}) => void;
	addStateField: (state: FlowStateInput) => void;
	removeStateField: (name: string) => void;
	updateStateField: (name: string, updates: Partial<FlowStateInput>) => void;

	onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
	onEdgesChange: (changes: EdgeChange[]) => void;
	onConnect: (connection: Connection) => void;
	addNodeForStep: (catalogStepId: string, position: { x: number; y: number }) => void;
}

const emptyCatalog: FlowCatalog = { services: [], steps: [] };

const START_NODE_ID = "__start__";
const END_NODE_ID = "__end__";
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_REGEX.test(value);

const generateNodeId = (): string => {
	return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const buildDefaultNodes = (): Node<FlowNodeData>[] => [
	{
		id: START_NODE_ID,
		type: "flowStart",
		position: { x: 80, y: 160 },
		data: {
			catalogStepId: START_NODE_ID,
			label: "Start",
			stepType: "system",
			isStart: true,
			isEnd: false,
		},
	},
	{
		id: END_NODE_ID,
		type: "flowEnd",
		position: { x: 520, y: 160 },
		data: {
			catalogStepId: END_NODE_ID,
			label: "End",
			stepType: "system",
			isStart: false,
			isEnd: true,
		},
	},
];

const ensureTerminalNodes = (nodes: Node<FlowNodeData>[]): Node<FlowNodeData>[] => {
	const existingIds = new Set(nodes.map((node) => node.id));
	const next = [...nodes];
	if (!existingIds.has(START_NODE_ID)) {
		next.unshift({
			id: START_NODE_ID,
			type: "flowStart",
			position: { x: 80, y: 160 },
			data: {
				catalogStepId: START_NODE_ID,
				label: "Start",
				stepType: "system",
				isStart: true,
				isEnd: false,
			},
		});
	}
	if (!existingIds.has(END_NODE_ID)) {
		next.push({
			id: END_NODE_ID,
			type: "flowEnd",
			position: { x: 520, y: 160 },
			data: {
				catalogStepId: END_NODE_ID,
				label: "End",
				stepType: "system",
				isStart: false,
				isEnd: true,
			},
		});
	}
	return next;
};

const setNodeFlag = (
	nodes: Node<FlowNodeData>[],
	nodeId: string,
	flag: "isStart" | "isEnd",
	value: boolean,
): Node<FlowNodeData>[] =>
	nodes.map((node) =>
		node.id === nodeId
			? {
					...node,
					data: { ...node.data, [flag]: value },
				}
			: node,
	);

const ensureVirtualEdge = (
	edges: Edge[],
	source: string,
	target: string,
): Edge[] => {
	const id = `${source}-${target}`;
	if (edges.some((edge) => edge.id === id)) {
		return edges;
	}
	return [
		...edges,
		{
			id,
			source,
			target,
			sourceHandle: "out",
			targetHandle: "in",
			data: { virtual: true },
		},
	];
};

const buildLayout = (nodes: Node<FlowNodeData>[]): FlowLayout => ({
	nodes: nodes
		.filter((node) => node.id !== START_NODE_ID && node.id !== END_NODE_ID)
		.map((node) => ({
			stepId: node.id,
			position: node.position,
			isStart: node.data.isStart,
			isEnd: node.data.isEnd,
		})),
});

const buildSteps = (nodes: Node<FlowNodeData>[]): FlowStepInput[] =>
	nodes
		.filter(
			(node) =>
				node.id !== START_NODE_ID &&
				node.id !== END_NODE_ID &&
				node.data.stepType !== "system",
		)
		.map((node) => ({
			catalogStepId: node.data.catalogStepId,
			name: node.data.label,
			type: node.data.stepType,
			isStart: node.data.isStart,
			isEnd: node.data.isEnd,
			position: node.position,
		}));

const resolveStepId = (
	nodeId: string,
	nodesById: Map<string, Node<FlowNodeData>>,
): string => {
	const node = nodesById.get(nodeId);
	if (!node) return nodeId;
	return node.data.catalogStepId;
};

const buildConnections = (
	edges: Edge[],
	nodes: Node<FlowNodeData>[],
): FlowConnectionInput[] => {
	const nodesById = new Map(nodes.map((node) => [node.id, node]));

	return edges
		.filter(
			(edge) =>
				edge.source &&
				edge.target &&
				edge.source !== START_NODE_ID &&
				edge.target !== END_NODE_ID &&
				edge.source !== END_NODE_ID &&
				edge.target !== START_NODE_ID &&
				!(edge.data as { virtual?: boolean } | undefined)?.virtual,
		)
		.map((edge) => ({
			sourceStepId: resolveStepId(edge.source, nodesById),
			targetStepId: resolveStepId(edge.target, nodesById),
			metadata: edge.data ?? {},
		}));
};

export const useFlowBuilderStore = create<FlowBuilderState>((set, get) => ({
	flows: [],
	catalog: emptyCatalog,
	selectedFlowId: null,
	flowName: "",
	flowDescription: "",
	flowStatus: "draft",
	serviceKeys: [],
	flowStates: [],
	nodes: [],
	edges: [],
	isLoading: false,
	isSaving: false,
	isDirty: false,
	error: null,

	initialize: async () => {
		set({ isLoading: true, error: null });
		try {
			const flowBuilderService = serviceManager.flowBuilderService;
			const [flows, catalog] = await Promise.all([
				flowBuilderService.listFlows(),
				Promise.resolve(flowBuilderService.getCatalog()),
			]);

			set({ flows, catalog, isLoading: false });
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to initialize:", error);
			set({
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to load flows",
			});
		}
	},

	selectFlow: async (flowId: string) => {
		set({ isLoading: true, error: null });
		try {
			const flowBuilderService = serviceManager.flowBuilderService;
			const definition = await flowBuilderService.getFlowDefinition(flowId);

			if (!definition) {
				set({
					isLoading: false,
					error: `Flow with ID ${flowId} not found`,
				});
				return;
			}

			const { flow, states, steps, connections, layout } = definition;
			const catalog = get().catalog;

			// Build nodes from saved steps
			let nodes: Node<FlowNodeData>[] = steps.map((step) => {
				const metadata = step.metadata as {
					catalogStepId?: string;
					position?: { x: number; y: number };
				} | null;
				const position = metadata?.position ??
					layout?.nodes.find((n) => n.stepId === step.id)?.position ?? {
						x: 200,
						y: 200,
					};

				return {
					id: step.id,
					type: "flowStep",
					position,
					data: {
						catalogStepId: metadata?.catalogStepId ?? step.name,
						label: step.name,
						stepType: step.type,
						isStart: step.isStart,
						isEnd: step.isEnd,
					},
				};
			});

			// Fallback to layout if no steps saved
			if (nodes.length === 0 && layout?.nodes.length) {
				const catalogStepById = new Map(
					catalog.steps.map((s) => [s.id, s]),
				);

				nodes = layout.nodes.map((layoutNode) => {
					const catalogStep = catalogStepById.get(layoutNode.stepId);
					return {
						id: layoutNode.stepId,
						type: "flowStep",
						position: layoutNode.position,
						data: {
							catalogStepId: layoutNode.stepId,
							label: catalogStep?.name ?? "Step",
							stepType: catalogStep?.type ?? "common",
							isStart: layoutNode.isStart ?? false,
							isEnd: layoutNode.isEnd ?? false,
						},
					};
				});
			}

			nodes = ensureTerminalNodes(nodes);

			let edges: Edge[] = connections.map((connection) => ({
				id: `${connection.sourceStepId}-${connection.targetStepId}`,
				source: connection.sourceStepId,
				target: connection.targetStepId,
				data: connection.metadata ?? {},
			}));

			// Add virtual edges to/from terminal nodes
			for (const node of nodes) {
				if (node.data.isStart && node.id !== START_NODE_ID) {
					edges = ensureVirtualEdge(edges, START_NODE_ID, node.id);
				}
				if (node.data.isEnd && node.id !== END_NODE_ID) {
					edges = ensureVirtualEdge(edges, node.id, END_NODE_ID);
				}
			}

			set({
				selectedFlowId: flow.id,
				flowName: flow.name,
				flowDescription: flow.description ?? "",
				flowStatus: flow.status,
				serviceKeys: flow.serviceKeys ?? [],
				flowStates: states.map((state) => ({
					name: state.name,
					type: state.type,
					metadata: state.metadata ?? {},
				})),
				nodes,
				edges,
				isDirty: false,
				isLoading: false,
			});
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to load flow:", error);
			set({
				isLoading: false,
				error: error instanceof Error ? error.message : "Failed to load flow",
			});
		}
	},

	createFlow: async (name: string) => {
		set({ isSaving: true, error: null });
		try {
			const flowBuilderService = serviceManager.flowBuilderService;
			const definition = await flowBuilderService.createFlow(
				{
					name,
					description: "",
					status: "draft",
					serviceKeys: [],
				},
				[],
				[],
				[],
				{ nodes: [] },
			);

			const defaultNodes = buildDefaultNodes();
			set((state) => ({
				flows: [definition.flow, ...state.flows],
				selectedFlowId: definition.flow.id,
				flowName: definition.flow.name,
				flowDescription: definition.flow.description ?? "",
				flowStatus: definition.flow.status,
				serviceKeys: definition.flow.serviceKeys ?? [],
				flowStates: [],
				nodes: defaultNodes,
				edges: [],
				isDirty: false,
				isSaving: false,
			}));
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to create flow:", error);
			set({
				isSaving: false,
				error: error instanceof Error ? error.message : "Failed to create flow",
			});
		}
	},

	saveFlow: async () => {
		const {
			selectedFlowId,
			flowName,
			flowDescription,
			flowStatus,
			serviceKeys,
			flowStates,
			nodes,
			edges,
			catalog,
		} = get();

		if (!selectedFlowId) return;

		set({ isSaving: true, error: null });
		try {
			const issues = validateFlowGraph(nodes, edges, catalog.steps);
			const errors = issues.filter((issue) => issue.severity === "error");
			if (errors.length > 0) {
				set({
					isSaving: false,
					error: errors.map((issue) => issue.message).join(" "),
				});
				return;
			}

			const flowBuilderService = serviceManager.flowBuilderService;
			const layout = buildLayout(nodes);
			const steps = buildSteps(nodes);
			const connections = buildConnections(edges, nodes);

			const updated = await flowBuilderService.updateFlow(
				selectedFlowId,
				{
					name: flowName,
					description: flowDescription,
					status: flowStatus,
					serviceKeys,
				},
				flowStates,
				steps,
				connections,
				layout,
			);

			// Rebuild nodes with new IDs from database
			const newNodes: Node<FlowNodeData>[] = updated.steps.map((step) => {
				const metadata = step.metadata as {
					catalogStepId?: string;
					position?: { x: number; y: number };
				} | null;
				return {
					id: step.id,
					type: "flowStep",
					position: metadata?.position ?? { x: 200, y: 200 },
					data: {
						catalogStepId: metadata?.catalogStepId ?? step.name,
						label: step.name,
						stepType: step.type,
						isStart: step.isStart,
						isEnd: step.isEnd,
					},
				};
			});

			const finalNodes = ensureTerminalNodes(newNodes);

			// Rebuild edges with new step IDs
			const newEdges: Edge[] = updated.connections.map((connection) => ({
				id: `${connection.sourceStepId}-${connection.targetStepId}`,
				source: connection.sourceStepId,
				target: connection.targetStepId,
				data: connection.metadata ?? {},
			}));

			// Add virtual edges
			let updatedEdges = newEdges;
			for (const node of finalNodes) {
				if (node.data.isStart && node.id !== START_NODE_ID) {
					updatedEdges = ensureVirtualEdge(updatedEdges, START_NODE_ID, node.id);
				}
				if (node.data.isEnd && node.id !== END_NODE_ID) {
					updatedEdges = ensureVirtualEdge(updatedEdges, node.id, END_NODE_ID);
				}
			}

			set((state) => ({
				flows: state.flows.map((flow) =>
					flow.id === updated.flow.id ? updated.flow : flow,
				),
				nodes: finalNodes,
				edges: updatedEdges,
				isDirty: false,
				isSaving: false,
			}));
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to save flow:", error);
			set({
				isSaving: false,
				error: error instanceof Error ? error.message : "Failed to save flow",
			});
		}
	},

	deleteFlow: async (flowId: string) => {
		try {
			await serviceManager.flowBuilderService.deleteFlow(flowId);
			set((state) => {
				const nextFlows = state.flows.filter((flow) => flow.id !== flowId);
				const deletedSelected = state.selectedFlowId === flowId;
				const nextSelectedId = deletedSelected
					? nextFlows[0]?.id ?? null
					: state.selectedFlowId;

				return {
					flows: nextFlows,
					selectedFlowId: nextSelectedId,
					flowName: deletedSelected ? "" : state.flowName,
					flowDescription: deletedSelected ? "" : state.flowDescription,
					flowStatus: deletedSelected ? "draft" : state.flowStatus,
					serviceKeys: deletedSelected ? [] : state.serviceKeys,
					flowStates: deletedSelected ? [] : state.flowStates,
					nodes: deletedSelected ? [] : state.nodes,
					edges: deletedSelected ? [] : state.edges,
					isDirty: deletedSelected ? false : state.isDirty,
				};
			});
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to delete flow:", error);
			set({
				error: error instanceof Error ? error.message : "Failed to delete flow",
			});
		}
	},

	setFlowMeta: (meta) => {
		set((state) => ({
			flowName: meta.name ?? state.flowName,
			flowDescription: meta.description ?? state.flowDescription,
			flowStatus: meta.status ?? state.flowStatus,
			serviceKeys: meta.serviceKeys ?? state.serviceKeys,
			isDirty: true,
		}));
	},

	addStateField: (stateField) => {
		set((state) => ({
			flowStates: [...state.flowStates, stateField],
			isDirty: true,
		}));
	},

	removeStateField: (name) => {
		set((state) => ({
			flowStates: state.flowStates.filter((stateField) => stateField.name !== name),
			isDirty: true,
		}));
	},

	updateStateField: (name, updates) => {
		set((state) => ({
			flowStates: state.flowStates.map((stateField) =>
				stateField.name === name ? { ...stateField, ...updates } : stateField,
			),
			isDirty: true,
		}));
	},

	onNodesChange: (changes) => {
		set((state) => {
			const protectedIds = new Set([START_NODE_ID, END_NODE_ID]);
			const filteredChanges = changes.filter(
				(change) =>
					change.type !== "remove" || !protectedIds.has(change.id),
			);
			const updated = applyNodeChanges(filteredChanges, state.nodes);
			const nodes = ensureTerminalNodes(updated);
			return {
				nodes,
				isDirty: true,
			};
		});
	},

	onEdgesChange: (changes) => {
		const { selectedFlowId, edges: currentEdges } = get();
		const removedEdges = changes
			.filter((change) => change.type === "remove")
			.map((change) => currentEdges.find((edge) => edge.id === change.id))
			.filter((edge): edge is Edge => Boolean(edge));

		const connectionDeletes = removedEdges.filter(
			(edge) =>
				edge.source !== START_NODE_ID &&
				edge.target !== END_NODE_ID &&
				edge.source !== END_NODE_ID &&
				edge.target !== START_NODE_ID &&
				!(edge.data as { virtual?: boolean } | undefined)?.virtual &&
				isUuid(edge.source) &&
				isUuid(edge.target),
		);

		set((state) => {
			let nodes = state.nodes;
			for (const edge of removedEdges) {
				if (edge.source === START_NODE_ID && edge.target) {
					nodes = setNodeFlag(nodes, edge.target, "isStart", false);
				}
				if (edge.target === END_NODE_ID && edge.source) {
					nodes = setNodeFlag(nodes, edge.source, "isEnd", false);
				}
			}
			const edges = applyEdgeChanges(changes, state.edges);
			return {
				edges,
				nodes,
				isDirty: true,
			};
		});

		if (!selectedFlowId || connectionDeletes.length === 0) return;

		void Promise.all(
			connectionDeletes.map((edge) =>
				serviceManager.flowBuilderService
					.deleteFlowConnection(selectedFlowId, edge.source, edge.target)
					.catch((error) =>
						logError(
							"[FLOW_BUILDER] Failed to delete connection:",
							error,
						),
					),
			),
		);
	},

	onConnect: (connection) => {
		set((state) => {
			if (connection.source === END_NODE_ID || connection.target === START_NODE_ID) {
				return state;
			}
			if (connection.source === START_NODE_ID && connection.target) {
				const nodes = setNodeFlag(state.nodes, connection.target, "isStart", true);
				const edges = ensureVirtualEdge(
					state.edges,
					START_NODE_ID,
					connection.target,
				);
				return { ...state, nodes, edges, isDirty: true };
			}
			if (connection.target === END_NODE_ID && connection.source) {
				const nodes = setNodeFlag(state.nodes, connection.source, "isEnd", true);
				const edges = ensureVirtualEdge(
					state.edges,
					connection.source,
					END_NODE_ID,
				);
				return { ...state, nodes, edges, isDirty: true };
			}

			const edges = addEdge(connection, state.edges);
			return { edges, nodes: state.nodes, isDirty: true };
		});
	},

	addNodeForStep: (catalogStepId, position) => {
		const { catalog } = get();
		const catalogStep = catalog.steps.find((item) => item.id === catalogStepId);
		if (!catalogStep) {
			return;
		}
		const baseLabel = catalogStep.name;
		const existingLabels = new Set(
			get().nodes.map((node) => String(node.data?.label ?? "")),
		);
		let label = baseLabel;
		if (existingLabels.has(baseLabel)) {
			let suffix = 2;
			while (existingLabels.has(`${baseLabel} ${suffix}`)) {
				suffix += 1;
			}
			label = `${baseLabel} ${suffix}`;
		}

		const node: Node<FlowNodeData> = {
			id: generateNodeId(),
			type: "flowStep",
			position,
			data: {
				catalogStepId,
				label,
				stepType: catalogStep.type,
				isStart: false,
				isEnd: false,
			},
		};

		set((state) => ({
			nodes: [...state.nodes, node],
			isDirty: true,
		}));
	},
}));
