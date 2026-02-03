import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
	MessageCircle,
	Bot,
	VectorSquareIcon,
	Database,
	Bug,
	Network,
	ChevronDown,
	Sun,
	Moon,
	Monitor,
	FileText,
	Languages,
	Settings,
	BrainCircuit,
	GitBranch,
	LogIn,
	LogOut,
	User as UserIcon,
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
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/main/components/ui/dropdown-menu";
import { useTheme } from "@/main/components/molecules/ThemeContext";
import {
	useCurrentEmbeddingSize,
	useHasExistingData,
	useEmbeddingSettings,
} from "@/main/stores/embedding-settings";
import { useLanguage } from "@/main/i18n/hooks/useLanguage";
import { useTranslation } from "react-i18next";
import {
	EMBEDDING_MODELS,
	type EmbeddingSize,
	getAvailableSizes,
} from "@/config/embedding-models";
import { clearAllEmbeddings } from "@/services/database/utils/embedding-cleanup";
import { serviceManager } from "@/services";
import { CopilotTrigger } from "@/main/components/atoms/copilot";
import { getCurrentEmbeddingSize } from "@/utils/embedding-size-config";
import { ProcessMonitor } from "@/main/components/molecules/ProcessMonitor";
import { VietnamFlag, USFlag } from "@/main/components/atoms/flags";
import { useAuth, useAuthActions } from "@/main/modules/supabase";
import { backgroundJob } from "@/services/background-jobs/background-job";
import { logError, logInfo } from "@/utils/logger";

import manifest from "../../../manifest.json";

interface LayoutProps {
	children: React.ReactNode;
}

