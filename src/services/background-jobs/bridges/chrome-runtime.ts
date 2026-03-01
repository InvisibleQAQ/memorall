import { logInfo, logError } from "@/utils/logger";
import type {
	IJobNotificationBridge,
	JobNotificationMessage,
	ContextType,
	MessageTarget,
	BridgeStatus,
} from "./types";
import { isJobNotificationMessage } from "./types";
import type { BaseJob, JobProgressEvent, JobResult } from "../handlers/types";

/**
 * Chrome Runtime job notification bridge.
 *
 * Transport rule (MV3):
 *   chrome.runtime.sendMessage() reaches every extension page (background,
 *   popup, standalone, offscreen) but NOT content scripts.
 *   Background relays target="content"|"all" to content scripts via
 *   chrome.tabs.sendMessage() — see the relay section in background.ts.
 */
export class ChromeRuntimeBridge implements IJobNotificationBridge {
	private readonly listeners = new Map<
		string,
		Set<(message: JobNotificationMessage) => void>
	>();
	private readonly contextType: ContextType;
	private isReady = false;

	constructor() {
		this.contextType = ChromeRuntimeBridge.detectContext();
		this.setupListener();
		logInfo(`[ChromeRuntimeBridge] ready for "${this.contextType}"`);
	}

	// ─── Context detection ────────────────────────────────────────────────────

	private static detectContext(): ContextType {
		if (typeof chrome === "undefined" || !chrome.runtime) return "background";
		if (typeof document !== "undefined") {
			// Offscreen document URL always ends with offscreen.html
			if (document.URL.endsWith("offscreen.html")) return "offscreen";
			// Content scripts are injected into web pages
			if (
				document.URL.startsWith("https://") ||
				document.URL.startsWith("http://")
			)
				return "content";
			// Remaining chrome-extension:// pages: popup.html, standalone.html, etc.
			return "popup";
		}
		// No document = service worker (background)
		return "background";
	}

	// ─── Incoming message listener ────────────────────────────────────────────

	private setupListener(): void {
		if (typeof chrome === "undefined" || !chrome.runtime) return;

		chrome.runtime.onMessage.addListener((rawMessage: unknown) => {
			if (!isJobNotificationMessage(rawMessage)) return;
			if (!this.isForMe(rawMessage.target)) return;
			this.dispatch(rawMessage);
		});

		this.isReady = true;
	}

	private isForMe(target: MessageTarget): boolean {
		return target === "all" || target === this.contextType;
	}

	private dispatch(message: JobNotificationMessage): void {
		this.listeners.get(message.type)?.forEach((fn) => {
			try {
				fn(message);
			} catch (err) {
				logError(`[Bridge] listener error (${message.type}):`, err);
			}
		});
		this.listeners.get("*")?.forEach((fn) => {
			try {
				fn(message);
			} catch (err) {
				logError("[Bridge] wildcard listener error:", err);
			}
		});
	}

	// ─── IJobNotificationBridge ───────────────────────────────────────────────

	subscribe(
		messageType: JobNotificationMessage["type"] | "*",
		listener: (message: JobNotificationMessage) => void,
	): () => void {
		let bucket = this.listeners.get(messageType);
		if (!bucket) {
			bucket = new Set();
			this.listeners.set(messageType, bucket);
		}
		bucket.add(listener);
		return () => {
			bucket!.delete(listener);
			if (bucket!.size === 0) this.listeners.delete(messageType);
		};
	}

	notifyJobEnqueued(job: BaseJob, target: MessageTarget = "offscreen"): void {
		this.send({ type: "JOB_ENQUEUED", target, jobId: job.id, job });
	}

	notifyJobUpdated(
		jobId: string,
		job: BaseJob,
		target: MessageTarget = "all",
	): void {
		this.send({ type: "JOB_UPDATED", target, jobId, job });
	}

	notifyJobProgress(
		jobId: string,
		progress: JobProgressEvent,
		target: MessageTarget = "all",
	): void {
		this.send({ type: "JOB_PROGRESS", target, jobId, progress });
	}

	notifyJobCompleted(
		jobId: string,
		result?: JobResult,
		target: MessageTarget = "all",
	): void {
		this.send({ type: "JOB_COMPLETED", target, jobId, result });
	}

	notifyQueueUpdated(target: MessageTarget = "all"): void {
		this.send({ type: "QUEUE_UPDATED", target });
	}

	getContextType(): ContextType {
		return this.contextType;
	}

	getStatus(): BridgeStatus {
		return {
			isInitialized: this.isReady,
			listenerCount: Array.from(this.listeners.values()).reduce(
				(n, s) => n + s.size,
				0,
			),
			subscribedTypes: Array.from(this.listeners.keys()),
		};
	}

	close(): void {
		this.listeners.clear();
		this.isReady = false;
		logInfo("[Bridge] ChromeRuntimeBridge closed");
	}

	// ─── Send ─────────────────────────────────────────────────────────────────

	private send(
		partial: Omit<JobNotificationMessage, "sender" | "timestamp">,
	): void {
		if (!this.isReady) return;

		const message: JobNotificationMessage = {
			...partial,
			sender: this.contextType,
			timestamp: Date.now(),
		};

		chrome.runtime.sendMessage(message).catch((err: Error) => {
			// "Receiving end does not exist" is normal when no other context is open
			if (
				!err.message?.includes("Receiving end does not exist") &&
				!err.message?.includes("Could not establish connection")
			) {
				logError(`[Bridge] failed to send ${message.type}:`, err);
			}
		});
	}
}
