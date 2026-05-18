import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";
import { useAgentConfigStore } from "@/main/stores/agent-config";
import { serviceManager } from "@/services";
import {
	VISUALIZE_RESPONSE_FEATURE_NAME,
	type OpenUITheme,
} from "@/services/flows/steps/features/visualize-response";

const THEMES: { value: OpenUITheme; labelKey: string }[] = [
	{ value: "shadcn", labelKey: "agentSettings.visualizeThemeShadcn" },
	{ value: "wireframe", labelKey: "agentSettings.visualizeThemeWireframe" },
	{ value: "glass", labelKey: "agentSettings.visualizeThemeGlass" },
];

export const VisualizeResponseFeatureConfig: React.FC = () => {
	const { t } = useTranslation("chat");
	const { savedUnifiedConfig, currentFlowId, initialize } =
		useAgentConfigStore();

	const currentTheme: OpenUITheme =
		(savedUnifiedConfig?.steps.find(
			(s) => s.name === VISUALIZE_RESPONSE_FEATURE_NAME,
		)?.config?.theme as OpenUITheme | undefined) ?? "shadcn";

	const [theme, setTheme] = useState<OpenUITheme>(currentTheme);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		setTheme(currentTheme);
	}, [currentTheme]);

	const handleChange = useCallback(
		async (value: OpenUITheme) => {
			setTheme(value);
			setIsSaving(true);
			try {
				const flowRef = currentFlowId
					? { flowId: currentFlowId }
					: ({ predefinedFlow: "foundation" } as const);
				const config =
					await serviceManager.flowBuilderService.getUnifiedFlowConfig(flowRef);
				const updated = {
					...config,
					steps: config.steps.map((step) =>
						step.name === VISUALIZE_RESPONSE_FEATURE_NAME
							? {
									...step,
									config: {
										...(step.config ?? {}),
										theme: value === "shadcn" ? undefined : value,
									},
								}
							: step,
					),
				};
				await serviceManager.flowBuilderService.saveUnifiedFlowConfig(
					flowRef,
					updated,
				);
				await initialize(currentFlowId);
			} finally {
				setIsSaving(false);
			}
		},
		[currentFlowId, initialize],
	);

	return (
		<div className="space-y-2">
			<Label className="text-xs font-medium">
				{t("agentSettings.visualizeThemeLabel")}
			</Label>
			<Select
				value={theme}
				onValueChange={(v) => void handleChange(v as OpenUITheme)}
				disabled={isSaving}
			>
				<SelectTrigger className="h-9">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{THEMES.map(({ value, labelKey }) => (
						<SelectItem key={value} value={value}>
							{t(labelKey)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<p className="text-[10px] text-muted-foreground">
				{t("agentSettings.visualizeThemeHint")}
			</p>
		</div>
	);
};
