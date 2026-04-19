import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sendMessageToBackground } from "../messaging";
import type { EmbeddedContextItem } from "../types";

interface FolderPickerTexts {
	smartSelectStoreToDocument: string;
	saveFolder: string;
	saveFileName: string;
	saveToDocuments: string;
	savingToDocuments: string;
	smartSelectCancel: string;
}

interface FolderPickerOverlayProps {
	item: EmbeddedContextItem;
	texts: FolderPickerTexts;
	onDone: () => void;
	onCancel: () => void;
}

const FOLDER_PICKER_CONTAINER_ID = "memorall-folder-picker-container";

function inferFileMeta(item: EmbeddedContextItem): {
	fileName: string;
	mimeType: string;
} {
	const slug = `smart-select-${Date.now()}`;
	if (item.kind === "smart_clean_html" || item.kind === "smart_html") {
		return { fileName: `${slug}.html`, mimeType: "text/html" };
	}
	return { fileName: `${slug}.txt`, mimeType: "text/plain" };
}

const FolderPickerOverlay: React.FC<FolderPickerOverlayProps> = ({
	item,
	texts,
	onDone,
	onCancel,
}) => {
	const [folders, setFolders] = useState<string[]>([]);
	const [selectedFolder, setSelectedFolder] = useState("/");
	const [fileName, setFileName] = useState(() => inferFileMeta(item).fileName);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	useEffect(() => {
		let isMounted = true;
		void sendMessageToBackground<{
			success: boolean;
			folders?: string[];
		}>({ type: "GET_DOCUMENT_FOLDERS" })
			.then((response) => {
				if (!isMounted) return;
				const list =
					response.success && Array.isArray(response.folders)
						? response.folders
						: ["/"];
				setFolders(list);
				setSelectedFolder(list[0] ?? "/");
			})
			.catch(() => {
				if (!isMounted) return;
				setFolders(["/"]);
				setSelectedFolder("/");
			});
		return () => {
			isMounted = false;
		};
	}, []);

	const handleSave = useCallback(async () => {
		if (!fileName.trim()) return;
		setSaving(true);
		setError(null);

		const { mimeType } = inferFileMeta(item);
		try {
			const response = await sendMessageToBackground<{
				success: boolean;
				error?: string;
			}>({
				type: "SAVE_EMBEDDED_CONTEXT_PREVIEW",
				folderPath: selectedFolder,
				fileName: fileName.trim(),
				mimeType,
				content: item.content,
			});

			if (response.success) {
				setSuccess(true);
				setTimeout(() => onDone(), 900);
			} else {
				setError(response.error ?? "Failed to save");
				setSaving(false);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
			setSaving(false);
		}
	}, [fileName, item, onDone, selectedFolder]);

	return (
		<div
			id="memorall-folder-picker-overlay"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2147483647,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "rgba(0,0,0,0.35)",
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			<div
				style={{
					width: 320,
					backgroundColor: "#fff",
					borderRadius: "14px",
					boxShadow: "0 20px 56px rgba(15, 23, 42, 0.35)",
					padding: "18px",
					color: "#111827",
				}}
			>
				<div
					style={{
						fontSize: "14px",
						fontWeight: 700,
						marginBottom: "14px",
						color: "#0f172a",
					}}
				>
					{texts.smartSelectStoreToDocument}
				</div>

				<div style={{ marginBottom: "10px" }}>
					<label
						style={{
							display: "block",
							fontSize: "11px",
							fontWeight: 600,
							color: "#64748b",
							marginBottom: "4px",
						}}
					>
						{texts.saveFolder}
					</label>
					<select
						value={selectedFolder}
						onChange={(e) => setSelectedFolder(e.target.value)}
						disabled={saving || success}
						style={{
							width: "100%",
							padding: "7px 10px",
							border: "1px solid #cbd5e1",
							borderRadius: "8px",
							fontSize: "13px",
							color: "#0f172a",
							backgroundColor: "#f8fafc",
							outline: "none",
						}}
					>
						{folders.map((f) => (
							<option key={f} value={f}>
								{f}
							</option>
						))}
					</select>
				</div>

				<div style={{ marginBottom: "14px" }}>
					<label
						style={{
							display: "block",
							fontSize: "11px",
							fontWeight: 600,
							color: "#64748b",
							marginBottom: "4px",
						}}
					>
						{texts.saveFileName}
					</label>
					<input
						type="text"
						value={fileName}
						onChange={(e) => setFileName(e.target.value)}
						disabled={saving || success}
						style={{
							width: "100%",
							padding: "7px 10px",
							border: "1px solid #cbd5e1",
							borderRadius: "8px",
							fontSize: "13px",
							color: "#0f172a",
							backgroundColor: "#f8fafc",
							outline: "none",
							boxSizing: "border-box",
						}}
					/>
				</div>

				{error && (
					<div
						style={{
							fontSize: "12px",
							color: "#dc2626",
							marginBottom: "10px",
						}}
					>
						{error}
					</div>
				)}

				{success && (
					<div
						style={{
							fontSize: "12px",
							color: "#16a34a",
							marginBottom: "10px",
						}}
					>
						Saved!
					</div>
				)}

				<div style={{ display: "flex", gap: "8px" }}>
					<button
						type="button"
						onClick={handleSave}
						disabled={saving || success || !fileName.trim()}
						style={{
							flex: 1,
							border: "none",
							borderRadius: "8px",
							backgroundColor: saving || success ? "#93c5fd" : "#2563eb",
							color: "#fff",
							padding: "9px 12px",
							fontSize: "13px",
							fontWeight: 600,
							cursor: saving || success ? "default" : "pointer",
						}}
					>
						{saving || success
							? texts.savingToDocuments
							: texts.saveToDocuments}
					</button>
					<button
						type="button"
						onClick={onCancel}
						disabled={saving || success}
						style={{
							flex: 1,
							border: "none",
							borderRadius: "8px",
							backgroundColor: "#fee2e2",
							color: "#991b1b",
							padding: "9px 12px",
							fontSize: "13px",
							fontWeight: 600,
							cursor: saving || success ? "default" : "pointer",
						}}
					>
						{texts.smartSelectCancel}
					</button>
				</div>
			</div>
		</div>
	);
};

export function createFolderPickerOverlay(
	item: EmbeddedContextItem,
	texts: FolderPickerTexts,
	onDone: () => void,
	onCancel: () => void,
): () => void {
	const existing = document.getElementById(FOLDER_PICKER_CONTAINER_ID);
	existing?.remove();

	const container = document.createElement("div");
	container.id = FOLDER_PICKER_CONTAINER_ID;
	document.body.appendChild(container);

	const root = createRoot(container);
	const cleanup = () => {
		root.unmount();
		container.remove();
	};

	root.render(
		<FolderPickerOverlay
			item={item}
			texts={texts}
			onDone={() => {
				cleanup();
				onDone();
			}}
			onCancel={() => {
				cleanup();
				onCancel();
			}}
		/>,
	);

	return cleanup;
}
