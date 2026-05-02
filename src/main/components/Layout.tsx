import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
	MessageCircle,
	Bot,
	VectorSquareIcon,
	Database,
	Bug,
	Network,
	ChevronDown,
	FileText,
	BrainCircuit,
	// GitBranch,
	ExternalLink,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/main/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/main/components/ui/dropdown-menu";
import { useTranslation } from "react-i18next";
import { ProcessMonitor } from "@/main/components/molecules/ProcessMonitor";
import { openStandalonePage } from "@/utils/open-standalone";
import { isPopupSurface } from "@/utils/dom";
import { useIsWideViewport } from "@/main/hooks/use-viewport";
import { RuntimeSessionsPopover } from "@/main/components/molecules/RuntimeSessions";
import { SettingPanel } from "@/main/components/molecules/SettingPanel";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";

interface LayoutProps {
	children: React.ReactNode;
}

const navigation = [
	{ nameKey: "navigation.chat", path: "/", icon: MessageCircle },
	{ nameKey: "navigation.documents", path: "/documents", icon: FileText },
	{ nameKey: "navigation.agents", path: "/agents", icon: Bot },
	{
		nameKey: "navigation.knowledgeGraph",
		path: "/knowledge-graph",
		icon: Network,
	},
	// { nameKey: "navigation.flowBuilder", path: "/flow-builder", icon: GitBranch },
	// { nameKey: "navigation.activities", path: "/activities", icon: BrainCircuit },
	{ nameKey: "navigation.models", path: "/llm", icon: BrainCircuit },
];

const debugItems = [
	{
		nameKey: "navigation.embeddings",
		path: "/embeddings",
		icon: VectorSquareIcon,
	},
	{ nameKey: "navigation.database", path: "/database", icon: Database },
	{ nameKey: "navigation.logs", path: "/logs", icon: Bug },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
	return <LayoutShell>{children}</LayoutShell>;
};

const LayoutShell: React.FC<LayoutProps> = ({ children }) => {
	const location = useLocation();
	const { t } = useTranslation();
	const isWideViewport = useIsWideViewport();
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);

	// State for model reload progress
	const [isReloadingModel, setIsReloadingModel] = React.useState(false);
	const [reloadProgress, setReloadProgress] = React.useState({
		stage: "",
		progress: 0,
	});

	const allPaths = [...navigation, ...debugItems];
	const checkIsExistNavigation = allPaths.some(
		(item) => item.path === location.pathname,
	);

	const isDebugSelected = debugItems.some(
		(item) => item.path === location.pathname,
	);
	const isWideChatSidePanelVisible = !isPopupSurface() && isWideViewport;
	const showRuntimeTrigger = !isWideChatSidePanelVisible;

	React.useEffect(() => {
		void refreshRuntimeSessions();
	}, [refreshRuntimeSessions]);

	return (
		<div className="h-screen bg-app flex flex-col">
			<nav
				className="flex-shrink-0 sticky top-0 z-40"
				style={{
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
					background: "var(--header-glass)",
					borderBottom: "1px solid var(--glass-border)",
				}}
			>
				<div className="px-3">
					<div className="flex h-12 items-center justify-between">
						<div className="flex items-center space-x-1">
							<TooltipProvider>
								{navigation.map((item) => {
									const isSelected =
										location.pathname === item.path ||
										(!checkIsExistNavigation && item.path === "/");
									const IconComponent = item.icon;
									return (
										<Tooltip key={item.path}>
											<TooltipTrigger asChild>
												<Link
													to={item.path}
													className={`${
														isSelected
															? "bg-blue-500/10 text-blue-500 border border-blue-500/30 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_4px_20px_rgba(59,130,246,0.12)]"
															: "text-muted-foreground hover:text-foreground hover:bg-white/5"
													} p-2 text-sm font-medium flex items-center rounded-md transition-all duration-200 ease-in-out`}
												>
													<IconComponent
														size={16}
														className={`flex-shrink-0 transition-transform duration-200 ease-in-out ${
															isSelected ? "scale-110" : "hover:scale-110"
														}`}
													/>
												</Link>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t(item.nameKey)}</p>
											</TooltipContent>
										</Tooltip>
									);
								})}

								{/* Debug dropdown */}
								<DropdownMenu>
									<Tooltip>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<button
													className={`${
														isDebugSelected
															? "bg-blue-500/10 text-blue-500 border border-blue-500/30 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_4px_20px_rgba(59,130,246,0.12)]"
															: "text-muted-foreground hover:text-foreground hover:bg-white/5"
													} p-2 text-sm font-medium flex items-center rounded-md transition-all duration-200 ease-in-out`}
												>
													<Bug
														size={16}
														className={`flex-shrink-0 transition-transform duration-200 ease-in-out ${
															isDebugSelected ? "scale-110" : "hover:scale-110"
														}`}
													/>
													<ChevronDown size={12} className="ml-1" />
												</button>
											</DropdownMenuTrigger>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>{t("navigation.debug")}</p>
										</TooltipContent>
									</Tooltip>
									<DropdownMenuContent align="start">
										{debugItems.map((item) => {
											const IconComponent = item.icon;
											return (
												<DropdownMenuItem key={item.path} asChild>
													<Link
														to={item.path}
														className="flex items-center gap-2 cursor-pointer"
													>
														<IconComponent size={14} />
														<span>{t(item.nameKey)}</span>
													</Link>
												</DropdownMenuItem>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							</TooltipProvider>
						</div>

						{/* Process Monitor and Settings */}
						<div className="flex items-center gap-2">
							{isPopupSurface() && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												onClick={openStandalonePage}
												className="text-muted-foreground hover:text-foreground hover:bg-white/5 p-2 text-sm font-medium flex items-center rounded-md transition-all duration-200 ease-in-out"
											>
												<ExternalLink size={16} />
											</button>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>
												{t("common.openStandalone", {
													defaultValue: "Open in standalone",
												})}
											</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
							{showRuntimeTrigger ? <RuntimeSessionsPopover /> : null}
							<ProcessMonitor />
							<SettingPanel
								setIsReloadingModel={setIsReloadingModel}
								setReloadProgress={setReloadProgress}
							/>
						</div>
					</div>
				</div>
			</nav>

			<main className="flex-1 min-h-0 overflow-auto">{children}</main>

			{/* Model reload loading overlay */}
			{isReloadingModel && (
				<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
					<div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
						<h3 className="text-lg font-semibold mb-4">
							{t("embedding.reloading", {
								defaultValue: "Reloading Embedding Model",
							})}
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							{reloadProgress.stage || "Downloading model..."}
						</p>
						<div className="w-full bg-muted rounded-full h-2 overflow-hidden">
							<div
								className="bg-primary h-full transition-all duration-300"
								style={{ width: `${reloadProgress.progress}%` }}
							/>
						</div>
						<p className="text-xs text-muted-foreground mt-2 text-center">
							{+reloadProgress.progress.toFixed(2)}%
						</p>
						<p className="text-xs text-muted-foreground mt-4">
							{t("embedding.pleaseWait", {
								defaultValue: "Please wait, do not close this window...",
							})}
						</p>
					</div>
				</div>
			)}
		</div>
	);
};
