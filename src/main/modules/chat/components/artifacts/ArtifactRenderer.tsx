import React from "react";
import { Globe, Code2 } from "lucide-react";
import type { ArtifactType } from "./artifact-protocol";

interface ArtifactProps {
	content: string;
	title?: string;
}

const ArtifactHeader: React.FC<{
	icon: React.ReactNode;
	label: string;
	title?: string;
}> = ({ icon, label, title }) => (
	<div className="flex items-center gap-2 border-b border-border px-3 py-1.5 bg-muted/30">
		<span className="text-muted-foreground">{icon}</span>
		<span className="text-xs text-muted-foreground">{title || label}</span>
	</div>
);

const HtmlArtifact: React.FC<ArtifactProps> = ({ content, title }) => (
	<div className="rounded-md overflow-hidden border border-border my-2">
		<ArtifactHeader
			icon={<Code2 size={13} />}
			label="HTML Preview"
			title={title}
		/>
		<iframe
			srcDoc={content}
			sandbox="allow-scripts allow-same-origin"
			className="w-full bg-white"
			style={{ height: "60vh", border: "none" }}
			title={title || "HTML Preview"}
		/>
	</div>
);

const UrlArtifact: React.FC<ArtifactProps> = ({ content, title }) => {
	const url = content.trim();
	return (
		<div className="rounded-md overflow-hidden border border-border my-2">
			<ArtifactHeader icon={<Globe size={13} />} label={url} title={title} />
			<iframe
				src={url}
				className="w-full bg-white"
				style={{ height: "60vh", border: "none" }}
				title={title || url}
			/>
		</div>
	);
};

interface ArtifactRendererProps {
	type: ArtifactType;
	content: string;
	title?: string;
}

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({
	type,
	content,
	title,
}) => {
	switch (type) {
		case "html":
			return <HtmlArtifact content={content} title={title} />;
		case "url":
			return <UrlArtifact content={content} title={title} />;
		default:
			return null;
	}
};
