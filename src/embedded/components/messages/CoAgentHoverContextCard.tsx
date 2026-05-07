import React from "react";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { getAnchorTextPreview } from "./utils";

export const CoAgentHoverContextCard: React.FC<{
	anchor: Record<string, unknown>;
}> = ({ anchor }) => {
	const t = useEmbeddedTranslation("coAgent");
	const label =
		(typeof anchor.ariaLabel === "string" && anchor.ariaLabel) ||
		(typeof anchor.placeholder === "string" && anchor.placeholder) ||
		(typeof anchor.tagName === "string" && anchor.tagName) ||
		t("hoverContextFallback");
	const selector =
		typeof anchor.selector === "string" && anchor.selector
			? anchor.selector
			: t("hoverContextNoSelector");
	const textPreview = getAnchorTextPreview(anchor);

	return (
		<div className="memorall-co-agent-hover-context">
			<div className="memorall-co-agent-hover-context-header">
				<span className="memorall-co-agent-hover-context-dot" />
				<span className="memorall-co-agent-hover-context-title">
					{t("hoverContext")}
				</span>
			</div>
			<div className="memorall-co-agent-hover-context-label">{label}</div>
			<div className="memorall-co-agent-hover-context-selector">{selector}</div>
			{textPreview ? (
				<div className="memorall-co-agent-hover-context-text">
					{textPreview.length > 420
						? `${textPreview.slice(0, 420)}...`
						: textPreview}
				</div>
			) : null}
		</div>
	);
};
