import React, { useEffect, useMemo, useState } from "react";
import {
	ChevronDown,
	ChevronUp,
	Copy,
	Globe,
	Info,
	Plus,
	Server,
	Terminal,
	Trash2,
} from "lucide-react";
import { Button } from "@/main/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Input } from "@/main/components/ui/input";
import { Label } from "@/main/components/ui/label";
import { Badge } from "@/main/components/ui/badge";
import { Textarea } from "@/main/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
	MCPHTTPServerConfig,
	MCPServerConfig,
	MCPSSEServerConfig,
} from "@/services/flows/steps/features/mcp-feature";

interface MCPServersEditorProps {
	servers: MCPServerConfig[];
	onChange: (servers: MCPServerConfig[]) => void;
	className?: string;
}

type MCPServerPreset =
	| "local-http"
	| "local-sse"
	| "manual-http"
	| "manual-sse";

const LOCAL_HTTP_URL = "http://127.0.0.1:8000/mcp";
const LOCAL_SSE_URL = "http://127.0.0.1:8000/sse";
const LOCAL_SERVER_STDIO_EXAMPLE =
	"npx -y @modelcontextprotocol/server-filesystem .";

const parseHeaders = (text: string): Record<string, string> => {
	const result: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const colon = line.indexOf(":");
		if (colon > 0) {
			result[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
		}
	}
	return result;
};

const createServerFromPreset = (preset: MCPServerPreset): MCPServerConfig => {
	switch (preset) {
		case "local-http":
			return {
				type: "http",
				name: "local-filesystem",
				url: LOCAL_HTTP_URL,
				headers: {},
			};
		case "local-sse":
			return {
				type: "sse",
				name: "local-filesystem",
				url: LOCAL_SSE_URL,
				headers: {},
			};
		case "manual-http":
			return {
				type: "http",
				name: "",
				url: "",
				headers: {},
			};
		case "manual-sse":
		default:
			return {
				type: "sse",
				name: "",
				url: "",
				headers: {},
			};
	}
};

const getLocalBridgeScript = (preset: MCPServerPreset): string | null => {
	switch (preset) {
		case "local-http":
			return `npx -y supergateway --stdio "${LOCAL_SERVER_STDIO_EXAMPLE}" --outputTransport streamableHttp --port 8000`;
		case "local-sse":
			return `npx -y supergateway --stdio "${LOCAL_SERVER_STDIO_EXAMPLE}" --port 8000 --baseUrl http://127.0.0.1:8000 --ssePath /sse --messagePath /message`;
		default:
			return null;
	}
};

const presetOptions: Array<{
	id: MCPServerPreset;
	title: string;
	description: string;
	badge: string;
}> = [
	{
		id: "local-http",
		title: "Local bridge",
		description:
			"Recommended. Run a local stdio MCP server through npx and connect over HTTP.",
		badge: "HTTP",
	},
	{
		id: "local-sse",
		title: "Local bridge (SSE)",
		description:
			"Fallback for legacy SSE MCP endpoints exposed from a local bridge.",
		badge: "SSE",
	},
	{
		id: "manual-http",
		title: "Remote HTTP",
		description: "Connect directly to a remote Streamable HTTP MCP endpoint.",
		badge: "HTTP",
	},
	{
		id: "manual-sse",
		title: "Remote SSE",
		description: "Connect directly to a remote SSE MCP endpoint.",
		badge: "SSE",
	},
];

interface ServerRowProps {
	server: MCPServerConfig;
	index: number;
	onUpdate: (index: number, server: MCPServerConfig) => void;
	onRemove: (index: number) => void;
}

