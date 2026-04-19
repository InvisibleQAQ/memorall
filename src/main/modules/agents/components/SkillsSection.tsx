import React, { useCallback, useEffect, useState } from "react";
import {
	BookOpen,
	ChevronRight,
	Github,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import {
	skillFileSystemService,
	type SkillSummary,
} from "@/services/filesystem/skill-filesystem";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import { Label } from "@/main/components/ui/label";
import { Textarea } from "@/main/components/ui/textarea";
import { Badge } from "@/main/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/main/components/ui/alert-dialog";

// ---------------------------------------------------------------------------
// Skill editor dialog
// ---------------------------------------------------------------------------

interface SkillEditorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Undefined means create mode */
	initial?: { name: string; description: string; body: string };
	onSave: (name: string, description: string, body: string) => Promise<void>;
}

const SkillEditorDialog: React.FC<SkillEditorDialogProps> = ({
	open,
	onOpenChange,
	initial,
	onSave,
}) => {
	const [name, setName] = useState(initial?.name ?? "");
	const [description, setDescription] = useState(initial?.description ?? "");
	const [body, setBody] = useState(initial?.body ?? "");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const isEdit = initial !== undefined;

	// Reset fields when dialog opens
	useEffect(() => {
		if (open) {
			setName(initial?.name ?? "");
			setDescription(initial?.description ?? "");
			setBody(initial?.body ?? "");
			setError(null);
		}
	}, [open, initial?.name, initial?.description, initial?.body]);

	const handleSave = async () => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Name is required");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await onSave(trimmedName, description.trim(), body.trim());
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save skill");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit Skill" : "New Skill"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label className="text-xs">Name</Label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g. code-review"
							disabled={isEdit}
							className="h-8 text-sm font-mono"
						/>
						<p className="text-[11px] text-muted-foreground">
							Lowercase letters, numbers, and hyphens. Used as file name.
						</p>
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs">Description</Label>
						<Input
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="One-line description shown in mentions"
							className="h-8 text-sm"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs">Content (Markdown)</Label>
						<Textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							placeholder="Write the skill instructions here..."
							className="min-h-[180px] resize-y font-mono text-xs"
						/>
					</div>

					{error ? <p className="text-xs text-destructive">{error}</p> : null}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={saving}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => void handleSave()}
						disabled={saving}
					>
						{saving ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

// ---------------------------------------------------------------------------
// GitHub import dialog
// ---------------------------------------------------------------------------

interface GithubImportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onImport: (url: string) => Promise<void>;
}

