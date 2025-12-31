// RPC handler for main mode database instance
// Handles incoming RPC requests from proxy instances

import { logError, logInfo } from "@/utils/logger";
import { getPGLite, isMainMode } from "../db";
import { serializeForRpc, deserializeFromRpc } from "./serialization";
import type {
	RpcRequest,
	RpcResponse,
	WorkerQueryPayload,
	WorkerExecPayload,
	WorkerQueryResult,
} from "./types";

interface QueuedResponse {
	response: RpcResponse;
	timestamp: number;
	retryCount: number;
}

interface ProcessedRequest {
	response: RpcResponse;
	timestamp: number;
}

export class DatabaseRpcHandler {
	private static instance: DatabaseRpcHandler;
	private port: chrome.runtime.Port | null = null;
	private responseQueue: QueuedResponse[] = [];
	private readonly maxRetries = 5;
	private readonly maxQueueSize = 100;
	private readonly queueTimeout = 30000; // 30 seconds
	private retryTimer: ReturnType<typeof setTimeout> | null = null;

	// Request deduplication cache to prevent duplicate operations
	private processedRequests = new Map<number, ProcessedRequest>();
	private readonly requestCacheTimeout = 60000; // 60 seconds - longer than proxy timeout

	// Track listener registration to prevent duplicates
	private isListening: boolean = false;
	private currentChannelName: string | null = null;
	private connectionListener: ((port: chrome.runtime.Port) => void) | null =
		null;

	static getInstance(): DatabaseRpcHandler {
		if (!DatabaseRpcHandler.instance) {
			DatabaseRpcHandler.instance = new DatabaseRpcHandler();
		}
		return DatabaseRpcHandler.instance;
	}

	// Start listening for RPC connections
	startListening(channelName: string): void {
		// Prevent duplicate listeners
		if (this.isListening && this.currentChannelName === channelName) {
			logInfo(`📡 RPC handler already listening on channel: ${channelName}`);
			return;
		}

		// Remove existing listener if channel changed
		if (this.isListening && this.connectionListener) {
			try {
				chrome.runtime.onConnect.removeListener(this.connectionListener);
				logInfo(
					`📡 Removed previous RPC listener for channel: ${this.currentChannelName}`,
				);
			} catch (error) {
				logError("⚠️ Failed to remove previous listener:", error);
			}
		}

		// Create and store the listener
		this.connectionListener = (port: chrome.runtime.Port) => {
			logInfo(`📡 RPC connection established: ${channelName}`, {
				hasExistingPort: !!this.port,
				queuedResponses: this.responseQueue.length,
				portName: port.name,
				channelName: channelName,
			});
			if (port.name === channelName) {
				this.port = port;
				port.onMessage.addListener(this.handleMessage.bind(this));
				port.onDisconnect.addListener(() => {
					logInfo(`📡 RPC connection disconnected: ${channelName}`, {
						queuedResponses: this.responseQueue.length,
					});
					this.port = null;
				});

				// Flush any queued responses when port reconnects
				this.flushResponseQueue();
			}
		};

		try {
			chrome.runtime.onConnect.addListener(this.connectionListener);
			logInfo(`✅ RPC listener registered for channel: ${channelName}`);
		} catch (error) {
			logError("🔍 RPC HANDLER: ERROR adding listener:", error);
			throw error;
		}

		this.isListening = true;
		this.currentChannelName = channelName;
	}

	// Handle incoming RPC messages
	private async handleMessage(request: RpcRequest): Promise<void> {
		const { id, op, payload } = request;

		// Check if this request was already processed (deduplication)
		const cached = this.processedRequests.get(id);
		if (cached) {
			const age = Date.now() - cached.timestamp;
			logInfo(
				`♻️ Returning cached response for duplicate request ${id} (age: ${age}ms)`,
			);
			this.sendResponse(cached.response);
			return;
		}

		// Clean up old cached requests periodically
		this.cleanupRequestCache();

		// Deserialize payload (handles Date objects from proxy)
		const deserializedPayload = deserializeFromRpc(payload);

		try {
			let result: unknown = null;

			switch (op) {
				case "health":
					result = { status: "ok" };
					break;

				case "query":
					result = await this.handleQuery(
						deserializedPayload as WorkerQueryPayload,
					);
					break;

				case "exec":
					await this.handleExec(deserializedPayload as WorkerExecPayload);
					result = null;
					break;

				case "transaction":
					// Transaction handling would require more complex state management
					// For now, we'll treat it as a series of queries
					throw new Error(
						"Transaction support not implemented in RPC handler yet",
					);

				case "close":
					// Proxy close - just acknowledge
					result = null;
					break;

				default:
					throw new Error(`Unsupported RPC operation: ${op}`);
			}

			// Serialize result before sending (handles Date objects to proxy)
			const serializedResult = serializeForRpc(result);
			const response: RpcResponse = { id, ok: true, data: serializedResult };

			// Cache the response for deduplication
			this.cacheRequest(id, response);

			this.sendResponse(response);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			logError(`❌ RPC operation '${op}' failed:`, error);
			const response: RpcResponse = { id, ok: false, error: errorMessage };

			// Cache error responses too to prevent retrying failed operations
			this.cacheRequest(id, response);

			this.sendResponse(response);
		}
	}

