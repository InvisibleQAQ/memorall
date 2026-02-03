import { and, desc, eq } from "drizzle-orm";
import type { IDatabaseService } from "@/services/database/interfaces/database-service.interface";
import type {
	Flow,
	FlowState,
	FlowStep,
	FlowConnection,
} from "@/services/database/types";
import type {
	FlowCatalog,
	FlowConnectionInput,
	FlowDefinition,
	FlowDraftInput,
	FlowLayout,
	FlowStateInput,
	FlowStepInput,
} from "./interfaces/flow-builder";
import { logError, logInfo } from "@/utils/logger";
import { getFlowCatalog } from "./flow-builder-catalog";

export class FlowBuilderService {
	constructor(private databaseService: IDatabaseService) {}

	async listFlows(): Promise<Flow[]> {
		return this.databaseService.use(async ({ db, schema }) =>
			db.select().from(schema.flows).orderBy(desc(schema.flows.updatedAt)),
		);
	}

	async getFlowDefinition(flowId: string): Promise<FlowDefinition | null> {
		return this.databaseService.use(async ({ db, schema }) => {
			const [flow] = await db
				.select()
				.from(schema.flows)
				.where(eq(schema.flows.id, flowId))
				.limit(1);

			if (!flow) return null;

			const [states, steps, connections] = await Promise.all([
				db
					.select()
					.from(schema.flowStates)
					.where(eq(schema.flowStates.flowId, flowId)),
				db
					.select()
					.from(schema.flowSteps)
					.where(eq(schema.flowSteps.flowId, flowId)),
				db
					.select()
					.from(schema.flowConnections)
					.where(eq(schema.flowConnections.flowId, flowId)),
			]);

			const layout =
				(flow.metadata as { layout?: FlowLayout } | undefined)?.layout ?? undefined;

			return {
				flow,
				states,
				steps,
				connections,
				layout,
			};
		});
	}

	async createFlow(
		input: FlowDraftInput,
		states: FlowStateInput[],
		steps: FlowStepInput[],
		connections: FlowConnectionInput[],
		layout?: FlowLayout,
	): Promise<FlowDefinition> {
		try {
			logInfo("[FLOW_BUILDER] Creating flow:", input.name);
			return await this.databaseService.transaction(async ({ db, schema }) => {
				const [flow] = await db
					.insert(schema.flows)
					.values({
						name: input.name,
						description: input.description ?? "",
						status: input.status ?? "draft",
						serviceKeys: input.serviceKeys ?? [],
						metadata: {
							...(input.metadata ?? {}),
							...(layout ? { layout } : {}),
						},
					})
					.returning();

				const createdStates: FlowState[] = states.length
					? await db
							.insert(schema.flowStates)
							.values(
								states.map((state) => ({
									flowId: flow.id,
									name: state.name,
									type: state.type,
									metadata: state.metadata ?? {},
								})),
							)
							.returning()
					: [];

				const createdSteps: FlowStep[] = steps.length
					? await db
							.insert(schema.flowSteps)
							.values(
								steps.map((step) => ({
									flowId: flow.id,
									name: step.name,
									type: step.type,
									isStart: step.isStart ?? false,
									isEnd: step.isEnd ?? false,
									metadata: {
										...(step.metadata ?? {}),
										catalogStepId: step.catalogStepId,
										position: step.position,
									},
								})),
							)
							.returning()
					: [];

				// Build step ID mapping for connections
				const stepIdMap = new Map<string, string>();
				steps.forEach((input, index) => {
					const created = createdSteps[index];
					if (created) {
						// Map the original catalogStepId to the new DB step id
						stepIdMap.set(input.catalogStepId, created.id);
					}
				});

				const createdConnections: FlowConnection[] = connections.length
					? await db
							.insert(schema.flowConnections)
							.values(
								connections.map((connection) => ({
									flowId: flow.id,
									sourceStepId: stepIdMap.get(connection.sourceStepId) ?? connection.sourceStepId,
									targetStepId: stepIdMap.get(connection.targetStepId) ?? connection.targetStepId,
									metadata: connection.metadata ?? {},
								})),
							)
							.returning()
					: [];

				return {
					flow,
					states: createdStates,
					steps: createdSteps,
					connections: createdConnections,
					layout,
				};
			});
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to create flow:", error);
			throw error;
		}
	}