const GithubImportDialog: React.FC<GithubImportDialogProps> = ({
	open,
	onOpenChange,
	onImport,
}) => {
	const [url, setUrl] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);

	useEffect(() => {
		if (open) {
			setUrl("");
			setError(null);
		}
	}, [open]);

	const handleImport = async () => {
		const trimmed = url.trim();
		if (!trimmed) return;
		setImporting(true);
		setError(null);
		try {
			await onImport(trimmed);
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to import");
		} finally {
			setImporting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Github size={16} />
						Import from GitHub
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label className="text-xs">GitHub File URL</Label>
						<Input
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							placeholder="https://github.com/user/repo/blob/main/skill.md"
							className="h-8 text-sm font-mono"
						/>
						<p className="text-[11px] text-muted-foreground">
							Paste a GitHub file URL or raw.githubusercontent.com URL pointing
							to a <code>.md</code> skill file.
						</p>
					</div>

					{error ? <p className="text-xs text-destructive">{error}</p> : null}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onOpenChange(false)}
						disabled={importing}
					>
						Cancel
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={() => void handleImport()}
						disabled={importing || !url.trim()}
					>
						{importing ? "Importing…" : "Import"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

// ---------------------------------------------------------------------------
// SkillsSection
// ---------------------------------------------------------------------------

export const SkillsSection: React.FC = () => {
	const [skills, setSkills] = useState<SkillSummary[]>([]);
	const [loading, setLoading] = useState(true);

	// Editor dialog state
	const [editorOpen, setEditorOpen] = useState(false);
	const [editorInitial, setEditorInitial] = useState<
		{ name: string; description: string; body: string } | undefined
	>(undefined);

	// GitHub import dialog
	const [importOpen, setImportOpen] = useState(false);

	// Delete confirmation
	const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

	const loadSkills = useCallback(async () => {
		setLoading(true);
		try {
			setSkills(await skillFileSystemService.listSkills());
		} catch {
			setSkills([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadSkills();
	}, [loadSkills]);

	const handleOpenCreate = () => {
		setEditorInitial(undefined);
		setEditorOpen(true);
	};

	const handleOpenEdit = async (skill: SkillSummary) => {
		try {
			const full = await skillFileSystemService.readSkill(skill.name);
			setEditorInitial({
				name: full.name,
				description: full.description,
				body: full.body,
			});
			setEditorOpen(true);
		} catch {
			// skill may have been deleted
		}
	};

	const handleSave = async (
		name: string,
		description: string,
		body: string,
	) => {
		await skillFileSystemService.writeSkill(name, description, body);
		await loadSkills();
	};

	const handleImport = async (url: string) => {
		await skillFileSystemService.importFromGithub(url);
		await loadSkills();
	};

	const handleDelete = async (name: string) => {
		await skillFileSystemService.deleteSkill(name);
		setDeleteTarget(null);
		await loadSkills();
	};

	return (
		<div className="space-y-3 rounded-2xl glass p-4 sm:p-5">
			{/* Header */}
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-muted p-2.5 text-muted-foreground">
						<BookOpen size={16} />
					</div>
					<div className="space-y-1">
						<Label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Skills
						</Label>
						<p className="text-sm font-semibold">
							{loading
								? "…"
								: `${skills.length} skill${skills.length !== 1 ? "s" : ""}`}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 rounded-lg px-2 text-[10px]"
						onClick={() => setImportOpen(true)}
					>
						<Github size={10} className="mr-1" />
						GitHub
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 rounded-lg px-2 text-[10px]"
						onClick={handleOpenCreate}
					>
						<Plus size={10} className="mr-1" />
						New
					</Button>
				</div>
			</div>

			{/* Skill list */}
			{skills.length > 0 ? (
				<div className="space-y-1.5">
					{skills.map((skill) => (
						<div
							key={skill.name}
							className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm"
						>
							<span className="font-mono text-xs font-medium flex-1 truncate">
								{skill.name}
							</span>
							{skill.description ? (
								<span className="truncate max-w-[140px] text-[11px] text-muted-foreground">
									{skill.description}
								</span>
							) : null}
							<div className="flex items-center gap-1 shrink-0">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
									onClick={() => void handleOpenEdit(skill)}
								>
									<Pencil size={11} />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
									onClick={() => setDeleteTarget(skill.name)}
								>
									<Trash2 size={11} />
								</Button>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="text-[11px] text-muted-foreground">
					No skills yet. Create one or import from GitHub. Skills are loaded by
					the agent on demand via the{" "}
					<Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
						load_skill
					</Badge>{" "}
					tool, or injected directly when mentioned with <code>@</code>.
				</p>
			)}

			{/* Hint row */}
			{skills.length > 0 ? (
				<p className="text-[11px] text-muted-foreground">
					Mention a skill with <code>@skill-name</code> to inject it directly,
					or let the agent load it automatically with{" "}
					<Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
						load_skill
					</Badge>
					.
				</p>
			) : null}

			{/* Dialogs */}
			<SkillEditorDialog
				open={editorOpen}
				onOpenChange={setEditorOpen}
				initial={editorInitial}
				onSave={handleSave}
			/>

			<GithubImportDialog
				open={importOpen}
				onOpenChange={setImportOpen}
				onImport={handleImport}
			/>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete skill</AlertDialogTitle>
						<AlertDialogDescription>
							Delete <strong>{deleteTarget}</strong>? This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => deleteTarget && void handleDelete(deleteTarget)}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
};
