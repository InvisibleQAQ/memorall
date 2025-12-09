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
					{t("transformer.webgpuInfo")}
				</div>
				<div className="text-xs text-muted-foreground">
					{t("transformer.description")}
				</div>
			</div>

			{/* Model Selection */}
			<div>
				<label className="text-xs text-muted-foreground">
					{t("transformer.selectModel")}
				</label>
				<Select value={model} onValueChange={setModel} disabled={loading}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder={t("transformer.selectModelPlaceholder")} />
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
						{t("transformer.selectedModel")}
					</div>
					<div className="text-xs text-muted-foreground break-all">{model}</div>
				</div>
			)}

			{/* Features */}
			<div className="space-y-2">
				<div className="text-xs font-medium">{t("transformer.features")}</div>
				<ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
					<li>{t("transformer.feature.webgpu")}</li>
					<li>{t("transformer.feature.onnx")}</li>
					<li>{t("transformer.feature.quantized")}</li>
					<li>{t("transformer.feature.latest")}</li>
				</ul>
			</div>
		</div>
	);
};
