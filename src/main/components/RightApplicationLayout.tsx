import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
	Bot,
	VectorSquareIcon,
	Database,
	Bug,
	Network,
	ChevronDown,
	FileText,
	BrainCircuit,
	ExternalLink,
	Server,
	ChevronsLeft,
	ChevronsRight,
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
import { SettingPanel } from "@/main/components/molecules/SettingPanel";
import { Button } from "@/main/components/ui/button";
import { useRuntimeSessionsStore } from "@/main/stores/runtime-sessions";
interface RightApplicationLayoutProps {
	children: React.ReactNode;
	collapsed?: boolean;
	onCollapsedChange?: (collapsed: boolean) => void;
}

const navigation = [
	{ nameKey: "navigation.documents", path: "/documents", icon: FileText },
	{ nameKey: "navigation.agents", path: "/agents", icon: Bot },
	{
		nameKey: "navigation.knowledgeGraph",
		path: "/knowledge-graph",
		icon: Network,
	},
	{ nameKey: "navigation.models", path: "/llm", icon: BrainCircuit },
	{ nameKey: "sandboxPanel.title", path: "/runtime", icon: Server },
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

export const RightApplicationLayout: React.FC<RightApplicationLayoutProps> = ({
	children,
	collapsed = false,
	onCollapsedChange,
}) => {
	const location = useLocation();
	const { t } = useTranslation();

	const [isReloadingModel, setIsReloadingModel] = React.useState(false);
	const [reloadProgress, setReloadProgress] = React.useState({
		stage: "",
		progress: 0,
	});
	const commandsCount = useRuntimeSessionsStore(
		(state) => state.commands.length,
	);
	const serversCount = useRuntimeSessionsStore((state) => state.servers.length);
	const hasActiveWebSession = useRuntimeSessionsStore(
		(state) => state.activeWebSession.isOpen,
	);
	const refreshRuntimeSessions = useRuntimeSessionsStore(
		(state) => state.refresh,
	);
	const runtimeCount =
		commandsCount + serversCount + Number(hasActiveWebSession);

	React.useEffect(() => {
		void refreshRuntimeSessions();
	}, [refreshRuntimeSessions]);

	const allPaths = [...navigation, ...debugItems];
	const checkIsExistNavigation = allPaths.some(
		(item) => item.path === location.pathname,
	);

	const isDebugSelected = debugItems.some(
		(item) => item.path === location.pathname,
	);

	const openPanel = () => {
		onCollapsedChange?.(false);
	};

	const renderRuntimeBadge = (count: number) =>
		count > 0 ? (
			<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold leading-none text-white shadow-sm">
				{count > 9 ? "9+" : count}
			</span>
		) : null;

	if (collapsed) {
		return (
			<aside className="flex h-full min-h-0 w-14 flex-col items-center border-l bg-app py-2">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-9 w-9 text-muted-foreground hover:text-foreground"
					aria-label="Expand workspace panel"
					title="Expand workspace panel"
					onClick={() => openPanel()}
				>
					<ChevronsLeft size={17} />
				</Button>
				<div className="mt-3 flex flex-col items-center gap-1">
					<TooltipProvider>
						{navigation.map((item) => {
							const IconComponent = item.icon;
							return (
								<Tooltip key={item.path}>
									<TooltipTrigger asChild>
										<Link
											to={item.path}
											onClick={() => openPanel()}
											className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
										>
											<IconComponent size={16} />
											{item.path === "/runtime"
												? renderRuntimeBadge(runtimeCount)
												: null}
										</Link>
									</TooltipTrigger>
									<TooltipContent side="left">
										<p>{t(item.nameKey)}</p>
									</TooltipContent>
								</Tooltip>
							);
						})}
					</TooltipProvider>
				</div>
			</aside>
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-col bg-app">
			<nav
				className="z-30 flex-shrink-0"
				style={{
					backdropFilter: "blur(20px)",
					WebkitBackdropFilter: "blur(20px)",
					background: "var(--header-glass)",
					borderBottom: "1px solid var(--glass-border)",
				}}
			>
				<div className="px-3">
					<div className="flex h-12 items-center justify-between gap-2">
						<div className="flex min-w-0 items-center space-x-1 overflow-x-auto">
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="h-9 w-9 text-muted-foreground hover:text-foreground"
											aria-label="Collapse workspace panel"
											title="Collapse workspace panel"
											onClick={() => onCollapsedChange?.(true)}
										>
											<ChevronsRight size={16} />
										</Button>
									</TooltipTrigger>
									<TooltipContent side="bottom">
										<p>Collapse workspace panel</p>
									</TooltipContent>
								</Tooltip>
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
													onClick={() => openPanel()}
													className={`${
														isSelected
															? "bg-blue-500/10 text-blue-500 border border-blue-500/30 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_4px_20px_rgba(59,130,246,0.12)]"
															: "text-muted-foreground hover:text-foreground hover:bg-white/5"
													} relative flex items-center rounded-md p-2 text-sm font-medium transition-all duration-200 ease-in-out`}
												>
													<IconComponent
														size={16}
														className={`flex-shrink-0 transition-transform duration-200 ease-in-out ${
															isSelected ? "scale-110" : "hover:scale-110"
														}`}
													/>
													{item.path === "/runtime"
														? renderRuntimeBadge(runtimeCount)
														: null}
												</Link>
											</TooltipTrigger>
											<TooltipContent side="bottom">
												<p>{t(item.nameKey)}</p>
											</TooltipContent>
										</Tooltip>
									);
								})}

								<DropdownMenu>
									<Tooltip>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<button
													className={`${
														isDebugSelected
															? "bg-blue-500/10 text-blue-500 border border-blue-500/30 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_4px_20px_rgba(59,130,246,0.12)]"
															: "text-muted-foreground hover:text-foreground hover:bg-white/5"
													} flex items-center rounded-md p-2 text-sm font-medium transition-all duration-200 ease-in-out`}
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
														onClick={() => openPanel()}
														className="flex cursor-pointer items-center gap-2"
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

						<div className="flex flex-shrink-0 items-center gap-2">
							{isPopupSurface() && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={openStandalonePage}
												className="flex items-center rounded-md p-2 text-sm font-medium text-muted-foreground transition-all duration-200 ease-in-out hover:bg-white/5 hover:text-foreground"
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
							<ProcessMonitor />
							<SettingPanel
								setIsReloadingModel={setIsReloadingModel}
								setReloadProgress={setReloadProgress}
							/>
						</div>
					</div>
				</div>
			</nav>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				{children}
			</div>

			{isReloadingModel && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="mx-4 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
						<h3 className="mb-4 text-lg font-semibold">
							{t("embedding.reloading", {
								defaultValue: "Reloading Embedding Model",
							})}
						</h3>
						<p className="mb-4 text-sm text-muted-foreground">
							{reloadProgress.stage || "Downloading model..."}
						</p>
						<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
							<div
								className="h-full bg-primary transition-all duration-300"
								style={{ width: `${reloadProgress.progress}%` }}
							/>
						</div>
						<p className="mt-2 text-center text-xs text-muted-foreground">
							{+reloadProgress.progress.toFixed(2)}%
						</p>
						<p className="mt-4 text-xs text-muted-foreground">
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
