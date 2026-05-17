import React from "react";
import { EmbeddedMarkdown } from "@/embedded/components/EmbeddedMarkdown";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { parseArtifactSegments } from "@/main/modules/chat/components/artifacts/artifact-protocol";
import { EmbeddedArtifact } from "./EmbeddedArtifact";
import { openStandalonePage } from "@/utils/open-standalone";
import { isOpenUILang } from "@/utils/openui";

export const AssistantMessageContent: React.FC<{
	content: string;
	isStreaming: boolean;
}> = ({ content, isStreaming }) => {
	const t = useEmbeddedTranslation("messageContent");

	if (isOpenUILang(content)) {
		return (
			<div className="memorall-openui-notice">
				<span className="memorall-openui-notice__icon">+</span>
				<span className="memorall-openui-notice__text">
					{t("openUINotice")}
				</span>
				<button
					type="button"
					className="memorall-openui-notice__button"
					onClick={() => void openStandalonePage()}
				>
					{t("openFullView")}
				</button>
			</div>
		);
	}

	const segments = parseArtifactSegments(content);

	return (
		<div className="memorall-assistant-content">
			{segments.map((segment, index) =>
				segment.kind === "artifact" ? (
					<EmbeddedArtifact
						key={`artifact-${segment.identifier ?? index}`}
						segment={segment}
					/>
				) : segment.text.trim() ? (
					<EmbeddedMarkdown
						key={`text-${index}`}
						content={segment.text}
						isStreaming={isStreaming}
					/>
				) : null,
			)}
		</div>
	);
};
