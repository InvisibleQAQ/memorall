import React from "react";
import { FileCode2, FolderOpen } from "lucide-react";
import type {
	ActionRenderer,
	MessageActionItem,
} from "@/main/modules/chat/components/types";
import { Badge } from "@/main/components/ui/badge";
import { defaultActionRenderer } from "./DefaultActionRenderer";
import {
	getBoolean,
	getString,
	getToolCallArguments,
	isRecord,
	ToolCodeBlock,
	ToolDetail,
	ToolDetailsGrid,
	ToolRawPayload,
	ToolSection,
	ToolStateBadge,
} from "./ToolCommon";

type FsArgs = Record<string, unknown>;

type FsReadView = {
	filePath?: string;
	totalLines?: number;
	startLine?: number;
	endLine?: number;
	lines: Array<{ number?: number; text: string }>;
};

type FsListView = {
	path?: string;
	itemCount?: number;
	items: Array<{ path: string; type: "file" | "folder"; sizeLabel?: string }>;
	empty?: boolean;
};

type FsGlobView = {
	path?: string;
	pattern?: string;
	matches: string[];
	empty?: boolean;
};

type FsGrepView =
	| {
			mode: "files_with_matches";
			path?: string;
			pattern?: string;
			glob?: string;
			results: string[];
			empty?: boolean;
	  }
	| {
			mode: "count";
			path?: string;
			pattern?: string;
			glob?: string;
			results: Array<{ path: string; count: number }>;
			empty?: boolean;
	  }
	| {
			mode: "content";
			path?: string;
			pattern?: string;
			glob?: string;
			results: Array<{
				path: string;
				groups: Array<{
					lines: Array<{ lineNumber: number; text: string; isMatch: boolean }>;
				}>;
			}>;
			matchCount?: number;
			fileCount?: number;
			empty?: boolean;
	  };

type FsMutationView = {
	title: string;
	path?: string;
	status?: string;
	kind?: string;
	characters?: number;
	replacements?: number;
	recursive?: boolean;
	replaceAll?: boolean;
	oldString?: string;
	newString?: string;
};

type ActionDescriptionParts = {
	inputText?: string;
	outputText: string;
};

const iconForPath = (type: "file" | "folder") =>
	type === "folder" ? (
		<FolderOpen className="h-4 w-4 text-muted-foreground" />
	) : (
		<FileCode2 className="h-4 w-4 text-muted-foreground" />
	);

const splitActionDescription = (
	description: string,
): ActionDescriptionParts => {
	const normalized = description.replace(/\r\n/g, "\n");
	const match = normalized.match(/^input:\n([\s\S]*?)\noutput:\n([\s\S]*)$/);

	if (!match) {
		return {
			outputText: normalized,
		};
	}

	return {
		inputText: match[1],
		outputText: match[2],
	};
};

const parseFsReadOutput = (description: string): FsReadView | null => {
	const [header, ...bodyLines] = description.split(/\r?\n/);
	const match = header.match(
		/^File: (.+) \((\d+) lines\)(?: \(showing lines (\d+)-(\d+)\))?$/,
	);
	if (!match) {
		return null;
	}

	const totalLines = Number(match[2]);
	const startLine = match[3] ? Number(match[3]) : bodyLines.length > 0 ? 1 : 0;
	const endLine = match[4]
		? Number(match[4])
		: bodyLines.length > 0
			? startLine + bodyLines.length - 1
			: 0;

	return {
		filePath: match[1],
		totalLines,
		startLine,
		endLine,
		lines: bodyLines.map((line) => {
			const numbered = line.match(/^\s*(\d+)\t([\s\S]*)$/);
			if (!numbered) {
				return {
					text: line,
				};
			}

			return {
				number: Number(numbered[1]),
				text: numbered[2],
			};
		}),
	};
};

