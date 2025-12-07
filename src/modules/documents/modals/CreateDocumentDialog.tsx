/**
 * Create Document Dialog
 * Modal for creating new documents with type selection
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import NiceModal, { useModal } from "@ebay/nice-modal-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { FileText } from "lucide-react";
import { editorRegistry } from "../editors";
import type { DocumentType } from "@/types/document-library";

export interface CreateDocumentDialogResult {
	name: string;
	type: DocumentType;
	extension: string;
}

export const CreateDocumentDialog = NiceModal.create<object>(() => {
	const modal = useModal();
	const { t } = useTranslation("documents");

	const creatableEditors = editorRegistry.getCreatableEditors();
	const defaultEditor = creatableEditors[0];

	const [documentName, setDocumentName] = useState("");
	const [selectedType, setSelectedType] = useState<DocumentType>(
		defaultEditor?.type ?? "markdown",
	);
	const [error, setError] = useState<string>("");

	const handleCreate = () => {
		// Validate document name
		if (!documentName.trim()) {
			setError(
				t("create.nameRequired", { defaultValue: "Document name is required" }),
			);
			return;
		}

		// Check for invalid characters
		const invalidChars = /[<>:"/\\|?*]/;
		if (invalidChars.test(documentName)) {
			setError(
				t("create.invalidCharacters", {
					defaultValue: "Document name contains invalid characters",
				}),
			);
			return;
		}

		const selectedEditor = editorRegistry.getEditor(selectedType);
		if (!selectedEditor) {
			setError(
				t("create.invalidType", { defaultValue: "Invalid document type" }),
			);
			return;
		}

		const result: CreateDocumentDialogResult = {
			name: documentName.trim(),
			type: selectedType,
			extension: selectedEditor.defaultExtension,
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
						{t("create.title", { defaultValue: "Create New Document" })}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Document Name */}
					<div className="space-y-2">
						<Label htmlFor="document-name">
							{t("create.nameLabel", { defaultValue: "Document Name" })}
						</Label>
						<Input
							id="document-name"
							placeholder={t("create.namePlaceholder", {
								defaultValue: "My Document",
							})}
							value={documentName}
							onChange={(e) => {
								setDocumentName(e.target.value);
								setError("");
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									handleCreate();
								}
							}}
							autoFocus
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>

					{/* Document Type */}
					<div className="space-y-2">
						<Label htmlFor="document-type">
							{t("create.typeLabel", { defaultValue: "Document Type" })}
						</Label>
						<Select
							value={selectedType}
							onValueChange={(value) => setSelectedType(value as DocumentType)}
						>
							<SelectTrigger id="document-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{creatableEditors.map((editor) => (
									<SelectItem key={editor.type} value={editor.type}>
										{editor.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Preview of full name */}
					<div className="text-sm text-muted-foreground">
						{t("create.filenamePreview", { defaultValue: "File name:" })}{" "}
						<span className="font-medium">
							{documentName.trim() ||
								t("create.unnamed", { defaultValue: "Unnamed" })}
							{editorRegistry.getEditor(selectedType)?.defaultExtension}
						</span>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						{t("create.cancel", { defaultValue: "Cancel" })}
					</Button>
					<Button onClick={handleCreate}>
						{t("create.create", { defaultValue: "Create" })}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
});