const ServerRow: React.FC<ServerRowProps> = ({
	server,
	index,
	onUpdate,
	onRemove,
}) => {
	const [expanded, setExpanded] = useState(index === 0 || server.name === "");

	const headersText = Object.entries(server.headers ?? {})
		.map(([key, value]) => `${key}: ${value}`)
		.join("\n");

	return (
		<div className="rounded-xl border border-border/60 bg-background/60 p-3">
			<div className="flex items-center gap-2">
				<Server size={13} className="shrink-0 text-muted-foreground" />
				<Input
					value={server.name}
					onChange={(event) =>
						onUpdate(index, { ...server, name: event.target.value })
					}
					placeholder="Server name (unique)"
					className="h-7 flex-1 rounded-lg border-border/60 text-xs font-medium"
				/>
				<select
					value={server.type}
					onChange={(event) =>
						onUpdate(index, {
							...server,
							type: event.target.value as MCPServerConfig["type"],
						})
					}
					className="h-7 shrink-0 rounded-lg border border-input bg-background px-2 text-[10px] font-medium uppercase"
				>
					<option value="http">HTTP</option>
					<option value="sse">SSE</option>
				</select>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 rounded-lg"
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="h-7 w-7 rounded-lg text-destructive hover:text-destructive"
					onClick={() => onRemove(index)}
				>
					<Trash2 size={12} />
				</Button>
			</div>

			{expanded ? (
				<div className="mt-3 space-y-2 border-t border-border/40 pt-3">
					<div>
						<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
							URL
						</Label>
						<Input
							value={server.url}
							onChange={(event) =>
								onUpdate(index, { ...server, url: event.target.value })
							}
							placeholder={
								server.type === "http"
									? "http://localhost:3000/mcp"
									: "http://localhost:3000/sse"
							}
							className="mt-1 h-8 rounded-lg font-mono text-xs"
						/>
					</div>
					<div>
						<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
							Headers (Name: Value, one per line)
						</Label>
						<Textarea
							value={headersText}
							onChange={(event) =>
								onUpdate(index, {
									...server,
									headers: parseHeaders(event.target.value),
								})
							}
							placeholder={"Authorization: Bearer token\nX-Api-Key: abc123"}
							rows={3}
							className="mt-1 min-h-[88px] rounded-lg font-mono text-xs"
						/>
					</div>
				</div>
			) : null}
		</div>
	);
};

