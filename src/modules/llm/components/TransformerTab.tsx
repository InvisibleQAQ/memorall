import React from "react";
import { useTranslation } from "react-i18next";
import { RECOMMENDATION_TRANSFORMER_MODELS } from "@/constants/transformer";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface TransformerTabProps {
	model: string;
	setModel: (model: string) => void;
	loading: boolean;
}

export const TransformerTab: React.FC<TransformerTabProps> = ({
	model,
	setModel,
	loading,
}) => {
	const { t } = useTranslation("llm");
	return (
		<div className="space-y-4">
			{/* Info Section */}
			<div className="p-3 border rounded-lg bg-muted/20 space-y-2">
				<div className="text-sm font-medium">
					{t("transformer.webgpuInfo", {
						defaultValue: "WebGPU Transformer Models",
					})}
				</div>
				<div className="text-xs text-muted-foreground">
					{t("transformer.description", {
						defaultValue:
							"Run the latest LLM models (LFM2, Gemma 3, Phi 4) directly in your browser using WebGPU acceleration. These models use ONNX format for optimal performance.",
					})}
				</div>
			</div>

			{/* Model Selection */}
			<div>
				<label className="text-xs text-muted-foreground">
					{t("transformer.selectModel", { defaultValue: "Select Model" })}
				</label>
				<Select value={model} onValueChange={setModel} disabled={loading}>
					<SelectTrigger className="w-full">
						<SelectValue
							placeholder={t("transformer.selectModelPlaceholder", {
								defaultValue: "Choose a WebGPU model",
							})}
						/>
					</SelectTrigger>
					<SelectContent>
						{RECOMMENDATION_TRANSFORMER_MODELS.map((modelId) => {
							// Extract display name
							const displayName = modelId
								.replace("onnx-community/", "")
								.replace("-ONNX", "")
								.replace("-Instruct", "");

							return (
								<SelectItem key={modelId} value={modelId}>
									{displayName}
								</SelectItem>
							);
						})}
					</SelectContent>
				</Select>
			</div>

			{/* Model Info */}
			{model && (
				<div className="p-3 border rounded-lg bg-muted/10">
					<div className="text-xs font-medium mb-1">
						{t("transformer.selectedModel", { defaultValue: "Selected Model" })}
					</div>
					<div className="text-xs text-muted-foreground break-all">{model}</div>
				</div>
			)}

			{/* Features */}
			<div className="space-y-2">
				<div className="text-xs font-medium">
					{t("transformer.features", { defaultValue: "Features" })}
				</div>
				<ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
					<li>
						{t("transformer.feature.webgpu", {
							defaultValue: "WebGPU acceleration for fast inference",
						})}
					</li>
					<li>
						{t("transformer.feature.onnx", {
							defaultValue: "ONNX Runtime for optimal performance",
						})}
					</li>
					<li>
						{t("transformer.feature.quantized", {
							defaultValue: "Quantized models for smaller downloads",
						})}
					</li>
					<li>
						{t("transformer.feature.latest", {
							defaultValue: "Latest LFM2, Gemma 3, and Phi 4 models",
						})}
					</li>
				</ul>
			</div>
		</div>
	);
};
