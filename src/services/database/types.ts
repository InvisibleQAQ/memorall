/**
 * Type-only exports for database entities
 *
 * This file exports types and lightweight runtime utilities WITHOUT importing
 * heavy runtime modules like drizzle-orm/pg-core. This prevents database schema
 * modules from being loaded in the popup thread where only types are needed.
 *
 * IMPORTANT: No drizzle-orm or schema imports!
 */

// Re-export types from entities without importing the entity schemas
export type {
	Conversation,
	NewConversation,
} from "./entities/conversations";

export type {
	Message,
	NewMessage,
} from "./entities/messages";

export type {
	Source,
	NewSource,
} from "./entities/sources";

export type {
	Node,
	NewNode,
} from "./entities/nodes";

export type {
	Edge,
	NewEdge,
} from "./entities/edges";

export type {
	SourceNode,
	NewSourceNode,
} from "./entities/source-nodes";

export type {
	SourceEdge,
	NewSourceEdge,
} from "./entities/source-edges";

export type {
	Encryption,
	NewEncryption,
} from "./entities/encryptions";

export type {
	Configuration,
	NewConfiguration,
} from "./entities/configurations";

export type {
	Topic,
	NewTopic,
} from "./entities/topics";

export type {
	TopicFile,
	NewTopicFile,
} from "./entities/topic-files";

export type {
	ActivitySession,
	NewActivitySession,
} from "./entities/activity-sessions";

export type {
	Activity,
	NewActivity,
} from "./entities/activities";

export type { Flow, NewFlow, PredefinedFlowKey } from "./entities/flows";

export type { FlowState, NewFlowState } from "./entities/flow-states";

export type { FlowService, NewFlowService } from "./entities/flow-services";

export type { FlowStep, NewFlowStep } from "./entities/flow-steps";

export type {
	FlowConnection,
	NewFlowConnection,
} from "./entities/flow-connections";

export type { FlowConfig, NewFlowConfig } from "./entities/flow-configs";

export type {
	CronJob,
	NewCronJob,
	CronJobStatus,
	CronJobLastStatus,
	CronJobActionType,
	AgentChatCronPayload,
	CronJobActionPayload,
} from "./entities/cron-jobs";

// Re-export lightweight runtime utilities that don't depend on drizzle
export { getEffectiveSourceStatus } from "./utils/source-utils";
