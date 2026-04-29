import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Code2, Save, Check } from "lucide-react";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import { logError } from "@/utils/logger";
import type { ArtifactType } from "./artifact-protocol";

interface ArtifactProps {
	content: string;
	title?: string;
}

type SaveState = "idle" | "saving" | "saved";

const toSafeFileName = (value?: string) => {
	const name = (value?.trim() || "artifact")
		.replace(/[^a-z0-9._-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	return name || "artifact";
};

const ArtifactHeader: React.FC<{
	icon: React.ReactNode;
	label: string;
	title?: string;
	actions?: React.ReactNode;
}> = ({ icon, label, title, actions }) => (
	<div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-muted/30">
		<div className="flex min-w-0 items-center gap-2">
			<span className="shrink-0 text-muted-foreground">{icon}</span>
			<span className="truncate text-xs text-muted-foreground">
				{title || label}
			</span>
		</div>
		{actions ? (
			<div className="flex shrink-0 items-center gap-1">{actions}</div>
		) : null}
	</div>
);

const HtmlArtifact: React.FC<ArtifactProps> = ({ content, title }) => {
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const { t } = useTranslation("chat");

	const handleSave = async () => {
		if (saveState !== "idle") return;
		setSaveState("saving");

		try {
			const fileName = `${toSafeFileName(title)}-${Date.now()}.html`;
			const file = new File([content], fileName, { type: "text/html" });
			await documentFileSystemService.uploadFile(file, "/");
			setSaveState("saved");
			setTimeout(() => setSaveState("idle"), 2000);
		} catch (err) {
			logError("Failed to save artifact HTML to documents:", err);
			setSaveState("idle");
		}
	};

	return (
		<div className="rounded-md overflow-hidden border border-border my-2">
			<ArtifactHeader
				icon={<Code2 size={13} />}
				label={t("htmlPreview.label")}
				title={title}
				actions={
					<button
						type="button"
						onClick={handleSave}
						disabled={saveState !== "idle"}
						className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/50 disabled:opacity-60"
					>
						{saveState === "saved" ? (
							<>
								<Check className="w-3 h-3" /> {t("htmlPreview.saved")}
							</>
						) : (
							<>
								<Save className="w-3 h-3" />{" "}
								{saveState === "saving"
									? t("htmlPreview.saving")
									: t("htmlPreview.save")}
							</>
						)}
					</button>
				}
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
};

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