const parseFsLsOutput = (description: string): FsListView | null => {
	const emptyMatch = description.match(/^Empty directory: (.+)$/);
	if (emptyMatch) {
		return {
			path: emptyMatch[1],
			items: [],
			empty: true,
		};
	}

	const [header, ...itemLines] = description.split(/\r?\n/);
	const headerMatch = header.match(/^(\d+) item(?:s)? in (.+):$/);
	if (!headerMatch) {
		return null;
	}

	return {
		path: headerMatch[2],
		itemCount: Number(headerMatch[1]),
		items: itemLines.filter(Boolean).map((line) => {
			if (line.endsWith("/")) {
				return {
					path: line.slice(0, -1),
					type: "folder" as const,
				};
			}

			const fileMatch = line.match(/^(.*?)(?:\s{2}\(([^)]+)\))?$/);
			return {
				path: fileMatch?.[1] ?? line,
				type: "file" as const,
				sizeLabel: fileMatch?.[2],
			};
		}),
	};
};

const parseFsGlobOutput = (
	description: string,
	args: FsArgs | null,
): FsGlobView => {
	const emptyMatch = description.match(
		/^No files found matching "(.+)" under "(.+)"$/,
	);
	if (emptyMatch) {
		return {
			pattern: emptyMatch[1],
			path: emptyMatch[2],
			matches: [],
			empty: true,
		};
	}

	return {
		pattern: getString(args ?? {}, "pattern"),
		path: getString(args ?? {}, "path"),
		matches: description
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean),
	};
};

const parseFsGrepOutput = (
	description: string,
	args: FsArgs | null,
): FsGrepView => {
	const outputMode =
		getString(args ?? {}, "output_mode") ??
		(description.includes("\n\n") || description.includes("--")
			? "content"
			: "files_with_matches");

	const emptyMatch = description.match(
		/^No matches found for "(.+)"(?: in files matching "(.+)")? under "(.+)"$/,
	);
	if (emptyMatch) {
		if (outputMode === "count") {
			return {
				mode: "count",
				pattern: emptyMatch[1],
				glob: emptyMatch[2],
				path: emptyMatch[3],
				results: [],
				empty: true,
			};
		}

		if (outputMode === "content") {
			return {
				mode: "content",
				pattern: emptyMatch[1],
				glob: emptyMatch[2],
				path: emptyMatch[3],
				results: [],
				empty: true,
			};
		}

		return {
			mode: "files_with_matches",
			pattern: emptyMatch[1],
			glob: emptyMatch[2],
			path: emptyMatch[3],
			results: [],
			empty: true,
		};
	}

	if (outputMode === "count") {
		return {
			mode: "count",
			pattern: getString(args ?? {}, "pattern"),
			glob: getString(args ?? {}, "glob"),
			path: getString(args ?? {}, "path"),
			results: description
				.split(/\r?\n/)
				.filter(Boolean)
				.map((line) => {
					const match = line.match(/^(.*):(\d+)$/);
					return {
						path: match?.[1] ?? line,
						count: Number(match?.[2] ?? 0),
					};
				}),
		};
	}

	if (outputMode === "files_with_matches") {
		return {
			mode: "files_with_matches",
			pattern: getString(args ?? {}, "pattern"),
			glob: getString(args ?? {}, "glob"),
			path: getString(args ?? {}, "path"),
			results: description
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter(Boolean),
		};
	}

	const summaryMatch = description.match(/\n\n(\d+) matches? in (\d+) files?$/);
	const summaryText = summaryMatch
		? description.slice(0, summaryMatch.index)
		: description;
	const grouped = new Map<
		string,
		Array<{
			lines: Array<{ lineNumber: number; text: string; isMatch: boolean }>;
		}>
	>();
	let currentPath = "";
	let currentGroup: {
		lines: Array<{ lineNumber: number; text: string; isMatch: boolean }>;
	} | null = null;

	for (const line of summaryText.split(/\r?\n/)) {
		if (!line) {
			continue;
		}

		if (line === "--") {
			currentGroup = null;
			continue;
		}

		const match = line.match(/^(.*?):(\d+)([:\-])(.*)$/);
		if (!match) {
			continue;
		}

		const [, path, lineNumberText, separator, text] = match;
		if (!grouped.has(path)) {
			grouped.set(path, []);
		}
		if (currentPath !== path || !currentGroup) {
			currentGroup = { lines: [] };
			grouped.get(path)!.push(currentGroup);
		}

		currentPath = path;
		currentGroup.lines.push({
			lineNumber: Number(lineNumberText),
			text,
			isMatch: separator === ":",
		});
	}

	return {
		mode: "content",
		pattern: getString(args ?? {}, "pattern"),
		glob: getString(args ?? {}, "glob"),
		path: getString(args ?? {}, "path"),
		matchCount: summaryMatch ? Number(summaryMatch[1]) : undefined,
		fileCount: summaryMatch ? Number(summaryMatch[2]) : undefined,
		results: Array.from(grouped.entries()).map(([path, groups]) => ({
			path,
			groups,
		})),
	};
};

