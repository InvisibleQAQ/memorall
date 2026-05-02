import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/main/components/ui/button";

export const LegacyConfigWarning: React.FC<{
	isSaving: boolean;
	onConvertToUnified: () => void;
}> = ({ isSaving, onConvertToUnified }) => {
	const { t } = useTranslation(["chat", "agents", "common"]);

	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-4 text-sm text-amber-950">
			<div className="space-y-1">
				<p className="font-semibold">{t("agentSettings.legacyConfigTitle")}</p>
				<p className="text-xs leading-relaxed text-amber-900/80">
					{t("agentSettings.legacyConfigDescription")}
				</p>
			</div>
			<div>
				<Button
					type="button"
					size="sm"
					onClick={onConvertToUnified}
					disabled={isSaving}
				>
					{isSaving
						? t("agentSettings.converting")
						: t("agentSettings.convertToUnified")}
				</Button>
			</div>
		</div>
	);
};
