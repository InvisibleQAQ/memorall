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
import { useEmbeddingSettings } from "./stores/embedding-settings";
import { serviceManager } from "@/services";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { sharedStorageService } from "@/services/shared-storage/shared-storage-service";
import { CopilotProvider, Copilot } from "./components/atoms/copilot";
import { AppShell } from "./components/AppShell";
// pages
import { EmbeddingPage } from "./pages/EmbeddingPage";
import { LLMPage } from "./pages/LLMPage";
import { DatabasePage } from "./pages/DatabasePage";
import { LogsPage } from "./pages/LogsPage";
import { AppLoadingScreen } from "./components/atoms/AppLoadingScreen";
import { KnowledgeGraphPage } from "./pages/KnowledgeGraphPage";
import { DocumentLibraryPage } from "./pages/DocumentLibraryPage";
import { ActivityTimelinePage } from "./pages/ActivityTimelinePage";
import { AgentsPage } from "./pages/AgentsPage";
import { RuntimePage } from "./pages/RuntimePage";
import { AuthPage } from "./pages/AuthPage";
import { FlowBuilderPage } from "./pages/FlowBuilderPage/FlowBuilderPage";
import { registerAllEditors } from "@/main/modules/documents/editors";
import { useAuthInit } from "@/main/modules/supabase";
import {
	AgentCursorBadge,
	AgentCursorOverlay,
	AgentCursorPointer,
} from "@/components/AgentCursor";

const App: React.FC = () => {
	const [servicesStatus, setServicesStatus] = useState<
		"loading" | "ready" | "error"
	>("loading");
	const [initError, setInitError] = useState<string | null>(null);
	const [uiProgress, setUiProgress] = useState(0);

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
				logInfo("Starting app initialization...");
				setServicesStatus("loading");

				// Initialize shared storage service first (required for cross-thread communication)
				await sharedStorageService.initialize();
				logInfo("Shared storage service initialized in UI thread");

				// Initialize services through offscreen with progress streaming
				const progressStream = await backgroundJob.initializeServices();
				let startTime = Date.now();

				// Listen to initialization progress
				for await (const progress of progressStream) {
					logInfo("App initialization progress:", progress);
					setUiProgress(progress.progress);

					if (progress.status === "completed") {
						setUiProgress(100);
						logInfo("App initialization complete");
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
				logInfo("Document editors registered");

				// Initialize embedding settings
				await initializeEmbeddingSettings();
				logInfo(`App initialization completed in ${duration}ms`);
				setServicesStatus("ready");
			} catch (error) {
				logError("App initialization failed:", error);
				setServicesStatus("error");
				setInitError(error instanceof Error ? error.message : "Unknown error");
			}
		};

		initializeApp();
	}, []);

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

					setTimeout(() => {
						setServicesStatus("ready");
						logInfo("App re-initialization complete");
					}, 100);
					break;
				}
			}
		} catch (error) {
			logError("App re-initialization failed:", error);
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
						<AgentCursorPointer />
					</Cursor>
					<CursorFollow
						sideOffset={18}
						align="bottom-right"
						transition={{ stiffness: 260, damping: 34, bounce: 0 }}
					>
						<AgentCursorBadge
							message="Your Memorall"
							animateMessage={false}
							iconSize={30}
						/>
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
									<AppShell>
										<Routes>
											<Route path="/" element={<DocumentLibraryPage />} />
											<Route path="/llm" element={<LLMPage />} />
											<Route path="/runtime" element={<RuntimePage />} />
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
											<Route path="/agents" element={<AgentsPage />} />
											<Route
												path="/activities"
												element={<ActivityTimelinePage />}
											/>
											<Route
												path="/flow-builder"
												element={<FlowBuilderPage />}
											/>
											<Route path="/logs" element={<LogsPage />} />
											<Route path="*" element={<DocumentLibraryPage />} />
										</Routes>
									</AppShell>
								}
							/>
						</Routes>
						<Copilot />
					</Router>
					<AgentCursorOverlay />
				</NiceModal.Provider>
			</CopilotProvider>
		</ThemeProvider>
	);
};

export default App;
