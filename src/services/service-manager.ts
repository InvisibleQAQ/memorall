/**
 * ServiceManager - Central orchestrator for all extension services
 *
 * ## 🏗️ Service Architecture Overview
 *
 * The extension uses a dual-mode service architecture to handle different execution contexts:
 *
 * ### 🔄 Service Modes
 *
 * **Main Mode (Offscreen Document)**:
 * - Full service implementations with complete functionality
 * - Real database instance, actual AI model loading
 * - Heavy computation and resource-intensive operations
 * - Acts as the "server" for proxy services
 *
 * **Proxy Mode (UI/Popup)**:
 * - Lightweight proxy implementations
 * - Forward requests to main services via RPC
 * - Minimal resource usage for responsive UI
 * - No direct model/database access
 *
 * ### 📍 Context-Specific Service Usage
 *
 * **🖥️ Offscreen Document (`public/offscreen.html`)**:
 * ```typescript
 * // Uses MAIN mode - full service implementations
 * await serviceManager.initialize({ proxy: false });
 *
 * // Services have direct access to:
 * - Real PGlite database instance
 * - Loaded AI models (embeddings, LLM)
 * - Full processing capabilities
 * ```
 *
 * **🎨 UI/Popup (`popup.html`, `standalone.html`)**:
 * ```typescript
 * // Uses PROXY mode - lightweight proxies
 * await serviceManager.initialize({ proxy: true });
 *
 * // Services forward requests to offscreen:
 * - DatabaseService → sends RPC to main database
 * - EmbeddingService → forwards to offscreen models
 * - LLMService → proxies to main thread
 * ```
 *
 * **📜 Background Script (`src/background.ts`)**:
 * ```typescript
 * // NO SERVICE ACCESS - Background script does not use ServiceManager
 * // Only handles:
 * - Context menu registration
 * - Content script communication
 * - Job enqueueing via background-jobs
 * ```
 *
 * **📄 Content Scripts**:
 * ```typescript
 * // NO SERVICE ACCESS - Content scripts do not use ServiceManager
 * // Only handles:
 * - Page data extraction
 * - DOM manipulation
 * - Communication with background script only
 * ```
 *
 * ### 🔗 Service Communication Flow
 *
 * ```
 * UI (Proxy Services) ─RPC─> Offscreen (Main Services) ─> Database/AI Models
 *                                    ↑
 * Background Script ─jobs─> Background Jobs Queue
 *                                    ↑
 * Content Scripts ─data─> Background Script
 * ```
 *
 * ### 💡 Benefits of This Architecture
 *
 * - **Performance**: Heavy operations isolated to offscreen document
 * - **Responsiveness**: UI remains fast with lightweight proxy services
 * - **Resource Management**: Single source of truth for models/database
 * - **Clean Separation**: Each context has well-defined responsibilities
 * - **Type Safety**: Same interfaces for both main and proxy implementations
 */

import { logError, logInfo, logWarn } from "@/utils/logger";
import type { IEmbeddingService } from "@/services/embedding";
import type { ILLMService } from "@/services/llm/interfaces/llm-service.interface";
import { FlowsService } from "./flows";
import { DatabaseMode, DatabaseService } from "./database";

export interface InitializationProgress {
	step: string;
	progress: number; // 0-100
	currentService?: string;
	isComplete: boolean;
}

export class ServiceManager {
	private static instance: ServiceManager;
	private initialized = false;
	private initPromise: Promise<void> | null = null;
	private serviceStatus = {
		database: false,
		embedding: false,
		llm: false,
		flows: false,
		topic: false,
	};

	// Child services - initialized based on mode
	public embeddingService!: IEmbeddingService;
	public llmService!: ILLMService;
	public databaseService!: DatabaseService;
	public flowsService!: FlowsService;

	// Progress tracking
	private progressListeners = new Set<
		(progress: InitializationProgress) => void
	>();
	private currentProgress: InitializationProgress = {
		step: "Starting",
		progress: 0,
		isComplete: false,
	};

	private constructor() {}

	static getInstance(): ServiceManager {
		if (!ServiceManager.instance) {
			ServiceManager.instance = new ServiceManager();
		}
		return ServiceManager.instance;
	}

	// Progress tracking methods
	onProgressChange(
		listener: (progress: InitializationProgress) => void,
	): () => void {
		this.progressListeners.add(listener);
		// Send current progress immediately
		listener(this.currentProgress);
		return () => this.progressListeners.delete(listener);
	}

