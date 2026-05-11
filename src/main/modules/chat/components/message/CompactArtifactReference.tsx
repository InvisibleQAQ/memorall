import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

export const CompactArtifactReference: React.FC<{
	type: string;
	title?: string;
	identifier?: string;
}> = ({ type, title, identifier }) => (
	<Link
		to="/runtime"
		className="my-2 inline-flex max-w-full items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
	>
		<FileText size={14} className="flex-shrink-0" />
		<span className="min-w-0 truncate">
			{title?.trim() || identifier?.trim() || `${type.toUpperCase()} artifact`}
		</span>
	</Link>
);
