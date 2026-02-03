import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Settings2, Play } from "lucide-react";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import { Textarea } from "@/main/components/ui/textarea";
import { Switch } from "@/main/components/ui/switch";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/main/components/ui/tabs";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/main/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { FlowStateInput, FlowCatalog } from "@/services/flows/interfaces/flow-builder";
import type { CatalogStep } from "@/services/flows/flow-builder-catalog";

const STATE_TYPES = [
	"string",
	"number",
	"boolean",
	"object",
	"array<object>",
] as const;

type StateType = (typeof STATE_TYPES)[number];

const buildZodMetadata = (type: StateType) => {
	switch (type) {
		case "string":
		case "number":
		case "boolean":
		case "object":
			return { zod: { type } };
		case "array<object>":
			return { zod: { type: "array", element: { type: "object" } } };
		default:
			return { zod: { type: "string" } };
	}
};

const readTypeFromMetadata = (state: FlowStateInput) => {
	const metadata = state.metadata as
		| { zod?: { type?: string; element?: { type?: string } } }
		| undefined;
	if (metadata?.zod?.type === "array") {
		const elementType = metadata.zod.element?.type ?? "object";
		return `array<${elementType}>`;
	}
	return metadata?.zod?.type ?? state.type;
};

interface FlowBuilderInspectorProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	flowName: string;
	flowDescription: string;
	flowStatus: string;
	serviceKeys: string[];
	flowStates: FlowStateInput[];
	catalog: FlowCatalog;
	selectedNodeId: string | null;
	error: string | null;
	isLoading: boolean;
	onFlowMetaChange: (meta: {
		name?: string;
		description?: string;
		status?: string;
		serviceKeys?: string[];
	}) => void;
	onAddStateField: (state: FlowStateInput) => void;
	onRemoveStateField: (name: string) => void;
}

