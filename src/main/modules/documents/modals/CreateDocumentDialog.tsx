import { useState } from "react";
import { useTranslation } from "react-i18next";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import { FileText } from "lucide-react";

import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/main/components/ui/dialog";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import { Label } from "@/main/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/main/components/ui/select";

export interface CreateDocumentDialogResult {
	name: string;
	extension: string;
}

const EXTENSIONS: { ext: string; label: string }[] = [
	{ ext: ".md", label: "Markdown (.md)" },
	{ ext: ".txt", label: "Plain Text (.txt)" },
	{ ext: ".json", label: "JSON (.json)" },
	{ ext: ".yaml", label: "YAML (.yaml)" },
	{ ext: ".sh", label: "Shell (.sh)" },
	{ ext: ".py", label: "Python (.py)" },
	{ ext: ".js", label: "JavaScript (.js)" },
	{ ext: ".ts", label: "TypeScript (.ts)" },
	{ ext: ".html", label: "HTML (.html)" },
	{ ext: ".css", label: "CSS (.css)" },
	{ ext: ".sql", label: "SQL (.sql)" },
];

export const CreateDocumentDialog = NiceModal.create<object>(() => {
	const modal = useModal();
	const { t } = useTranslation("documents");

	const [documentName, setDocumentName] = useState("");
	const [extension, setExtension] = useState(".md");
	const [error, setError] = useState("");

	const handleCreate = () => {
		if (!documentName.trim()) {
			setError(t("create.nameRequired"));
			return;
		}

		const invalidChars = /[<>:"/\\|?*]/;
		if (invalidChars.test(documentName)) {
			setError(t("create.invalidCharacters"));
			return;
		}

		const result: CreateDocumentDialogResult = {
			name: documentName.trim(),
			extension,
		};

		modal.resolve(result);
		modal.hide();
	};

	const handleCancel = () => {
		modal.resolve(null);
		modal.hide();
	};

	return (
		<Dialog
			open={modal.visible}
			onOpenChange={(open) => !open && handleCancel()}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5" />
						{t("create.title")}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Name */}
					<div className="space-y-2">
						<Label htmlFor="document-name">{t("create.nameLabel")}</Label>
						<Input
							id="document-name"
							placeholder={t("create.namePlaceholder")}
							value={documentName}
							onChange={(e) => {
								setDocumentName(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => e.key === "Enter" && handleCreate()}
							autoFocus
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>

					{/* Extension */}
					<div className="space-y-2">
						<Label htmlFor="document-ext">{t("create.extensionLabel")}</Label>
						<Select value={extension} onValueChange={setExtension}>
							<SelectTrigger id="document-ext">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{EXTENSIONS.map(({ ext, label }) => (
									<SelectItem key={ext} value={ext}>
										{label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Preview */}
					<div className="text-sm text-muted-foreground">
						{t("create.filenamePreview")}{" "}
						<span className="font-medium">
							{documentName.trim() || t("create.unnamed")}
							{extension}
						</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						{t("create.cancel")}
					</Button>
					<Button onClick={handleCreate}>{t("create.create")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
