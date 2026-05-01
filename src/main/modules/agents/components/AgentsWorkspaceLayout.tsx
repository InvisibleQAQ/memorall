import React from "react";
import { useTranslation } from "react-i18next";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/main/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DESKTOP_SEPARATOR_TRACK } from "../hooks/use-agents-workspace-panels";

type AgentsWorkspaceLayoutProps = {
	activeCompactTab: string;
	children: React.ReactNode;
	configSection: React.ReactNode;
	containerRef: React.RefObject<HTMLDivElement | null>;
	isDesktop: boolean;
	listSection: React.ReactNode;
	panelSizes: [number, number];
	onCompactTabChange: (value: string) => void;
	onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void;
};

export const AgentsWorkspaceLayout: React.FC<AgentsWorkspaceLayoutProps> = ({
	activeCompactTab,
	children,
	configSection,
	containerRef,
	isDesktop,
	listSection,
	panelSizes,
	onCompactTabChange,
	onResizeStart,
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
						className="grid h-full min-h-0 bg-background"
						style={{
							gridTemplateColumns: `${panelSizes[0]}fr ${DESKTOP_SEPARATOR_TRACK}px ${panelSizes[1]}fr`,
						}}
					>
						{listSection}
						<div
							role="separator"
							aria-orientation="vertical"
							className="group relative z-10 -mx-[5px] flex w-3 cursor-col-resize items-center justify-center bg-transparent"
							onMouseDown={onResizeStart}
						>
							<div className="h-full w-px bg-border/80 transition-all group-hover:w-[2px] group-hover:bg-foreground/20" />
						</div>
						{configSection}
					</div>
				) : (
					<Tabs
						value={activeCompactTab}
						onValueChange={onCompactTabChange}
						className="flex flex-col"
					>
						<div className="border-b bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
							<TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
								<TabsTrigger value="list" className="text-xs sm:text-sm">
									{t("list.title")}
								</TabsTrigger>
								<TabsTrigger value="config" className="text-xs sm:text-sm">
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