const navigation = [
	{ nameKey: "navigation.chat", path: "/", icon: MessageCircle },
	{ nameKey: "navigation.documents", path: "/documents", icon: FileText },
	{
		nameKey: "navigation.knowledgeGraph",
		path: "/knowledge-graph",
		icon: Network,
	},
	{ nameKey: "navigation.flowBuilder", path: "/flow-builder", icon: GitBranch },
	{ nameKey: "navigation.activities", path: "/activities", icon: BrainCircuit },
	{ nameKey: "navigation.models", path: "/llm", icon: Bot },
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
	const location = useLocation();
	const navigate = useNavigate();
	const { theme, setTheme } = useTheme();
	const embeddingSize = useCurrentEmbeddingSize();
	const hasExistingData = useHasExistingData();
	const setEmbeddingSize = useEmbeddingSettings(
		(state) => state.setEmbeddingSize,
	);
	const { language, changeLanguage } = useLanguage();
	const { t } = useTranslation();
	const { user } = useAuth();
	const { signOut } = useAuthActions();

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

	const getThemeIcon = () => {
		switch (theme) {
			case "light":
				return <Sun size={16} />;
			case "dark":
				return <Moon size={16} />;
			case "system":
				return <Monitor size={16} />;
		}
	};

	const handleLogout = async () => {
		try {
			await signOut();
			navigate("/auth");
		} catch {
			// Ignore logout errors here; hook already manages error state
		}
	};

	const handleSettingsDropdownOpen = async (open: boolean) => {
		if (open) {
			// Refresh embedding size from offscreen when dropdown opens
			const currentSize = await getCurrentEmbeddingSize();
			const storeSize = useEmbeddingSettings.getState().embeddingSize;

			// Only update if different to avoid unnecessary re-renders
			if (currentSize !== storeSize) {
				useEmbeddingSettings.setState({ embeddingSize: currentSize });
			}
		}
	};

	const handleEmbeddingSizeChange = async (newSize: EmbeddingSize) => {
		if (hasExistingData && newSize !== embeddingSize) {
			const confirmed = window.confirm(
				t("embedding.changeWarning", {
					defaultValue:
						"Changing embedding size will require clearing existing embeddings in nodes and edges. Do you want to continue?",
				}),
			);

			if (!confirmed) {
				return;
			}

			try {
				// Clear all embeddings from database
				const result = await clearAllEmbeddings(serviceManager.databaseService);
				logInfo(
					`Cleared ${result.total} embeddings (${result.nodes} nodes, ${result.edges} edges, ${result.messages} messages)`,
				);
			} catch (error) {
				alert(
					t("embedding.clearError", {
						defaultValue: "Failed to clear embeddings. Please try again.",
					}),
				);
				return;
			}
		}

		// Update local state immediately
		await setEmbeddingSize(newSize);

		// Send reload job to offscreen thread to reload embedding model
		setIsReloadingModel(true);
		setReloadProgress({ stage: "Initializing...", progress: 0 });

		try {
			// Execute reload job with streaming to get real-time progress
			const { stream } = await backgroundJob.execute(
				"reload-embedding-model",
				{ newSize },
				{ stream: true },
			);

			// Stream progress updates
			for await (const progressEvent of stream) {
				if (progressEvent.progress !== undefined) {
					setReloadProgress({
						stage: progressEvent.stage || "Processing...",
						progress: progressEvent.progress,
					});
				}

				if (progressEvent.status === "failed") {
					throw new Error(progressEvent.error || "Job failed");
				}
			}

			logInfo(`✅ Embedding model reloaded to ${newSize}`);
			setIsReloadingModel(false);
		} catch (error) {
			logError("Failed to reload embedding model:", error);
			setIsReloadingModel(false);
			alert(
				t("embedding.reloadError", {
					defaultValue:
						"Failed to reload embedding model. Please refresh the page.",
				}),
			);
		}
	};

	return (
		<div className="h-screen bg-background flex flex-col">
			<nav className="border-b flex-shrink-0 bg-muted/20">
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
															? "bg-background text-foreground shadow-sm border border-border"
															: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
															? "bg-background text-foreground shadow-sm border border-border"
															: "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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

						{/* Process Monitor, Settings and Copilot */}
						<div className="flex items-center gap-2">
							<CopilotTrigger />
							<ProcessMonitor />
							<TooltipProvider>
								{/* Settings Menu */}
								<DropdownMenu onOpenChange={handleSettingsDropdownOpen}>
									<Tooltip>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<button className="text-muted-foreground hover:text-foreground hover:bg-muted/50 p-2 text-sm font-medium flex items-center rounded-md transition-all duration-200 ease-in-out">
													<Settings size={16} />
												</button>
											</DropdownMenuTrigger>
										</TooltipTrigger>
										<TooltipContent side="bottom">
											<p>{t("common.settings")}</p>
										</TooltipContent>
									</Tooltip>
									<DropdownMenuContent align="end" className="w-56">
										{/* Account Section - Top */}
										{!user ? (
											<div className="p-2">
												<button
													onClick={() => navigate("/auth")}
													className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
												>
													<LogIn size={16} />
													<span>{t("auth:actions.signIn")}</span>
												</button>
											</div>
										) : (
											<div className="px-2 py-1.5 flex items-center gap-2">
												<UserIcon size={14} className="text-muted-foreground" />
												<span className="text-sm truncate flex-1">
													{user.email}
												</span>
											</div>
										)}

										<DropdownMenuSeparator />

										{/* Language Section */}
										<DropdownMenuLabel className="flex items-center gap-2">
											<Languages size={14} />
											<span>{t("language.label")}</span>
										</DropdownMenuLabel>
										<DropdownMenuItem
											onClick={() => changeLanguage("en")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<USFlag
												className="flex-shrink-0"
												width={16}
												height={12}
											/>
											<span>{t("language.english")}</span>
											{language === "en" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => changeLanguage("vn")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<VietnamFlag
												className="flex-shrink-0"
												width={16}
												height={12}
											/>
											<span>{t("language.vietnamese")}</span>
											{language === "vn" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>

										<DropdownMenuSeparator />

										{/* Embedding Size Section */}
										<DropdownMenuLabel className="flex items-center gap-2">
											<VectorSquareIcon size={14} />
											<span>
												{t("embedding.label", {
													defaultValue: "Embedding Size",
												})}
											</span>
										</DropdownMenuLabel>
										{getAvailableSizes().map((size) => {
											const config = EMBEDDING_MODELS[size];
											const isDisabled = size === "large";
											return (
												<DropdownMenuItem
													key={size}
													disabled={isDisabled}
													onClick={() =>
														!isDisabled && handleEmbeddingSizeChange(size)
													}
													className="flex flex-col items-start gap-0.5 cursor-pointer"
												>
													<div className="flex items-center gap-2 w-full">
														<span className="font-medium">
															{config.displayName}
														</span>
														{embeddingSize === size && (
															<span className="ml-auto">✓</span>
														)}
													</div>
													<span className="text-xs text-muted-foreground">
														{config.description}
													</span>
												</DropdownMenuItem>
											);
										})}

										<DropdownMenuSeparator />

										{/* Theme Section */}
										<DropdownMenuLabel className="flex items-center gap-2">
											{getThemeIcon()}
											<span>{t("theme.label")}</span>
										</DropdownMenuLabel>
										<DropdownMenuItem
											onClick={() => setTheme("light")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<Sun size={14} />
											<span>{t("theme.light")}</span>
											{theme === "light" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => setTheme("dark")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<Moon size={14} />
											<span>{t("theme.dark")}</span>
											{theme === "dark" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => setTheme("system")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<Monitor size={14} />
											<span>{t("theme.system")}</span>
											{theme === "system" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>

										<DropdownMenuSeparator />

										{/* Logout (only when logged in) */}
										{user && (
											<DropdownMenuItem
												onClick={handleLogout}
												className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
											>
												<LogOut size={14} />
												<span>{t("auth:actions.signOut")}</span>
											</DropdownMenuItem>
										)}

										<div className="px-2 py-1.5 text-xs text-muted-foreground text-center">
											{t("common.version", { version: manifest.version })}
										</div>
									</DropdownMenuContent>
								</DropdownMenu>
							</TooltipProvider>
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
