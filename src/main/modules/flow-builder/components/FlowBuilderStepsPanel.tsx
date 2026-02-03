import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/main/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { CatalogStep } from "@/services/flows/flow-builder-catalog";

interface FlowBuilderStepsPanelProps {
	steps: CatalogStep[];
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
}

export const FlowBuilderStepsPanel: React.FC<FlowBuilderStepsPanelProps> = ({
	steps,
	isOpen,
	onOpenChange,
}) => {
	const { t } = useTranslation();

	const handleDragStart = (event: React.DragEvent, stepId: string) => {
		event.dataTransfer.setData("application/flow-step", stepId);
	};

	const visibleSteps = steps.filter((step) => step.type !== "system");

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={onOpenChange}
			className={cn(
				"flow-panel border-r bg-background transition-[width] duration-300 ease-in-out h-full max-h-full min-h-0 flex flex-col",
				isOpen ? "w-64" : "w-12",
			)}
		>
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<span
					className={cn(
						"text-xs uppercase tracking-wide text-muted-foreground",
						!isOpen && "hidden",
					)}
				>
					{t("flowBuilder.panels.steps", { defaultValue: "Steps" })}
				</span>
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="icon">
						{isOpen ? (
							<ChevronLeft className="h-4 w-4" />
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</Button>
				</CollapsibleTrigger>
			</div>
			<CollapsibleContent className="flow-panel-content p-3 overflow-auto flex-1 min-h-0 max-h-full">
				<div className="space-y-2">
					{visibleSteps.map((step) => (
						<div
							key={step.id}
							className="border rounded-md px-2 py-2 text-sm bg-background cursor-grab active:cursor-grabbing"
							draggable
							onDragStart={(event) => handleDragStart(event, step.id)}
						>
							<div className="font-medium">{step.name}</div>
							<div className="text-xs text-muted-foreground">{step.type}</div>
						</div>
					))}
					{visibleSteps.length === 0 && (
						<p className="text-sm text-muted-foreground">
							{t("flowBuilder.noSteps", { defaultValue: "No steps available yet." })}
						</p>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
};