const parseFsMutationOutput = (
	name: MessageActionItem["name"],
	outputText: string,
	args: FsArgs | null,
): FsMutationView | null => {
	if (name === "fs_write") {
		const match = outputText.match(
			/^(Written|Updated|Created) file: (.+) \((\d+) characters\)$/,
		);
		if (!match) {
			return null;
		}

		return {
			title: "Write Result",
			status: match[1].toLowerCase(),
			path: match[2],
			characters: Number(match[3]),
		};
	}

	if (name === "fs_edit") {
		const match = outputText.match(
			/^Edited (.+): (\d+) replacement(?:s)? made$/,
		);
		if (!match) {
			return null;
		}

		return {
			title: "Edit Result",
			status: "edited",
			path: match[1],
			replacements: Number(match[2]),
			replaceAll: getBoolean(args ?? {}, "replace_all"),
			oldString: getString(args ?? {}, "old_string"),
			newString: getString(args ?? {}, "new_string"),
		};
	}

	if (name === "fs_mkdir") {
		const created = outputText.match(/^Created directory: (.+)$/);
		const exists = outputText.match(/^Directory already exists: (.+)$/);
		if (created) {
			return {
				title: "Directory Result",
				status: "created",
				path: created[1],
				recursive: getBoolean(args ?? {}, "recursive"),
			};
		}
		if (exists) {
			return {
				title: "Directory Result",
				status: "already exists",
				path: exists[1],
				recursive: getBoolean(args ?? {}, "recursive"),
			};
		}
		return null;
	}

	if (name === "fs_remove") {
		const file = outputText.match(/^Deleted file: (.+)$/);
		const directory = outputText.match(
			/^Deleted directory(?: \((recursive)\))?: (.+)$/,
		);
		if (file) {
			return {
				title: "Remove Result",
				status: "deleted",
				kind: "file",
				path: file[1],
				recursive: getBoolean(args ?? {}, "recursive"),
			};
		}
		if (directory) {
			return {
				title: "Remove Result",
				status: "deleted",
				kind: "directory",
				path: directory[2],
				recursive: Boolean(directory[1]) || getBoolean(args ?? {}, "recursive"),
			};
		}
		return null;
	}

	return null;
};

const renderFsRead = (view: FsReadView, raw: unknown): React.ReactNode => (
	<>
		<ToolSection title="Read Result">
			<ToolDetailsGrid>
				{view.filePath ? (
					<ToolDetail label="File" value={view.filePath} mono />
				) : null}
				{view.totalLines !== undefined ? (
					<ToolDetail
						label="Total lines"
						value={String(view.totalLines)}
						mono
					/>
				) : null}
				{view.startLine !== undefined && view.endLine !== undefined ? (
					<ToolDetail
						label="Range"
						value={`${view.startLine}-${view.endLine}`}
						mono
					/>
				) : null}
			</ToolDetailsGrid>
			<div className="mt-3">
				<ToolCodeBlock>
					{view.lines
						.map((line) =>
							line.number !== undefined
								? `${line.number}\t${line.text}`
								: line.text,
						)
						.join("\n")}
				</ToolCodeBlock>
			</div>
		</ToolSection>
		<ToolRawPayload payload={raw} />
	</>
);

