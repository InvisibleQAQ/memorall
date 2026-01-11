// chromePortTransport.ts
// Strictly-typed RpcTransport implementation for browser extensions using
// chrome.runtime Port messaging (best performance for MV3 extensions).

import type { RpcRequest, RpcResponse, RpcTransport } from "./types";
import { serializeForRpc } from "./serialization";
import { logError, logInfo, logWarn } from "@/utils/logger";

export interface ChromePortTransportOptions {
	/** Port name; must match on the server side */
	channelName?: string;
	/**
	 * Ensure the Offscreen Document exists before connecting.
	 * Provide a function that creates it if missing (MV3 Offscreen API).
	 */
	ensureOffscreen?: () => Promise<void>;
	/** Automatic reconnect with exponential backoff (enabled by default). */
	reconnect?: {
		enabled?: boolean;
		initialDelayMs?: number; // default 100
		maxDelayMs?: number; // default 2000
		factor?: number; // default 2
	};
	/** Heartbeat interval in ms to detect dead connections (default: 30000, 0 disables) */
	heartbeatIntervalMs?: number;
}

/** Type guard to validate RpcResponse shape at runtime. */
function isRpcResponse(value: unknown): value is RpcResponse {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	if (typeof v.id !== "number") return false;
	if (typeof v.ok !== "boolean") return false;
	if (v.ok) {
		// ok:true => data present (any JSON-serializable value)
		return "data" in v;
	}
	// ok:false => error:string
	return typeof v.error === "string";
}

/**
 * Create a high-performance RpcTransport backed by chrome.runtime Port.
 * Uses structured clone for messages (no JSON stringify/parse).
 */
export async function createChromePortTransport(
	options: ChromePortTransportOptions = {},
): Promise<RpcTransport> {
	const {
		channelName,
		ensureOffscreen,
		reconnect = {},
		heartbeatIntervalMs = 30000,
	} = options;

	const reconnectEnabled = reconnect.enabled ?? true;
	const backoffInit = reconnect.initialDelayMs ?? 100;
	const backoffMax = reconnect.maxDelayMs ?? 2000;
	const backoffFactor = reconnect.factor ?? 2;

	let port: chrome.runtime.Port | null = null;
	let disposed = false;
	let connecting: Promise<void> | null = null;
	let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

	const subscribers = new Set<(msg: RpcResponse) => void>();
	const queue: RpcRequest[] = [];

	let backoff = backoffInit;

	const handleMessage = (msg: unknown): void => {
		// Don't deserialize here - let each operation handle its own deserialization
		// This preserves serialized dates as {__type: "Date", __value: "..."} for query results
		if (!isRpcResponse(msg)) return;
		subscribers.forEach((fn) => fn(msg));
	};

	const stopHeartbeat = (): void => {
		if (heartbeatTimer) {
			clearInterval(heartbeatTimer);
			heartbeatTimer = null;
		}
	};

	const startHeartbeat = (): void => {
		stopHeartbeat();
		if (heartbeatIntervalMs <= 0) return;

		heartbeatTimer = setInterval(() => {
			if (!port || disposed) {
				stopHeartbeat();
				return;
			}

			// Send a health check ping
			try {
				const pingRequest: RpcRequest = {
					id: -Math.floor(Math.random() * 1000000), // Negative ID for heartbeat
					op: "health",
					payload: {},
				};
				port.postMessage(serializeForRpc(pingRequest));
			} catch (error) {
				logWarn(
					`[ChromePortRPC] ⚠️ Heartbeat ping failed, connection may be dead:`,
					error,
				);
				// Trigger reconnection
				handleDisconnect();
			}
		}, heartbeatIntervalMs);
	};

	const handleDisconnect = (): void => {
		stopHeartbeat();
		if (port) {
			port.onMessage.removeListener(handleMessage);
			port.onDisconnect.removeListener(handleDisconnect);
			port = null;
		}
		if (!reconnectEnabled || disposed) return;

		const delay = backoff;
		backoff = Math.min(backoff * backoffFactor, backoffMax);
		logInfo(
			`[ChromePortRPC] 🔄 Port disconnected, reconnecting in ${delay}ms (backoff: ${backoff}ms)`,
		);
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		setTimeout(connect, delay);
	};

	const connect = async (): Promise<void> => {
		if (disposed) return;
		if (connecting) return connecting;

		connecting = (async () => {
			try {
				if (ensureOffscreen) {
					try {
						await ensureOffscreen();
					} catch {
						// Offscreen may already exist; ignore.
					}
				}

				const p = chrome.runtime.connect({ name: channelName });
				p.onMessage.addListener(handleMessage);
				p.onDisconnect.addListener(handleDisconnect);
				port = p;

				// Flush queued messages
				while (queue.length > 0 && port) {
					const m = queue.shift()!;
					const serializedM = serializeForRpc(m);
					try {
						port.postMessage(serializedM);
					} catch (error) {
						// If posting fails, put it back in queue
						queue.unshift(m);
						logWarn(
							`[ChromePortRPC] ⚠️ Failed to send queued message, keeping in queue`,
							error,
						);
						break;
					}
				}

				backoff = backoffInit;

				// Start heartbeat to monitor connection health
				startHeartbeat();
			} catch (error) {
				logError(`[ChromePortRPC] ❌ Connection failed, will retry:`, error);
				port = null;
				// Trigger reconnection on error
				if (reconnectEnabled && !disposed) {
					const delay = backoff;
					backoff = Math.min(backoff * backoffFactor, backoffMax);
					// eslint-disable-next-line @typescript-eslint/no-misused-promises
					setTimeout(connect, delay);
				}
			}
		})();

		await connecting;
		connecting = null;
	};

	await connect();

	const transport: RpcTransport = {
		post(msg: RpcRequest): void {
			if (disposed) return;
			const serializedMsg = serializeForRpc(msg);
			if (port) {
				try {
					port.postMessage(serializedMsg);
				} catch (error) {
					// If posting fails due to a race with disconnect, enqueue and reconnect.
					queue.push(msg);
					// eslint-disable-next-line @typescript-eslint/no-floating-promises
					connect();
					logWarn(`[ChromePortRPC] post error`, error);
				}
			} else {
				queue.push(msg);
				// eslint-disable-next-line @typescript-eslint/no-floating-promises
				connect();
			}
		},

		subscribe(handler: (msg: RpcResponse) => void): () => void {
			subscribers.add(handler);
			return () => {
				subscribers.delete(handler);
			};
		},
	};

	return transport;
}
