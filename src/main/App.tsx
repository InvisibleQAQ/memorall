import React, { useState, useEffect } from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	useNavigate,
} from "react-router-dom";
import NiceModal from "@ebay/nice-modal-react";

import "./i18n/config"; // Initialize i18n

import {
	Cursor,
	CursorFollow,
	CursorProvider,
} from "./components/ui/shadcn-io/animated-cursor";
import { logError, logInfo } from "@/utils/logger";
import { ThemeProvider } from "./components/molecules/ThemeContext";
import { PasskeyPromptDialog } from "./components/molecules/PasskeyPromptDialog";
import { useEmbeddingSettings } from "./stores/embedding-settings";
import {
	checkProviderNeedsRestore,
	restoreAuthProvider,
} from "@/utils/auth-provider-restore";
import { serviceManager } from "@/services";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { sharedStorageService } from "@/services/shared-storage/shared-storage-service";
import { CopilotProvider, Copilot } from "./components/atoms/copilot";
import { Layout } from "./components/Layout";
// pages
import { ChatPage } from "./pages/ChatPage";
import { EmbeddingPage } from "./pages/EmbeddingPage";
import { LLMPage } from "./pages/LLMPage";
import { DatabasePage } from "./pages/DatabasePage";
import { LogsPage } from "./pages/LogsPage";
import { AppLoadingScreen } from "./components/atoms/AppLoadingScreen";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { DocumentLibraryPage } from "./pages/DocumentLibraryPage";
import { ActivityTimelinePage } from "./pages/ActivityTimelinePage";
import { AuthPage } from "./pages/AuthPage";
import { FlowBuilderPage } from "./pages/FlowBuilderPage";
import { registerAllEditors } from "@/main/modules/documents/editors";
import { useAuthInit } from "@/main/modules/supabase";