	async updateFlow(
		flowId: string,
		updates: Partial<FlowDraftInput>,
		states: FlowStateInput[],
		steps: FlowStepInput[],
		connections: FlowConnectionInput[],
		layout?: FlowLayout,
	): Promise<FlowDefinition> {
		try {
			logInfo("[FLOW_BUILDER] Updating flow:", flowId);
			return await this.databaseService.transaction(async ({ db, schema }) => {
				const [updatedFlow] = await db
					.update(schema.flows)
					.set({
						...updates,
						serviceKeys: updates.serviceKeys ?? [],
						metadata: {
							...(updates.metadata ?? {}),
							...(layout ? { layout } : {}),
						},
						updatedAt: new Date(),
					})
					.where(eq(schema.flows.id, flowId))
					.returning();

				if (!updatedFlow) {
					throw new Error(`Flow with ID ${flowId} not found`);
				}

				// Clear existing data for this flow
				await Promise.all([
					db.delete(schema.flowStates).where(eq(schema.flowStates.flowId, flowId)),
					db.delete(schema.flowConnections).where(eq(schema.flowConnections.flowId, flowId)),
					db.delete(schema.flowSteps).where(eq(schema.flowSteps.flowId, flowId)),
				]);

				const createdStates: FlowState[] = states.length
					? await db
							.insert(schema.flowStates)
							.values(
								states.map((state) => ({
									flowId,
									name: state.name,
									type: state.type,
									metadata: state.metadata ?? {},
								})),
							)
							.returning()
					: [];

				const createdSteps: FlowStep[] = steps.length
					? await db
							.insert(schema.flowSteps)
							.values(
								steps.map((step) => ({
									flowId,
									name: step.name,
									type: step.type,
									isStart: step.isStart ?? false,
									isEnd: step.isEnd ?? false,
									metadata: {
										...(step.metadata ?? {}),
										catalogStepId: step.catalogStepId,
										position: step.position,
									},
								})),
							)
							.returning()
					: [];

				// Build step ID mapping for connections
				const stepIdMap = new Map<string, string>();
				steps.forEach((input, index) => {
					const created = createdSteps[index];
					if (created) {
						stepIdMap.set(input.catalogStepId, created.id);
					}
				});

				const createdConnections: FlowConnection[] = connections.length
					? await db
							.insert(schema.flowConnections)
							.values(
								connections.map((connection) => ({
									flowId,
									sourceStepId: stepIdMap.get(connection.sourceStepId) ?? connection.sourceStepId,
									targetStepId: stepIdMap.get(connection.targetStepId) ?? connection.targetStepId,
									metadata: connection.metadata ?? {},
								})),
							)
							.returning()
					: [];

				const resolvedLayout =
					(updatedFlow.metadata as { layout?: FlowLayout } | undefined)?.layout ??
					layout;

				return {
					flow: updatedFlow,
					states: createdStates,
					steps: createdSteps,
					connections: createdConnections,
					layout: resolvedLayout,
				};
			});
		} catch (error) {
			logError("[FLOW_BUILDER] Failed to update flow:", error);
			throw error;
		}
	}

	async deleteFlow(flowId: string): Promise<void> {
		await this.databaseService.use(async ({ db, schema }) => {
			await db.delete(schema.flows).where(eq(schema.flows.id, flowId));
		});
	}

	async deleteFlowConnection(
		flowId: string,
		sourceStepId: string,
		targetStepId: string,
	): Promise<void> {
		await this.databaseService.use(async ({ db, schema }) => {
			await db
				.delete(schema.flowConnections)
				.where(
					and(
						eq(schema.flowConnections.flowId, flowId),
						eq(schema.flowConnections.sourceStepId, sourceStepId),
						eq(schema.flowConnections.targetStepId, targetStepId),
					),
				);
		});
	}

	/**
	 * Returns the in-memory catalog of available step types and services.
	 * This is NOT stored in the database.
	 */
	getCatalog(): FlowCatalog {
		return getFlowCatalog();
	}
}
