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
	Sun,
	Moon,
	Monitor,
	FileText,
	Languages,
	Settings,
} from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/components/molecules/ThemeContext";
import { useLanguage } from "@/i18n/hooks/useLanguage";
import { useTranslation } from "react-i18next";
import { CopilotTrigger } from "@/components/atoms/copilot";
import { ProcessMonitor } from "@/components/molecules/ProcessMonitor";

interface LayoutProps {
	children: React.ReactNode;
}

const navigation = [
	{ nameKey: "navigation.chat", path: "/", icon: MessageCircle },
	{ nameKey: "navigation.models", path: "/llm", icon: Bot },
	{
		nameKey: "navigation.knowledgeGraph",
		path: "/knowledge-graph",
		icon: Network,
	},
	{ nameKey: "navigation.documents", path: "/documents", icon: FileText },
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
	const { theme, setTheme, actualTheme } = useTheme();
	const { language, changeLanguage } = useLanguage();
	const { t } = useTranslation();

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
								<DropdownMenu>
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
										{/* Language Section */}
										<DropdownMenuLabel className="flex items-center gap-2">
											<Languages size={14} />
											<span>{t("language.label")}</span>
										</DropdownMenuLabel>
										<DropdownMenuItem
											onClick={() => changeLanguage("en")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<span>🇬🇧</span>
											<span>{t("language.english")}</span>
											{language === "en" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => changeLanguage("vn")}
											className="flex items-center gap-2 cursor-pointer"
										>
											<span>🇻🇳</span>
											<span>{t("language.vietnamese")}</span>
											{language === "vn" && <span className="ml-auto">✓</span>}
										</DropdownMenuItem>

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
									</DropdownMenuContent>
								</DropdownMenu>
							</TooltipProvider>
						</div>
					</div>
				</div>
			</nav>

			<main className="flex-1 min-h-0 overflow-auto">{children}</main>
		</div>
	);
};
