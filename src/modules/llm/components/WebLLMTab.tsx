import React from "react";
import { useTranslation } from "react-i18next";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface WebLLMTabProps {
	webllmModel: string;
	setWebllmModel: (model: string) => void;
	webllmAvailableModels: string[];
	loading: boolean;
}

export const WebLLMTab: React.FC<WebLLMTabProps> = ({
	webllmModel,
	setWebllmModel,
	webllmAvailableModels,
	loading,
}) => {
	const { t } = useTranslation("llm");
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-3">
				<div>
					<label className="text-xs text-muted-foreground">
						{t("webllm.model")}
					</label>
					<Select
						value={webllmModel}
						onValueChange={setWebllmModel}
						disabled={loading}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder={t("webllm.selectModel")} />
						</SelectTrigger>
						<SelectContent>
							{webllmAvailableModels.map((model) => (
								<SelectItem key={model} value={model}>
									{model}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
};
