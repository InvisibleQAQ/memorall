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

export interface CreateDocumentDialogResult {
	name: string;
	extension: string;
}

export const CreateDocumentDialog = NiceModal.create<object>(() => {
	const modal = useModal();
	const { t } = useTranslation("documents");

	const [documentName, setDocumentName] = useState("");
	const [rawExt, setRawExt] = useState("md");
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

		const trimmedExt = rawExt.trim();
		if (!trimmedExt) {
			setError(t("create.extensionRequired"));
			return;
		}

		const extension = trimmedExt.startsWith(".")
			? trimmedExt
			: `.${trimmedExt}`;

		modal.resolve({
			name: documentName.trim(),
			extension,
		} satisfies CreateDocumentDialogResult);
		modal.hide();
	};

	const handleCancel = () => {
		modal.resolve(null);
		modal.hide();
	};

	const previewExt = rawExt.trim()
		? rawExt.trim().startsWith(".")
			? rawExt.trim()
			: `.${rawExt.trim()}`
		: "";

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
						<div className="flex items-center">
							<span className="inline-flex items-center px-3 h-9 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground select-none">
								.
							</span>
							<Input
								id="document-ext"
								className="rounded-l-none"
								placeholder="md"
								value={rawExt}
								onChange={(e) => {
									// Strip any leading dots the user might type
									setRawExt(e.target.value.replace(/^\.+/, ""));
									setError("");
								}}
								onKeyDown={(e) => e.key === "Enter" && handleCreate()}
							/>
						</div>
					</div>

					{/* Preview */}
					<div className="text-sm text-muted-foreground">
						{t("create.filenamePreview")}{" "}
						<span className="font-medium font-mono">
							{documentName.trim() || t("create.unnamed")}
							{previewExt}
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