const renderFsList = (view: FsListView, raw: unknown): React.ReactNode => (
	<>
		<ToolSection title="Directory Listing">
			<ToolDetailsGrid>
				{view.path ? <ToolDetail label="Path" value={view.path} mono /> : null}
				{view.itemCount !== undefined ? (
					<ToolDetail label="Items" value={String(view.itemCount)} mono />
				) : null}
			</ToolDetailsGrid>
			<div className="mt-3 space-y-2">
				{view.empty ? (
					<div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
						Directory is empty.
					</div>
				) : (
					view.items.map((item) => (
						<div
							key={`${item.type}:${item.path}`}
							className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2"
						>
							{iconForPath(item.type)}
							<div className="min-w-0 flex-1">
								<div className="truncate font-mono text-sm text-foreground">
									{item.path}
								</div>
								<div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
									<Badge variant="outline">{item.type}</Badge>
									{item.sizeLabel ? (
										<Badge variant="outline">{item.sizeLabel}</Badge>
									) : null}
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</ToolSection>
		<ToolRawPayload payload={raw} />
	</>
);

const renderFsGlob = (view: FsGlobView, raw: unknown): React.ReactNode => (
	<>
		<ToolSection title="Glob Matches">
			<ToolDetailsGrid>
				{view.pattern ? (
					<ToolDetail label="Pattern" value={view.pattern} mono />
				) : null}
				{view.path ? (
					<ToolDetail label="Base path" value={view.path} mono />
				) : null}
				<ToolDetail label="Matches" value={String(view.matches.length)} mono />
			</ToolDetailsGrid>
			<div className="mt-3 space-y-2">
				{view.empty ? (
					<div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
						No matching files.
					</div>
				) : (
					view.matches.map((path) => (
						<div
							key={path}
							className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 font-mono text-sm break-all text-foreground"
						>
							{path}
						</div>
					))
				)}
			</div>
		</ToolSection>
		<ToolRawPayload payload={raw} />
	</>
);

const renderFsGrep = (view: FsGrepView, raw: unknown): React.ReactNode => (
	<>
		<ToolSection title="Search Results">
			<ToolDetailsGrid>
				{view.pattern ? (
					<ToolDetail label="Pattern" value={view.pattern} mono />
				) : null}
				{view.path ? (
					<ToolDetail label="Target" value={view.path} mono />
				) : null}
				{view.glob ? <ToolDetail label="Glob" value={view.glob} mono /> : null}
				<ToolDetail label="Mode" value={view.mode} mono />
				{"fileCount" in view && view.fileCount !== undefined ? (
					<ToolDetail label="Files" value={String(view.fileCount)} mono />
				) : null}
				{"matchCount" in view && view.matchCount !== undefined ? (
					<ToolDetail label="Matches" value={String(view.matchCount)} mono />
				) : null}
			</ToolDetailsGrid>
			<div className="mt-3 space-y-3">
				{view.empty ? (
					<div className="rounded-md border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
						No matches found.
					</div>
				) : view.mode === "files_with_matches" ? (
					view.results.map((path) => (
						<div
							key={path}
							className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 font-mono text-sm break-all text-foreground"
						>
							{path}
						</div>
					))
				) : view.mode === "count" ? (
					view.results.map((result) => (
						<div
							key={result.path}
							className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/10 px-3 py-2"
						>
							<div className="font-mono text-sm break-all text-foreground">
								{result.path}
							</div>
							<Badge variant="outline">{result.count}</Badge>
						</div>
					))
				) : (
					view.results.map((result) => (
						<div
							key={result.path}
							className="rounded-lg border border-border/60 bg-background p-3"
						>
							<div className="mb-3 font-mono text-sm break-all text-foreground">
								{result.path}
							</div>
							<div className="space-y-2">
								{result.groups.map((group, index) => (
									<div
										key={index}
										className="rounded-md border border-border/60 bg-muted/10"
									>
										{group.lines.map((line) => (
											<div
												key={`${result.path}:${line.lineNumber}:${line.isMatch ? "m" : "c"}`}
												className={`grid grid-cols-[auto_1fr] gap-3 px-3 py-1.5 text-xs ${
													line.isMatch ? "bg-accent/40" : ""
												}`}
											>
												<div className="font-mono text-muted-foreground">
													{line.lineNumber}
												</div>
												<div className="whitespace-pre-wrap break-words font-mono text-foreground">
													{line.text}
												</div>
											</div>
										))}
									</div>
								))}
							</div>
						</div>
					))
				)}
			</div>
		</ToolSection>
		<ToolRawPayload payload={raw} />
	</>
);

const renderFsMutation = (
	view: FsMutationView,
	raw: unknown,
): React.ReactNode => (
	<>
		<ToolSection title={view.title}>
			<ToolDetailsGrid>
				{view.path ? <ToolDetail label="Path" value={view.path} mono /> : null}
				{view.status ? (
					<ToolDetail label="Status" value={view.status} mono />
				) : null}
				{view.kind ? <ToolDetail label="Kind" value={view.kind} mono /> : null}
				{view.characters !== undefined ? (
					<ToolDetail label="Characters" value={String(view.characters)} mono />
				) : null}
				{view.replacements !== undefined ? (
					<ToolDetail
						label="Replacements"
						value={String(view.replacements)}
						mono
					/>
				) : null}
				{view.recursive !== undefined ? (
					<ToolDetail
						label="Recursive"
						value={view.recursive ? "yes" : "no"}
						mono
					/>
				) : null}
				{view.replaceAll !== undefined ? (
					<ToolDetail
						label="Replace all"
						value={view.replaceAll ? "yes" : "no"}
						mono
					/>
				) : null}
			</ToolDetailsGrid>
			{view.oldString ? (
				<div className="mt-3">
					<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
						Old string
					</div>
					<ToolCodeBlock>{view.oldString}</ToolCodeBlock>
				</div>
			) : null}
			{view.newString ? (
				<div className="mt-3">
					<div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/80">
						New string
					</div>
					<ToolCodeBlock>{view.newString}</ToolCodeBlock>
				</div>
			) : null}
		</ToolSection>
		<ToolRawPayload payload={raw} />
	</>
);

export const fsActionRenderer: ActionRenderer = (item, isOpen) => {
	if (!isOpen) return null;

	const args = getToolCallArguments(item);
	const descriptionParts = splitActionDescription(item.description);
	const outputText = descriptionParts.outputText;
	const raw = {
		args,
		input: descriptionParts.inputText,
		output: outputText,
		description: item.description,
	};

	if (outputText.startsWith("Error:")) {
		return (
			<div className="space-y-3">
				<ToolSection title="Filesystem Error">
					<div className="flex items-center gap-2">
						<ToolStateBadge ok={false} />
						<Badge variant="outline" className="text-[10px] font-mono">
							{item.name}
						</Badge>
					</div>
					<div className="mt-3 rounded-md border border-red-600/20 bg-red-600/5 px-3 py-2 text-xs text-red-700">
						{outputText.replace(/^Error:\s*/, "")}
					</div>
				</ToolSection>
				<ToolRawPayload payload={raw} />
			</div>
		);
	}

	switch (item.name) {
		case "fs_read": {
			const view = parseFsReadOutput(outputText);
			return view
				? renderFsRead(view, raw)
				: defaultActionRenderer(item, isOpen);
		}
		case "fs_ls": {
			const view = parseFsLsOutput(outputText);
			return view
				? renderFsList(view, raw)
				: defaultActionRenderer(item, isOpen);
		}
		case "fs_glob":
			return renderFsGlob(parseFsGlobOutput(outputText, args), raw);
		case "fs_grep":
			return renderFsGrep(parseFsGrepOutput(outputText, args), raw);
		case "fs_write":
		case "fs_edit":
		case "fs_mkdir":
		case "fs_remove": {
			const view = parseFsMutationOutput(item.name, outputText, args);
			return view
				? renderFsMutation(view, raw)
				: defaultActionRenderer(item, isOpen);
		}
		default:
			return defaultActionRenderer(item, isOpen);
	}
};