	private updateProgress(
		step: string,
		progress: number,
		currentService?: string,
	): void {
		this.currentProgress = {
			step,
			progress,
			currentService,
			isComplete: progress >= 100,
		};
		this.progressListeners.forEach((listener) =>
			listener(this.currentProgress),
		);
	}

	getCurrentProgress(): InitializationProgress {
		return { ...this.currentProgress };
	}

	async initialize(
		options: {
			proxy?: boolean;
			callback?: (service: string, progress: number) => void;
		} = {
			proxy: false,
			callback: undefined,
		},
	): Promise<void> {
		if (this.initialized) return;
		if (this.initPromise) return this.initPromise;

		this.initPromise = this.initializeServices(options);
		await this.initPromise;
		this.initialized = true;
	}

	private async initializeServices(
		options: {
			proxy?: boolean;
			callback?: (service: string, progress: number) => void;
		} = {
			proxy: false,
			callback: undefined,
		},
	): Promise<void> {
		const mode = options.proxy ? "proxy mode" : "full mode";
		logInfo(`🚀 Initializing services in ${mode}...`);
		this.updateProgress(`Initializing services (${mode})`, 5);

		try {
			this.databaseService = DatabaseService.getInstance();

			if (options.proxy) {
				logInfo("🔧 Creating lite service implementations (popup thread)");
				await this.initializeDatabase({ mode: DatabaseMode.PROXY });

				// Dynamic imports ensure heavy implementations (LocalEmbedding, WllamaLLM)
				// and their dependencies (@huggingface/transformers, etc.) are NEVER loaded
				// in the popup thread, keeping the UI fast and responsive
				const { EmbeddingServiceProxy } = await import(
					"@/services/embedding/embedding-service-proxy"
				);
				const { LLMServiceProxy } = await import(
					"@/services/llm/llm-service-proxy"
				);

				this.embeddingService = new EmbeddingServiceProxy();
				this.llmService = new LLMServiceProxy();
				this.flowsService = new FlowsService();
			} else {
				logInfo("🔧 Creating full service implementations (offscreen thread)");
				await this.initializeDatabase({ mode: DatabaseMode.MAIN });

				// Dynamic imports isolate heavy implementations to offscreen thread only
				// This ensures LocalEmbedding (@huggingface/transformers) and local LLMs
				// are loaded only where they're actually used for processing
				const { EmbeddingServiceMain } = await import(
					"@/services/embedding/embedding-service-main"
				);
				const { LLMServiceMain } = await import(
					"@/services/llm/llm-service-main"
				);

				this.embeddingService = new EmbeddingServiceMain();
				this.llmService = new LLMServiceMain();
				this.flowsService = new FlowsService();
			}

			options.callback?.("database", 0);
			// Initialize services sequentially for better progress tracking

			options.callback?.("database", 100);
			this.updateProgress("Database ready", 25, "database");

			if (options.proxy) {
				// Lite mode: Initialize services without heavy operations
				await this.initializeEmbeddingService(true);
				this.updateProgress("Embedding service ready (lite)", 50, "embedding");

				await this.initializeLLMService(true);
				this.updateProgress("LLM service ready (lite)", 75, "llm");
			} else {
				// Full mode: Initialize all services normally
				options.callback?.("embedding", 0);
				await this.initializeEmbeddingService(false);
				options.callback?.("embedding", 100);
				this.updateProgress("Embedding models loaded", 50, "embedding");

				options.callback?.("llm", 0);
				await this.initializeLLMService(false);
				options.callback?.("llm", 100);
				this.updateProgress("LLM service ready", 75, "llm");
			}

			options.callback?.("flow", 0);
			await this.initializeFlowsService();

			this.updateProgress("All services ready", 100, "flows");

			logInfo(`✅ All services initialized successfully in ${mode}`);
		} catch (error) {
			logError("❌ Failed to initialize services:", error);
			this.updateProgress("All services ready", 100, "flows");
			throw error;
		}
	}