export const FlowBuilderInspector: React.FC<FlowBuilderInspectorProps> = ({
	isOpen,
	onOpenChange,
	flowName,
	flowDescription,
	flowStatus,
	serviceKeys,
	flowStates,
	catalog,
	selectedNodeId,
	error,
	isLoading,
	onFlowMetaChange,
	onAddStateField,
	onRemoveStateField,
}) => {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = React.useState("properties");
	const [newStateName, setNewStateName] = React.useState("");
	const [newStateType, setNewStateType] = React.useState<StateType>("string");

	const handleServiceToggle = (serviceKey: string) => {
		const next = serviceKeys.includes(serviceKey)
			? serviceKeys.filter((key) => key !== serviceKey)
			: [...serviceKeys, serviceKey];
		onFlowMetaChange({ serviceKeys: next });
	};

	const handleAddState = () => {
		if (!newStateName.trim()) return;
		const trimmedName = newStateName.trim();
		onAddStateField({
			name: trimmedName,
			type: newStateType,
			metadata: buildZodMetadata(newStateType),
		});
		setNewStateName("");
		setNewStateType("string");
	};

	const selectedStep: CatalogStep | undefined =
		selectedNodeId
			? catalog.steps.find((step) => step.id === selectedNodeId)
			: undefined;

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={onOpenChange}
			className={cn(
				"flow-panel border-l bg-background transition-[width] duration-300 ease-in-out h-full max-h-full min-h-0 flex flex-col",
				isOpen ? "w-80" : "w-12",
			)}
		>
			<div className="flex items-center justify-between px-3 py-2 border-b">
				<span
					className={cn(
						"text-xs uppercase tracking-wide text-muted-foreground",
						!isOpen && "hidden",
					)}
				>
					{t("flowBuilder.panels.inspector", { defaultValue: "Inspector" })}
				</span>
				<CollapsibleTrigger asChild>
					<Button variant="ghost" size="icon">
						{isOpen ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronLeft className="h-4 w-4" />
						)}
					</Button>
				</CollapsibleTrigger>
			</div>
			<CollapsibleContent className="flow-panel-content p-4 overflow-auto flex-1 min-h-0 max-h-full space-y-4">
				{error && (
					<div className="text-sm text-destructive border border-destructive/30 rounded-md p-2">
						{error}
					</div>
				)}

				<Tabs value={activeTab} onValueChange={setActiveTab}>
					<TabsList className="grid grid-cols-2">
						<TabsTrigger value="properties">
							<Settings2 className="h-4 w-4 mr-1" />
							{t("flowBuilder.tabs.properties", { defaultValue: "Properties" })}
						</TabsTrigger>
						<TabsTrigger value="testing">
							<Play className="h-4 w-4 mr-1" />
							{t("flowBuilder.tabs.testing", { defaultValue: "Testing" })}
						</TabsTrigger>
					</TabsList>

					<TabsContent value="properties" className="space-y-6 pt-4">
						{/* Flow Details */}
						<div className="space-y-3">
							<div className="text-xs uppercase tracking-wide text-muted-foreground">
								{t("flowBuilder.sections.flowDetails", { defaultValue: "Flow Details" })}
							</div>
							<Input
								value={flowName}
								placeholder={t("flowBuilder.placeholders.flowName", {
									defaultValue: "Flow name",
								})}
								onChange={(event) => onFlowMetaChange({ name: event.target.value })}
							/>
							<Textarea
								value={flowDescription}
								placeholder={t("flowBuilder.placeholders.description", {
									defaultValue: "Description",
								})}
								rows={3}
								onChange={(event) =>
									onFlowMetaChange({ description: event.target.value })
								}
							/>
							<Input
								value={flowStatus}
								placeholder={t("flowBuilder.placeholders.status", {
									defaultValue: "Status",
								})}
								onChange={(event) => onFlowMetaChange({ status: event.target.value })}
							/>
						</div>

						{/* Services */}
						<div className="space-y-3">
							<div className="text-xs uppercase tracking-wide text-muted-foreground">
								{t("flowBuilder.sections.services", { defaultValue: "Services" })}
							</div>
							<div className="space-y-2">
								{catalog.services.map((service) => (
									<div
										key={service.id}
										className="flex items-center justify-between rounded-md border px-2 py-2 text-sm"
									>
										<Label className="text-sm">{service.name}</Label>
										<Switch
											checked={serviceKeys.includes(service.serviceKey)}
											onCheckedChange={() => handleServiceToggle(service.serviceKey)}
										/>
									</div>
								))}
								{catalog.services.length === 0 && (
									<p className="text-sm text-muted-foreground">
										{t("flowBuilder.noServices", {
											defaultValue: "No services cataloged yet.",
										})}
									</p>
								)}
							</div>
						</div>

						{/* State Fields */}
						<div className="space-y-3">
							<div className="text-xs uppercase tracking-wide text-muted-foreground">
								{t("flowBuilder.sections.stateFields", { defaultValue: "State Fields" })}
							</div>
							<div className="space-y-2">
								{flowStates.map((state) => (
									<div
										key={state.name}
										className="border rounded-md px-2 py-2 text-sm flex items-center justify-between"
									>
										<div>
											<div className="font-medium">{state.name}</div>
											<div className="text-xs text-muted-foreground">
												{readTypeFromMetadata(state)}
											</div>
										</div>
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive"
											onClick={() => onRemoveStateField(state.name)}
										>
											{t("buttons.delete", { defaultValue: "Delete" })}
										</Button>
									</div>
								))}
								{flowStates.length === 0 && (
									<p className="text-sm text-muted-foreground">
										{t("flowBuilder.noStateFields", {
											defaultValue: "No state fields yet.",
										})}
									</p>
								)}
							</div>
							<div className="grid grid-cols-[1fr_140px_auto] gap-2">
								<Input
									placeholder={t("flowBuilder.placeholders.stateName", {
										defaultValue: "State name",
									})}
									value={newStateName}
									onChange={(event) => setNewStateName(event.target.value)}
								/>
								<Select
									value={newStateType}
									onValueChange={(value) => setNewStateType(value as StateType)}
								>
									<SelectTrigger>
										<SelectValue
											placeholder={t("flowBuilder.placeholders.type", {
												defaultValue: "Type",
											})}
										/>
									</SelectTrigger>
									<SelectContent>
										{STATE_TYPES.map((type) => (
											<SelectItem key={type} value={type}>
												{type}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button variant="outline" onClick={handleAddState}>
									{t("buttons.add", { defaultValue: "Add" })}
								</Button>
							</div>
						</div>

						{/* Step Properties */}
						<div className="space-y-3">
							<div className="text-xs uppercase tracking-wide text-muted-foreground">
								{t("flowBuilder.sections.stepProperties", {
									defaultValue: "Step Properties",
								})}
							</div>
							{selectedStep ? (
								<div className="rounded-md border p-3 text-sm space-y-2">
									<div className="font-semibold">{selectedStep.name}</div>
									<div className="text-xs text-muted-foreground">
										{t("flowBuilder.labels.type", { defaultValue: "Type" })}:{" "}
										{selectedStep.type}
									</div>
									{typeof selectedStep.metadata?.description === "string" && (
									<div className="text-xs text-muted-foreground">
										{selectedStep.metadata.description}
									</div>
								)}
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									{t("flowBuilder.selectNodeForProperties", {
										defaultValue: "Select a node to see step properties.",
									})}
								</p>
							)}
						</div>
					</TabsContent>

					<TabsContent value="testing" className="pt-4">
						<div className="rounded-md border p-3 text-sm text-muted-foreground">
							{t("flowBuilder.testingPlaceholder", {
								defaultValue: "Testing harness will appear here.",
							})}
						</div>
					</TabsContent>
				</Tabs>

				<div className="text-xs text-muted-foreground">
					{isLoading
						? t("status.loading", { defaultValue: "Loading..." })
						: t("flowBuilder.ready", { defaultValue: "Ready" })}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
};