	// Handle query operations
	private async handleQuery(
		payload: WorkerQueryPayload,
	): Promise<WorkerQueryResult> {
		const pglite = getPGLite();
		const { sql, params, rowMode } = payload;

		// Execute query on the real PGlite instance
		const result = await pglite.query(sql, params, { rowMode });

		// Return complete result including fields metadata
		// Drizzle needs the fields array to map column positions to names in array mode
		// Must match PGlite's Results type (affectedRows, not rowCount)
		return {
			rows: result.rows,
			fields: "fields" in result ? result.fields : undefined,
			affectedRows: "affectedRows" in result ? result.affectedRows : undefined,
		};
	}

	// Handle exec operations
	private async handleExec(payload: WorkerExecPayload) {
		const pglite = getPGLite();
		const { sql } = payload;

		// Execute SQL on the real PGlite instance
		await pglite.exec(sql);
	}

	// Cache a processed request to prevent duplicate execution
	private cacheRequest(id: number, response: RpcResponse): void {
		this.processedRequests.set(id, {
			response,
			timestamp: Date.now(),
		});
	}

	// Remove expired cached requests
	private cleanupRequestCache(): void {
		const now = Date.now();
		let removed = 0;

		for (const [id, cached] of this.processedRequests.entries()) {
			const age = now - cached.timestamp;
			if (age > this.requestCacheTimeout) {
				this.processedRequests.delete(id);
				removed++;
			}
		}

		if (removed > 0) {
			logInfo(`🧹 Cleaned up ${removed} expired cached requests`);
		}
	}

	// Send response back to proxy with retry logic
	private sendResponse(response: RpcResponse): void {
		if (this.port) {
			try {
				this.port.postMessage(response);
			} catch (error) {
				logError(
					`❌ Failed to send response for request ${response.id}:`,
					error,
				);
				this.queueResponse(response);
			}
		} else {
			logError(
				`⚠️ No RPC port available, queueing response for request ${response.id}`,
			);
			this.queueResponse(response);
		}
	}

	// Queue a response for retry
	private queueResponse(response: RpcResponse): void {
		// Clean old responses from queue first
		this.cleanupQueue();

		// Check queue size limit
		if (this.responseQueue.length >= this.maxQueueSize) {
			logError(
				`❌ Response queue full (${this.maxQueueSize}), dropping oldest response`,
			);
			this.responseQueue.shift();
		}

		this.responseQueue.push({
			response,
			timestamp: Date.now(),
			retryCount: 0,
		});

		// Schedule retry if not already scheduled
		this.scheduleRetry();
	}

	// Remove expired responses from queue
	private cleanupQueue(): void {
		const now = Date.now();
		const initialLength = this.responseQueue.length;

		this.responseQueue = this.responseQueue.filter((item) => {
			const age = now - item.timestamp;
			if (age > this.queueTimeout) {
				logError(
					`❌ Response ${item.response.id} expired after ${age}ms, dropping`,
				);
				return false;
			}
			return true;
		});

		const removed = initialLength - this.responseQueue.length;
		if (removed > 0) {
			logInfo(`🧹 Cleaned up ${removed} expired responses from queue`);
		}
	}

	// Schedule a retry attempt with exponential backoff
	private scheduleRetry(): void {
		if (this.retryTimer) {
			return; // Already scheduled
		}

		// Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
		const maxRetryCount = Math.max(
			...this.responseQueue.map((q) => q.retryCount),
			0,
		);
		const delay = Math.min(100 * Math.pow(2, maxRetryCount), 5000);

		this.retryTimer = setTimeout(() => {
			this.retryTimer = null;
			this.flushResponseQueue();
		}, delay);
	}

	// Attempt to flush queued responses
	private flushResponseQueue(): void {
		if (this.responseQueue.length === 0) {
			return;
		}

		if (!this.port) {
			logError(
				`⚠️ Cannot flush queue: no RPC port available (${this.responseQueue.length} responses queued)`,
			);
			this.scheduleRetry();
			return;
		}

		logInfo(
			`🔄 Flushing response queue (${this.responseQueue.length} responses)`,
		);
		const failedResponses: QueuedResponse[] = [];

		for (const queuedItem of this.responseQueue) {
			try {
				this.port.postMessage(queuedItem.response);
				logInfo(
					`✅ Queued response ${queuedItem.response.id} sent successfully (retry ${queuedItem.retryCount})`,
				);
			} catch (error) {
				queuedItem.retryCount++;

				if (queuedItem.retryCount >= this.maxRetries) {
					logError(
						`❌ Response ${queuedItem.response.id} failed after ${queuedItem.retryCount} retries, dropping`,
					);
				} else {
					logError(
						`⚠️ Failed to send queued response ${queuedItem.response.id} (retry ${queuedItem.retryCount}/${this.maxRetries}):`,
						error,
					);
					failedResponses.push(queuedItem);
				}
			}
		}

		this.responseQueue = failedResponses;

		// Schedule another retry if there are still failed responses
		if (this.responseQueue.length > 0) {
			this.scheduleRetry();
		}
	}

	// Stop the RPC handler
	stop(): void {
		// Clear retry timer
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
		}

		// Clear response queue
		if (this.responseQueue.length > 0) {
			logError(
				`⚠️ Stopping RPC handler with ${this.responseQueue.length} queued responses`,
			);
			this.responseQueue = [];
		}

		// Clear request cache
		if (this.processedRequests.size > 0) {
			logInfo(
				`🧹 Clearing ${this.processedRequests.size} cached requests on stop`,
			);
			this.processedRequests.clear();
		}

		// Disconnect port
		if (this.port) {
			this.port.disconnect();
			this.port = null;
		}
	}
}
