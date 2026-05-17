import React from "react";
import { useTranslation } from "react-i18next";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/main/components/ui/tabs";
import { Button } from "@/main/components/ui/button";
import { Bot, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentsWorkspaceLayoutProps = {
	activeCompactTab: string;
	children: React.ReactNode;
	configSection: React.ReactNode;
	containerRef: React.RefObject<HTMLDivElement | null>;
	gridTemplateColumns: string;
	isCompactSplitLayout: boolean;
	isDesktop: boolean;
	isSidebarCollapsed: boolean;
	listSection: React.ReactNode;
	onCollapseSidebar: () => void;
	onCompactTabChange: (value: string) => void;
	onExpandSidebar: () => void;
	onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
	sidebarOverlayWidth: string;
};

export const AgentsWorkspaceLayout: React.FC<AgentsWorkspaceLayoutProps> = ({
	activeCompactTab,
	children,
	configSection,
	containerRef,
	gridTemplateColumns,
	isCompactSplitLayout,
	isDesktop,
	isSidebarCollapsed,
	listSection,
	onCollapseSidebar,
	onCompactTabChange,
	onExpandSidebar,
	onResizeStart,
	sidebarOverlayWidth,
}) => {
	const { t } = useTranslation(["agents"]);

	return (
		<div
			className={cn(
				"flex flex-col bg-background",
				isDesktop ? "h-full min-h-0" : "min-h-full",
			)}
		>
			<div
				className={cn(isDesktop ? "flex-1 min-h-0 overflow-hidden" : "pb-4")}
			>
				{isDesktop ? (
					<div
						ref={containerRef}
						className="relative grid h-full min-h-0 bg-background"
						style={{
							gridTemplateColumns,
						}}
					>
						{isSidebarCollapsed ? (
							<aside className="flex min-h-0 flex-col items-center gap-2 overflow-hidden border-r bg-background py-3">
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-9 w-9"
									onClick={onExpandSidebar}
									aria-label="Show agents sidebar"
									title="Show sidebar"
								>
									<PanelLeftOpen className="h-4 w-4" />
								</Button>
								<div className="mt-2 flex flex-col gap-2 text-muted-foreground">
									<Bot className="h-5 w-5" />
									<Sparkles className="h-5 w-5" />
								</div>
							</aside>
						) : (
							<div
								className={cn(
									"relative z-20 min-h-0 border-r bg-background",
									isCompactSplitLayout ? "overflow-visible" : "overflow-hidden",
								)}
							>
								<div
									className={cn(
										"min-h-0 overflow-hidden bg-background",
										isCompactSplitLayout
											? "absolute left-0 top-0 flex h-full flex-col border-r shadow-2xl"
											: "h-full",
									)}
									style={
										isCompactSplitLayout
											? { width: sidebarOverlayWidth }
											: undefined
									}
								>
									{isCompactSplitLayout ? (
										<div className="flex h-10 shrink-0 items-center justify-end border-b px-2">
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-8 w-8"
												onClick={onCollapseSidebar}
												aria-label="Hide agents sidebar"
												title="Hide sidebar"
											>
												<PanelLeftClose className="h-4 w-4" />
											</Button>
										</div>
									) : (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute right-2 top-3 z-20 h-8 w-8"
											onClick={onCollapseSidebar}
											aria-label="Hide agents sidebar"
											title="Hide sidebar"
										>
											<PanelLeftClose className="h-4 w-4" />
										</Button>
									)}
									<div className="min-h-0 flex-1 overflow-hidden">
										{listSection}
									</div>
								</div>
							</div>
						)}
						<div
							role="separator"
							aria-orientation="vertical"
							className={cn(
								"group relative z-10 -mx-[5px] w-3 cursor-col-resize items-center justify-center bg-transparent",
								isSidebarCollapsed || isCompactSplitLayout ? "hidden" : "flex",
							)}
							onMouseDown={onResizeStart}
						>
							<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
						</div>
						<div className="min-w-0 overflow-hidden">{configSection}</div>
					</div>
				) : (
					<Tabs
						value={activeCompactTab}
						onValueChange={onCompactTabChange}
						className="flex flex-col"
					>
						<div className="border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
							<TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
								<TabsTrigger
									value="list"
									className="h-full rounded-lg text-xs sm:text-sm"
								>
									{t("list.title")}
								</TabsTrigger>
								<TabsTrigger
									value="config"
									className="h-full rounded-lg text-xs sm:text-sm"
								>
									{t("config.title")}
								</TabsTrigger>
							</TabsList>
						</div>
						<TabsContent value="list" className="mt-0">
							{listSection}
						</TabsContent>
						<TabsContent value="config" className="mt-0">
							{configSection}
						</TabsContent>
					</Tabs>
				)}
			</div>
			{children}
		</div>
	);
};
