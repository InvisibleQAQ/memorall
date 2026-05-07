import React from "react";
import { EmbeddedMarkdown } from "@/embedded/components/EmbeddedMarkdown";
import { parseArtifactSegments } from "@/main/modules/chat/components/artifacts/artifact-protocol";
import { EmbeddedArtifact } from "./EmbeddedArtifact";

export const AssistantMessageContent: React.FC<{
	content: string;
	isStreaming: boolean;
}> = ({ content, isStreaming }) => {
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