export const MCPServersEditor: React.FC<MCPServersEditorProps> = ({
	servers,
	onChange,
	className,
}) => {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [preset, setPreset] = useState<MCPServerPreset>("local-http");
	const [draftServer, setDraftServer] = useState<MCPServerConfig>(
		createServerFromPreset("local-http"),
	);
	const [headersDraft, setHeadersDraft] = useState("");
	const [copiedScript, setCopiedScript] = useState(false);

	useEffect(() => {
		setHeadersDraft(
			Object.entries(draftServer.headers ?? {})
				.map(([key, value]) => `${key}: ${value}`)
				.join("\n"),
		);
	}, [draftServer]);

	const recommendedScript = useMemo(
		() => getLocalBridgeScript(preset),
		[preset],
	);

	const handleUpdate = (index: number, updated: MCPServerConfig) => {
		const next = [...servers];
		next[index] = updated;
		onChange(next);
	};

	const handleRemove = (index: number) => {
		onChange(servers.filter((_, itemIndex) => itemIndex !== index));
	};

	const openAddDialog = (nextPreset: MCPServerPreset = "local-http") => {
		setPreset(nextPreset);
		setDraftServer(createServerFromPreset(nextPreset));
		setCopiedScript(false);
		setDialogOpen(true);
	};

	const applyPreset = (nextPreset: MCPServerPreset) => {
		setPreset(nextPreset);
		setDraftServer(createServerFromPreset(nextPreset));
		setCopiedScript(false);
	};

	const handleAddServer = () => {
		const normalizedName = draftServer.name.trim();
		const normalizedUrl = draftServer.url.trim();

		if (!normalizedName || !normalizedUrl) {
			return;
		}

		onChange([
			...servers,
			{
				...draftServer,
				name: normalizedName,
				url: normalizedUrl,
				headers: parseHeaders(headersDraft),
			},
		]);
		setDialogOpen(false);
	};

	const handleCopyScript = async () => {
		if (!recommendedScript || !navigator.clipboard?.writeText) {
			return;
		}

		await navigator.clipboard.writeText(recommendedScript);
		setCopiedScript(true);
		window.setTimeout(() => setCopiedScript(false), 1500);
	};

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
				<Info size={10} className="shrink-0" />
				<span>
					Browser MCP access only supports HTTP or SSE. Local stdio servers need
					a bridge.
				</span>
			</div>

			{servers.length === 0 ? (
				<p className="py-1 text-[11px] text-muted-foreground">
					No MCP servers configured.
				</p>
			) : (
				<div className="space-y-2">
					{servers.map((server, index) => (
						<ServerRow
							key={`${server.name}-${index}`}
							server={server as MCPHTTPServerConfig | MCPSSEServerConfig}
							index={index}
							onUpdate={handleUpdate}
							onRemove={handleRemove}
						/>
					))}
				</div>
			)}

			<div className="flex items-center gap-2">
				<Badge variant="secondary" className="text-[10px]">
					{servers.length} server{servers.length !== 1 ? "s" : ""}
				</Badge>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="h-7 rounded-lg px-2 text-[10px]"
					onClick={() => openAddDialog("local-http")}
				>
					<Plus size={10} className="mr-1" />
					Add server
				</Button>
			</div>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="flex max-h-[min(90dvh,760px)] w-[calc(100vw-1rem)] max-w-[760px] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl sm:w-[min(94vw,760px)]">
					<DialogHeader className="border-b px-5 pt-5 pb-4">
						<DialogTitle className="text-base">Add MCP server</DialogTitle>
						<DialogDescription className="text-xs leading-relaxed">
							Choose a guided preset for local MCP setup or enter a remote
							server manually.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-5 overflow-y-auto px-5 py-4">
						<div className="grid gap-2 sm:grid-cols-2">
							{presetOptions.map((option) => {
								const selected = option.id === preset;
								return (
									<button
										type="button"
										key={option.id}
										onClick={() => applyPreset(option.id)}
										className={cn(
											"rounded-xl border p-3 text-left transition-colors",
											selected
												? "border-primary bg-primary/5"
												: "border-border/60 bg-background/60 hover:border-border",
										)}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="space-y-1">
												<p className="text-sm font-semibold">{option.title}</p>
												<p className="text-[11px] leading-relaxed text-muted-foreground">
													{option.description}
												</p>
											</div>
											<Badge variant={selected ? "default" : "outline"}>
												{option.badge}
											</Badge>
										</div>
									</button>
								);
							})}
						</div>

						{recommendedScript ? (
							<div className="space-y-3 rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4">
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-3">
										<div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700">
											<Terminal size={15} />
										</div>
										<div className="space-y-1">
											<p className="text-sm font-semibold">
												Recommended local bridge script
											</p>
											<p className="text-[11px] leading-relaxed text-muted-foreground">
												Run this in your terminal first. It exposes a local
												stdio MCP server as a browser-safe endpoint using{" "}
												<code>supergateway</code>.
											</p>
										</div>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-7 rounded-lg px-2 text-[10px]"
										onClick={() => void handleCopyScript()}
									>
										<Copy size={10} className="mr-1" />
										{copiedScript ? "Copied" : "Copy"}
									</Button>
								</div>

								<Textarea
									value={recommendedScript}
									readOnly
									rows={3}
									className="min-h-[92px] rounded-lg border-border/60 bg-background/80 font-mono text-[11px]"
								/>

								<div className="grid gap-3 sm:grid-cols-2">
									<div className="rounded-lg border border-border/50 bg-background/70 p-3">
										<div className="flex items-center gap-2 text-xs font-medium">
											<Globe size={12} />
											Connect this URL
										</div>
										<p className="mt-2 font-mono text-[11px] text-muted-foreground">
											{preset === "local-http" ? LOCAL_HTTP_URL : LOCAL_SSE_URL}
										</p>
									</div>
									<div className="rounded-lg border border-border/50 bg-background/70 p-3">
										<p className="text-xs font-medium">
											Replace the stdio command
										</p>
										<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
											Swap{" "}
											<code className="font-mono">
												{LOCAL_SERVER_STDIO_EXAMPLE}
											</code>{" "}
											with your own local MCP server command if you are not
											using the filesystem server.
										</p>
									</div>
								</div>
							</div>
						) : null}

						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Server name
								</Label>
								<Input
									value={draftServer.name}
									onChange={(event) =>
										setDraftServer((current) => ({
											...current,
											name: event.target.value,
										}))
									}
									placeholder="my-mcp-server"
									className="mt-1 h-9 rounded-lg text-xs"
								/>
							</div>
							<div>
								<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
									Transport
								</Label>
								<select
									value={draftServer.type}
									onChange={(event) =>
										setDraftServer((current) => ({
											...current,
											type: event.target.value as MCPServerConfig["type"],
										}))
									}
									className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium uppercase"
								>
									<option value="http">HTTP</option>
									<option value="sse">SSE</option>
								</select>
							</div>
						</div>

						<div>
							<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
								URL
							</Label>
							<Input
								value={draftServer.url}
								onChange={(event) =>
									setDraftServer((current) => ({
										...current,
										url: event.target.value,
									}))
								}
								placeholder={
									draftServer.type === "http"
										? "http://localhost:3000/mcp"
										: "http://localhost:3000/sse"
								}
								className="mt-1 h-9 rounded-lg font-mono text-xs"
							/>
						</div>

						<div>
							<Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
								Headers (optional)
							</Label>
							<Textarea
								value={headersDraft}
								onChange={(event) => setHeadersDraft(event.target.value)}
								placeholder={"Authorization: Bearer token\nX-Api-Key: abc123"}
								rows={4}
								className="mt-1 min-h-[108px] rounded-lg font-mono text-xs"
							/>
						</div>
					</div>

					<DialogFooter className="border-t px-5 py-4">
						<Button
							type="button"
							variant="outline"
							onClick={() => setDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleAddServer}
							disabled={!draftServer.name.trim() || !draftServer.url.trim()}
						>
							Add server
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
};
