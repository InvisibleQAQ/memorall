import React, { lazy, useMemo } from "react";
import { ArtifactRenderer } from "../artifacts/ArtifactRenderer";
import { parseArtifactSegments } from "../artifacts/artifact-protocol";
import { CompactArtifactReference } from "./CompactArtifactReference";
import { OpenUIRenderer } from "@/main/modules/openui/OpenUIRenderer";
import { isOpenUILang } from "@/utils/openui";

const USE_STREAMDOWN = false;
const Streamdown = lazy(() => import("../MessageStreamDown"));
const MarkdownMessage = lazy(() => import("../MarkdownMessage"));
const ContentComponent = USE_STREAMDOWN ? Streamdown : MarkdownMessage;

export const MessageContentWithArtifacts: React.FC<{
	content: string;
	isStreaming: boolean;
	suppressArtifactPreviews?: boolean;
}> = ({ content, isStreaming, suppressArtifactPreviews = false }) => {
	const segments = useMemo(() => parseArtifactSegments(content), [content]);

	if (isOpenUILang(content)) {
		return <OpenUIRenderer content={content} streaming={isStreaming} />;
	}

	return (
		<>
			{segments.map((seg, i) => {
				if (seg.kind === "artifact") {
					if (suppressArtifactPreviews) {
						return (
							<CompactArtifactReference
								key={i}
								type={seg.type}
								title={seg.title}
								identifier={seg.identifier}
							/>
						);
					}

					return (
						<ArtifactRenderer
							key={i}
							type={seg.type}
							content={seg.content}
							identifier={seg.identifier}
							title={seg.title}
						/>
					);
				}
				const text = seg.text;
				if (!text.trim()) return null;
				return (
					<ContentComponent key={i} isStreaming={isStreaming}>
						{text}
					</ContentComponent>
				);
			})}
		</>
	);
};
