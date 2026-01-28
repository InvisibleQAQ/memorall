import React from "react";
import { useTranslation } from "react-i18next";

interface LogsSectionProps {
	logs: string[];
}

export const LogsSection: React.FC<LogsSectionProps> = ({ logs }) => {
	const { t } = useTranslation("llm");
	return (
		<div className="mt-4">
			<div className="text-xs font-medium mb-1">{t("logs.title")}</div>
			<pre className="text-xs p-2 bg-muted rounded max-h-48 overflow-auto">
				{logs.join("\n")}
			</pre>
		</div>
	);
};
