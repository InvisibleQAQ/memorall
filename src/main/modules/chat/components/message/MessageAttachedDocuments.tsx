import React from "react";
import { File, FileText } from "lucide-react";
import type { AttachedDocumentRef } from "@/types/chat";

export const MessageAttachedDocuments: React.FC<{
	documents: AttachedDocumentRef[];
}> = ({ documents }) => {
	if (documents.length === 0) return null;

	return (
		<div className="mb-2 flex flex-wrap gap-2">
			{documents.map((doc, index) => (
				<div
					key={`${doc.path}-${index}`}
					className="inline-flex max-w-60 items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-1.5 text-xs"
					title={doc.path}
				>
					<span className="shrink-0 text-muted-foreground">
						{doc.docType === "pdf" ? (
							<File size={14} />
						) : (
							<FileText size={14} />
						)}
					</span>
					<span className="truncate text-foreground">{doc.name}</span>
				</div>
			))}
		</div>
	);
};