const App: React.FC = () => {
	const [servicesStatus, setServicesStatus] = useState<
		"loading" | "ready" | "error" | "awaiting-passkey"
	>("loading");
	const [initError, setInitError] = useState<string | null>(null);
	const [uiProgress, setUiProgress] = useState(0);
	const [passkeyProvider, setPasskeyProvider] = useState<
		"openai" | "openrouter" | null
	>(null);

	// Bridge component to access navigate from message listener once Router is active
	const NavigatorBridge: React.FC = () => {
		const navigate = useNavigate();

		// Initialize Supabase auth
		useAuthInit();

		useEffect(() => {
			const handler = (message: { type: string }) => {
				if (message?.type === "OPEN_KNOWLEDGE_GRAPH") {
					navigate("/knowledge-graph");
				} else if (message?.type === "OPEN_REMEMBER_PAGE") {
					navigate("/remember");
				}
			};
			try {
				chrome.runtime?.onMessage.addListener(handler);
			} catch (_) {}
			return () => {
				try {
					chrome.runtime?.onMessage.removeListener(handler);
				} catch (_) {}
			};
		}, [navigate]);

		// Also handle session storage navigation
		useEffect(() => {
			const checkSessionNavigation = async () => {
				try {
					const result = await chrome.storage?.session?.get?.("navigateTo");
					if (result?.navigateTo === "activities") {
						navigate("/activities");
						// Clear the flag
						await chrome.storage?.session?.remove?.("navigateTo");
					}
				} catch (_) {}
			};
			checkSessionNavigation();
		}, [navigate]);

		return null;
	};

	// Initialize embedding settings store
	const initializeEmbeddingSettings = useEmbeddingSettings(
		(state) => state.initialize,
	);

	useEffect(() => {
		const initializeApp = async () => {
			try {
				logInfo("🚀 Starting app initialization...");
				setServicesStatus("loading");

				// Initialize shared storage service first (required for cross-thread communication)
				await sharedStorageService.initialize();
				logInfo("✅ Shared storage service initialized in UI thread");

				// Initialize services through offscreen with progress streaming
				const progressStream = await backgroundJob.initializeServices();
				let startTime = Date.now();

				// Listen to initialization progress
				for await (const progress of progressStream) {
					logInfo("🚀 App initialization progress:", progress);
					setUiProgress(progress.progress);

					if (progress.status === "completed") {
						setUiProgress(100);
						logInfo("✅ App initialization complete");
						break;
					}
				}
				const duration = Date.now() - startTime;

				if (duration < 1000) {
					await new Promise((resolve) => setTimeout(resolve, 5000 - duration));
				}

				// Small delay before showing app
				await serviceManager.initialize({ proxy: true });

				// Register all document editors
				registerAllEditors();
				logInfo("📝 Document editors registered");

				// Check if current model requires authentication
				try {
					const currentModel =
						await serviceManager.llmService.getCurrentModel();
					if (
						currentModel &&
						(currentModel.provider === "openai" ||
							currentModel.provider === "openrouter")
					) {
						// Check if provider needs passkey to restore
						const needsRestore = await checkProviderNeedsRestore(
							currentModel.provider,
						);
						if (needsRestore) {
							logInfo(
								`🔐 ${currentModel.provider} authentication required - waiting for passkey`,
							);
							setPasskeyProvider(currentModel.provider);
							setServicesStatus("awaiting-passkey");
							return;
						}
					}
				} catch (error) {
					logError(
						"Failed to check auth provider restore - continuing anyway:",
						error,
					);
					// Continue to ready state even if check fails
				}

				// Initialize embedding settings
				await initializeEmbeddingSettings();
				logInfo(`🚀 App initialization completed in ${duration}ms`);
				setServicesStatus("ready");
			} catch (error) {
				logError("❌ App initialization failed:", error);
				setServicesStatus("error");
				setInitError(error instanceof Error ? error.message : "Unknown error");
			}
		};

		initializeApp();
	}, []);

	// Handle passkey submission
	const handlePasskeySubmit = async (passkey: string) => {
		if (!passkeyProvider) return;

		try {
			// Restore provider in UI thread (proxy mode)
			await restoreAuthProvider(passkeyProvider, passkey);

			// Also restore in offscreen thread (main mode) via background job
			await backgroundJob.execute(
				"restore-auth-provider",
				{ provider: passkeyProvider, passkey },
				{ stream: false },
			);

			logInfo(`✅ ${passkeyProvider} authenticated and restored`);
			setPasskeyProvider(null);
			setServicesStatus("ready");
		} catch (error) {
			logError("Failed to restore auth provider:", error);
			throw error; // Re-throw to let dialog show error
		}
	};

	const handlePasskeyCancel = async () => {
		// Clear the current model since the user cancelled passkey entry
		try {
			await serviceManager.llmService.clearCurrentModel();
			logInfo(
				"Cleared current model after passkey cancellation - user will need to select a different model",
			);
		} catch (error) {
			logError("Failed to clear current model:", error);
		}

		setPasskeyProvider(null);
		setServicesStatus("ready"); // Continue without the auth provider
		logInfo("User cancelled passkey prompt - continuing without auth provider");
	};

	const handleRetry = async () => {
		setServicesStatus("loading");
		setInitError(null);
		setUiProgress(0);
		// Re-run initialization
		try {
			const progressStream = await backgroundJob.initializeServices();
			for await (const progress of progressStream) {
				setUiProgress(progress.progress);
				if (progress.status === "completed") {
					setUiProgress(100);
					await serviceManager.initialize({ proxy: true });

					// Check auth provider with error handling
					try {
						const currentModel =
							await serviceManager.llmService.getCurrentModel();
						if (
							currentModel &&
							(currentModel.provider === "openai" ||
								currentModel.provider === "openrouter")
						) {
							const needsRestore = await checkProviderNeedsRestore(
								currentModel.provider,
							);
							if (needsRestore) {
								logInfo(
									`🔐 ${currentModel.provider} authentication required - waiting for passkey`,
								);
								setPasskeyProvider(currentModel.provider);
								setServicesStatus("awaiting-passkey");
								return;
							}
						}
					} catch (error) {
						logError(
							"Failed to check auth provider restore - continuing anyway:",
							error,
						);
					}

					setTimeout(() => {
						setServicesStatus("ready");
						logInfo("✅ App re-initialization complete");
					}, 100);
					break;
				}
			}
		} catch (error) {
			logError("❌ App re-initialization failed:", error);
			setServicesStatus("error");
			setInitError(error instanceof Error ? error.message : "Unknown error");
		}
	};

	// Initial route is set before first render in popup.tsx based on storage flag

	if (servicesStatus === "loading" || servicesStatus === "error") {
		return (
			<ThemeProvider defaultTheme="system">
				<CursorProvider>
					<Cursor>
						<svg
							className="size-6 text-blue-500"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 40 40"
						>
							<path
								fill="currentColor"
								d="M1.8 4.4 7 36.2c.3 1.8 2.6 2.3 3.6.8l3.9-5.7c1.7-2.5 4.5-4.1 7.5-4.3l6.9-.5c1.8-.1 2.5-2.4 1.1-3.5L5 2.5c-1.4-1.1-3.5 0-3.3 1.9Z"
							/>
						</svg>
					</Cursor>
					<CursorFollow>
						<div className="bg-blue-500 text-white px-2 py-1 rounded-lg text-sm shadow-lg">
							Your Memorall
						</div>
					</CursorFollow>
					<AppLoadingScreen
						error={servicesStatus === "error" ? initError : null}
						uiProgress={uiProgress}
						onRetry={handleRetry}
					/>
				</CursorProvider>
			</ThemeProvider>
		);
	}

	return (
		<ThemeProvider defaultTheme="system">
			<CopilotProvider>
				<NiceModal.Provider>
					<Router>
						<NavigatorBridge />
						<Routes>
							{/* Auth page without layout */}
							<Route path="/auth" element={<AuthPage />} />

							{/* All other routes with layout */}
							<Route
								path="*"
								element={
									<Layout>
										<Routes>
											<Route path="/*" element={<ChatPage />} />
											<Route path="/llm" element={<LLMPage />} />
											<Route path="/embeddings" element={<EmbeddingPage />} />
											<Route path="/database" element={<DatabasePage />} />
											<Route
												path="/knowledge-graph"
												element={<KnowledgeGraphPage />}
											/>
											<Route
												path="/documents"
												element={<DocumentLibraryPage />}
											/>
											<Route
												path="/activities"
												element={<ActivityTimelinePage />}
											/>
											<Route
												path="/flow-builder"
												element={<FlowBuilderPage />}
											/>
											<Route path="/logs" element={<LogsPage />} />
										</Routes>
									</Layout>
								}
							/>
						</Routes>
						<Copilot />
					</Router>

					{/* Passkey prompt dialog */}
					{passkeyProvider && (
						<PasskeyPromptDialog
							open={servicesStatus === "awaiting-passkey"}
							provider={passkeyProvider}
							onPasskeySubmit={handlePasskeySubmit}
							onCancel={handlePasskeyCancel}
						/>
					)}
				</NiceModal.Provider>
			</CopilotProvider>
		</ThemeProvider>
	);
};

export default App;