	private async initializeDatabase(options: {
		mode: DatabaseMode;
	}): Promise<void> {
		try {
			logInfo("📚 Initializing database...");
			this.updateProgress(
				"Setting up knowledge graph database",
				10,
				"database",
			);
			await this.databaseService.initialize(options);
			this.serviceStatus.database = true;
			logInfo("✅ Database initialized");
		} catch (error) {
			logError("❌ Database initialization failed:", error);
			throw new Error(
				`Database initialization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	private async initializeEmbeddingService(
		liteMode: boolean = false,
	): Promise<void> {
		try {
			logInfo(
				`🔤 Initializing embedding service${liteMode ? " (lite mode)" : ""}...`,
			);
			this.updateProgress(
				liteMode
					? "Setting up embedding service proxy"
					: "Loading embedding models for semantic search",
				35,
				"embedding",
			);

			await this.embeddingService.initialize();

			if (!liteMode) {
				// Full mode: Create default embedding model
				await this.embeddingService.create("default", "local", {
					type: "local",
					modelName: "nomic-ai/nomic-embed-text-v1.5",
				});
				logInfo("✅ Embedding service initialized with local models");
			} else {
				logInfo(
					"✅ Embedding service initialized in lite mode (will use offscreen for operations)",
				);
			}

			this.serviceStatus.embedding = true;
		} catch (error) {
			logError("❌ Embedding service initialization failed:", error);
			this.serviceStatus.embedding = false;
			// Don't throw - embedding service failure shouldn't block the app
			logWarn("⚠️ Continuing without embedding service");
			logError("Full error details:", error);
		}
	}

	private async initializeLLMService(liteMode: boolean = false): Promise<void> {
		try {
			logInfo(
				`🦙 Initializing LLM service${liteMode ? " (lite mode)" : ""}...`,
			);
			this.updateProgress(
				liteMode
					? "Setting up LLM service proxy"
					: "Initializing local LLM inference service",
				60,
				"llm",
			);

			await this.llmService.initialize();

			if (liteMode) {
				logInfo(
					"✅ LLM service initialized in lite mode (will use offscreen for heavy operations)",
				);
			} else {
				logInfo("✅ LLM service initialized with local models");
			}

			this.serviceStatus.llm = true;
		} catch (error) {
			logError("❌ LLM service initialization failed:", error);
			this.serviceStatus.llm = false;
			// Don't throw - LLM service failure shouldn't block the app
			logWarn("⚠️ Continuing without LLM service");
		}
	}

	private async initializeFlowsService(): Promise<void> {
		try {
			logInfo("🔄 Initializing Flows service...");
			this.updateProgress(
				"Preparing chat interface and model management",
				90,
				"flows",
			);
			await this.flowsService.initialize();
			this.serviceStatus.flows = true;
			logInfo("✅ Flows service initialized");
		} catch (error) {
			logError("❌ Flows service initialization failed:", error);
			this.serviceStatus.flows = false;
			// Don't throw - Flows service failure shouldn't block the app
			logWarn("⚠️ Continuing without Flows service");
		}
	}

	isInitialized(): boolean {
		return this.initialized;
	}

	// Check individual service status
	async isEmbeddingServiceReady(): Promise<boolean> {
		if (!this.embeddingService) return false;
		const embedding = await this.embeddingService.get("default");
		return this.serviceStatus.embedding && embedding
			? embedding.isReady()
			: false;
	}

	isLLMServiceReady(): boolean {
		return (
			this.serviceStatus.llm && this.llmService && this.llmService.isReady()
		);
	}

	isDatabaseReady(): boolean {
		return this.serviceStatus.database && this.databaseService.isReady();
	}

	isFlowsServiceReady(): boolean {
		return this.serviceStatus.flows;
	}

	// Get overall service status
	getServiceStatus() {
		return {
			...this.serviceStatus,
			overall: this.initialized,
		};
	}

	// Service getters for easy access
	getEmbeddingService() {
		return this.embeddingService;
	}

	getLLMService() {
		return this.llmService;
	}

	getDatabaseService() {
		return this.databaseService;
	}

	getFlowsService() {
		return this.flowsService;
	}

	// Generic service getter for dynamic access
	getService<K extends keyof ServiceRegistry>(
		serviceName: K,
	): ServiceRegistry[K] | undefined {
		switch (serviceName) {
			case "database":
				return this.databaseService as ServiceRegistry[K];
			case "embedding":
				return this.embeddingService as ServiceRegistry[K];
			case "llm":
				return this.llmService as ServiceRegistry[K];
			case "flows":
				return this.flowsService as ServiceRegistry[K];
			default:
				return undefined;
		}
	}
}

// Service registry for type-safe service access
interface ServiceRegistry {
	database: DatabaseService;
	embedding: IEmbeddingService;
	llm: ILLMService;
	flows: FlowsService;
}
