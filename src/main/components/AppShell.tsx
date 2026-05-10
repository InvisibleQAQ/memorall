import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	Bot,
	BrainCircuit,
	ChevronsLeft,
	ChevronsRight,
	FileText,
	Network,
	Server,
} from "lucide-react";
import { RightApplicationLayout } from "@/main/components/RightApplicationLayout";
import { ChatPage } from "@/main/pages/ChatPage";
import { useShellLayoutStore } from "@/main/stores/shell-layout";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
import { Button } from "@/main/components/ui/button";
import {
	LoadingScreen,
	NoModelsScreen,
	useCurrentModel,
} from "@/main/modules/chat/components";
import {
	ModelDownloadingScreen,
	useDownloadProgress,
} from "@/main/modules/llm/components";

interface AppShellProps {
	children: React.ReactNode;
}

const mobilePanelItems = [
	{ path: "/documents", label: "Documents", icon: FileText },
	{ path: "/agents", label: "Agents", icon: Bot },
	{ path: "/knowledge-graph", label: "Knowledge", icon: Network },
	{ path: "/llm", label: "Models", icon: BrainCircuit },
	{ path: "/runtime", label: "Runtime", icon: Server },
];

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { model, isInitialized, handleModelLoaded } = useCurrentModel();
	const { downloadProgress, quickDownloadModel } = useDownloadProgress();
	const chatShellCollapsed = useShellLayoutStore(
		(state) => state.chatShellCollapsed,
	);
	const setChatShellCollapsed = useShellLayoutStore(
		(state) => state.setChatShellCollapsed,
	);
	const chatShellWidth = useShellLayoutStore((state) => state.chatShellWidth);
	const setChatShellWidth = useShellLayoutStore(
		(state) => state.setChatShellWidth,
	);
	const rightPanelCollapsed = useShellLayoutStore(
		(state) => state.rightPanelCollapsed,
	);
	const setRightPanelCollapsed = useShellLayoutStore(
		(state) => state.setRightPanelCollapsed,
	);
	const setRightWorkspaceTab = useShellLayoutStore(
		(state) => state.setRightWorkspaceTab,
	);
	const isDraggingRef = React.useRef(false);
	const startXRef = React.useRef(0);
	const startWidthRef = React.useRef(0);
	const [isResizing, setIsResizing] = React.useState(false);
	const [isNarrow, setIsNarrow] = React.useState(() => window.innerWidth < 500);
	const runtimeCount = useRuntimeSessionsStore((state) =>
		state.getRuntimeCount(),
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);

	React.useEffect(() => {
		const update = () => setIsNarrow(window.innerWidth < 500);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	React.useEffect(() => {
		void refreshRuntimeSessions();
	}, [refreshRuntimeSessions]);

	if (!isInitialized) {
		return <LoadingScreen />;
	}

	const isModelDownloading =
		downloadProgress.percent > 0 && downloadProgress.percent < 100;

	if (isModelDownloading) {
		return (
			<ModelDownloadingScreen
				downloadProgress={downloadProgress}
				modelName={quickDownloadModel}
			/>
		);
	}

	if (!model) {
		return (
			<NoModelsScreen
				onModelLoaded={handleModelLoaded}
				onNavigateToModels={() => navigate("/llm")}
			/>
		);
	}

	const effectiveChatShellCollapsed =
		!rightPanelCollapsed && chatShellCollapsed;
	const chatPanelWidth = isNarrow
		? "100%"
		: rightPanelCollapsed
			? "calc(100vw - 56px)"
			: effectiveChatShellCollapsed
				? "56px"
				: `${chatShellWidth}vw`;
	const rightPanelWidth = rightPanelCollapsed
		? "56px"
		: effectiveChatShellCollapsed
			? "calc(100vw - 56px)"
			: `calc(100vw - ${chatShellWidth}vw)`;
	const panelTransitionClass = isResizing
		? ""
		: "transition-[width,flex-basis] duration-300 ease-out";
	const isMobileWorkspaceOpen =
		isNarrow &&
		mobilePanelItems.some((item) => item.path === location.pathname);

	const handleResizeMouseDown = (event: React.MouseEvent) => {
		event.preventDefault();
		isDraggingRef.current = true;
		setIsResizing(true);
		startXRef.current = event.clientX;
		startWidthRef.current = chatShellWidth;

		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!isDraggingRef.current) return;
			const viewportWidth = window.innerWidth || 1;
			const delta =
				((moveEvent.clientX - startXRef.current) / viewportWidth) * 100;
			const next = Math.max(28, Math.min(60, startWidthRef.current + delta));
			setChatShellWidth(next);
		};

		const onMouseUp = () => {
			isDraggingRef.current = false;
			setIsResizing(false);
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	};

	return (
		<div className="flex h-screen min-h-0 overflow-hidden bg-background text-foreground max-[499px]:block">
			<section
				className={`relative z-20 h-full min-h-0 flex-shrink-0 border-r bg-background max-[499px]:h-screen max-[499px]:w-full max-[499px]:border-r-0 ${panelTransitionClass}`}
				style={{
					width: chatPanelWidth,
					flexBasis: chatPanelWidth,
				}}
			>
				{isNarrow && !isMobileWorkspaceOpen ? (
					<div className="absolute right-3 top-3 z-40 flex items-center gap-1 rounded-lg border border-border/70 bg-background/85 p-1 shadow-sm backdrop-blur-xl">
						{mobilePanelItems.map((item) => {
							const Icon = item.icon;
							const isRuntime = item.path === "/runtime";
							return (
								<Link
									key={item.path}
									to={item.path}
									className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
									aria-label={item.label}
									title={item.label}
								>
									<Icon size={15} />
									{isRuntime && runtimeCount > 0 ? (
										<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
											{runtimeCount > 9 ? "9+" : runtimeCount}
										</span>
									) : null}
								</Link>
							);
						})}
					</div>
				) : null}
				<div
					className={
						effectiveChatShellCollapsed
							? "h-full w-[56px] overflow-hidden"
							: "h-full"
					}
				>
					<ChatPage
						hideWideSidePanelCollapsedToggle={effectiveChatShellCollapsed}
						onOpenAgentWorkspace={() => setRightWorkspaceTab("agent")}
					/>
				</div>
				<div
					onMouseDown={handleResizeMouseDown}
					className="absolute bottom-0 right-0 top-0 hidden w-1 cursor-col-resize transition-colors hover:bg-primary/40 min-[500px]:block"
				/>
				{!rightPanelCollapsed ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => setChatShellCollapsed(!effectiveChatShellCollapsed)}
						className="absolute right-2 top-2 z-30 hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground min-[500px]:inline-flex"
						aria-label={
							effectiveChatShellCollapsed
								? "Restore chat panel"
								: "Show full right panel"
						}
						title={
							effectiveChatShellCollapsed
								? "Restore chat panel"
								: "Show full right panel"
						}
					>
						{effectiveChatShellCollapsed ? (
							<ChevronsRight size={18} />
						) : (
							<ChevronsLeft size={18} />
						)}
					</Button>
				) : null}
			</section>

			<section
				className={`min-h-0 min-w-0 flex-shrink-0 overflow-hidden max-[499px]:hidden ${panelTransitionClass}`}
				style={{
					width: rightPanelWidth,
					flexBasis: rightPanelWidth,
				}}
			>
				<RightApplicationLayout
					collapsed={rightPanelCollapsed}
					onCollapsedChange={setRightPanelCollapsed}
				>
					{children}
				</RightApplicationLayout>
			</section>

			{isMobileWorkspaceOpen ? (
				<section className="fixed inset-0 z-50 bg-background min-[500px]:hidden">
					<RightApplicationLayout
						collapsed={false}
						onCollapsedChange={(collapsed) => {
							if (collapsed) navigate("/");
						}}
					>
						{children}
					</RightApplicationLayout>
				</section>
			) : null}
		</div>
	);
};
