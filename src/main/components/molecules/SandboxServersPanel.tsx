import React, { useEffect, useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	Globe,
	RefreshCw,
	Send,
	Server,
	Terminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { serviceManager } from "@/services";
import type {
	SandboxServerInfo,
	SandboxServerRequestResult,
} from "@/services/sandbox-container";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// SW relay types (mirrors WebAccess.tsx)
// ---------------------------------------------------------------------------

interface SwRelayRequestMessage {
	type: "sw-relay-request";
	id: number;
	portNum: number;
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: ArrayBuffer | null;
}

const isSwRelayRequestMessage = (v: unknown): v is SwRelayRequestMessage => {
	if (typeof v !== "object" || v === null) return false;
	const r = v as Record<string, unknown>;
	return (
		r.type === "sw-relay-request" &&
		typeof r.id === "number" &&
		typeof r.portNum === "number" &&
		typeof r.method === "string"
	);
};

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

const normalizePreviewUrl = (rawUrl: string): string => {
	if (rawUrl.startsWith("/__virtual__/")) {
		return /\/$/.test(rawUrl) ? rawUrl : `${rawUrl}/`;
	}
	try {
		const parsed = new URL(rawUrl);
		if (parsed.pathname.startsWith("/__virtual__/")) {
			const p = /\/$/.test(parsed.pathname)
				? parsed.pathname
				: `${parsed.pathname}/`;
			return `${p}${parsed.search}${parsed.hash}`;
		}
		return parsed.toString();
	} catch {
		return rawUrl;
	}
};

// ---------------------------------------------------------------------------
// Kind badge
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
	express:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
	vite: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
	next: "bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
};

const KindBadge: React.FC<{ kind: string }> = ({ kind }) => (
	<span
		className={cn(
			"text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0",
			KIND_COLORS[kind] ?? "bg-muted text-muted-foreground",
		)}
	>
		{kind}
	</span>
);

// ---------------------------------------------------------------------------
// BrowserViewer
// ---------------------------------------------------------------------------

const BrowserViewer: React.FC<{ server: SandboxServerInfo }> = ({ server }) => {
	const { t } = useTranslation();
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [renderUrl, setRenderUrl] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		serviceManager
			.getSandboxContainerService()
			.getServerRenderUrl({ port: server.port, path: "/" })
			.then((r) => {
				if (!cancelled) setRenderUrl(r.url);
			})
			.catch(() => {
				if (!cancelled) setRenderUrl(normalizePreviewUrl(server.url));
			});
		return () => {
			cancelled = true;
		};
	}, [server.port, server.url]);

	useEffect(() => {
		if (!renderUrl) return;
		const onMessage = (event: MessageEvent<unknown>) => {
			if (event.source !== iframeRef.current?.contentWindow) return;
			if (!isSwRelayRequestMessage(event.data)) return;
			const msg = event.data;
			void serviceManager
				.getSandboxContainerService()
				.handleSwRequestWithRetry({
					id: msg.id,
					port: msg.portNum,
					method: msg.method,
					path: msg.url,
					headers: msg.headers ?? {},
					body: msg.body ?? null,
				})
				.then((result) => {
					iframeRef.current?.contentWindow?.postMessage(
						{ type: "sw-relay-response", id: msg.id, data: result },
						"*",
					);
				})
				.catch((err: unknown) => {
					iframeRef.current?.contentWindow?.postMessage(
						{
							type: "sw-relay-response",
							id: msg.id,
							error: err instanceof Error ? err.message : String(err),
						},
						"*",
					);
				});
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [renderUrl]);

	const openInTab = () => {
		const url = renderUrl ?? server.url;
		const final = url.startsWith("/")
			? chrome.runtime.getURL(url.replace(/^\//, ""))
			: url;
		chrome.tabs.create({ url: final });
	};

	if (!renderUrl) {
		return (
			<div className="p-3 text-xs text-muted-foreground">
				{t("sandboxPanel.resolvingUrl")}
			</div>
		);
	}

	return (
		<div>
			<div className="flex items-center gap-1 px-2 py-1 border-t border-border/60 bg-muted/20">
				<span className="flex-1 text-[10px] font-mono text-muted-foreground truncate">
					{renderUrl}
				</span>
				<button
					type="button"
					title={t("sandboxPanel.openInTab")}
					onClick={openInTab}
					className="p-1 text-muted-foreground hover:text-foreground shrink-0"
				>
					<ExternalLink size={11} />
				</button>
			</div>
			<iframe
				ref={iframeRef}
				src={renderUrl}
				title={`Sandbox server :${server.port}`}
				className="w-full h-[360px] bg-white"
				sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
				referrerPolicy="no-referrer"
			/>
		</div>
	);
};

// ---------------------------------------------------------------------------
// PostmanTool
// ---------------------------------------------------------------------------

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const PostmanTool: React.FC<{ server: SandboxServerInfo }> = ({ server }) => {
	const { t } = useTranslation();
	const [method, setMethod] = useState<HttpMethod>("GET");
	const [path, setPath] = useState("/");
	const [body, setBody] = useState("");
	const [loading, setLoading] = useState(false);
	const [response, setResponse] = useState<SandboxServerRequestResult | null>(
		null,
	);
	const [error, setError] = useState<string | null>(null);

	const hasBody = ["POST", "PUT", "PATCH"].includes(method);

	const handleSend = async () => {
		setLoading(true);
		setError(null);
		setResponse(null);
		try {
			const result = await serviceManager
				.getSandboxContainerService()
				.requestServer({
					port: server.port,
					path: path || "/",
					method,
					body: hasBody && body ? body : undefined,
					responseType: "auto",
				});
			setResponse(result);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	};

	const formattedBody = (() => {
		if (!response) return "";
		if (response.responseType === "json") {
			try {
				return JSON.stringify(JSON.parse(response.body), null, 2);
			} catch {
				return response.body;
			}
		}
		return response.body;
	})();

	return (
		<div className="p-2 space-y-2">
			{/* Method + path + send */}
			<div className="flex gap-1">
				<select
					value={method}
					onChange={(e) => setMethod(e.target.value as HttpMethod)}
					className="text-xs bg-background border border-border rounded px-1 py-1 focus:outline-none shrink-0"
				>
					{HTTP_METHODS.map((m) => (
						<option key={m} value={m}>
							{m}
						</option>
					))}
				</select>
				<input
					type="text"
					value={path}
					onChange={(e) => setPath(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && void handleSend()}
					placeholder={t("sandboxPanel.pathPlaceholder")}
					className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring font-mono min-w-0"
				/>
				<button
					type="button"
					onClick={() => void handleSend()}
					disabled={loading}
					title={t("sandboxPanel.send")}
					className="p-1.5 bg-primary text-primary-foreground rounded disabled:opacity-50 shrink-0"
				>
					<Send size={11} />
				</button>
			</div>

			{/* Body */}
			{hasBody && (
				<textarea
					value={body}
					onChange={(e) => setBody(e.target.value)}
					placeholder={t("sandboxPanel.bodyPlaceholder")}
					rows={3}
					className="w-full text-xs font-mono bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
				/>
			)}

			{/* Error */}
			{error && (
				<div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded p-2 break-words">
					{error}
				</div>
			)}

			{/* Response */}
			{response && (
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"text-[10px] font-semibold px-1.5 py-0.5 rounded border",
								response.ok
									? "text-green-700 bg-green-50 border-green-300 dark:text-green-300 dark:bg-green-900/20 dark:border-green-800"
									: "text-red-700 bg-red-50 border-red-300 dark:text-red-300 dark:bg-red-900/20 dark:border-red-800",
							)}
						>
							{response.status}
						</span>
						<span className="text-[10px] text-muted-foreground font-mono truncate">
							{response.contentType}
						</span>
					</div>
					<pre className="text-[10px] font-mono bg-muted rounded p-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
						{formattedBody}
					</pre>
				</div>
			)}
		</div>
	);
};

// ---------------------------------------------------------------------------
// ServerCard
// ---------------------------------------------------------------------------

type ActiveView = "browser" | "postman" | null;

const ServerCard: React.FC<{ server: SandboxServerInfo }> = ({ server }) => {
	const { t } = useTranslation();
	const [activeView, setActiveView] = useState<ActiveView>(null);

	const toggle = (view: "browser" | "postman") =>
		setActiveView((prev) => (prev === view ? null : view));

	return (
		<div className="border border-border rounded-md overflow-hidden">
			<div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/20">
				<KindBadge kind={server.kind} />
				<span className="text-xs font-mono text-muted-foreground">
					:{server.port}
				</span>
				{server.rootDir && (
					<span
						className="text-[10px] text-muted-foreground truncate flex-1"
						title={server.rootDir}
					>
						{server.rootDir}
					</span>
				)}
				<div className="ml-auto flex gap-1">
					<button
						type="button"
						title={t("sandboxPanel.browser")}
						onClick={() => toggle("browser")}
						className={cn(
							"p-1 rounded transition-colors",
							activeView === "browser"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-muted",
						)}
					>
						<Globe size={12} />
					</button>
					<button
						type="button"
						title={t("sandboxPanel.api")}
						onClick={() => toggle("postman")}
						className={cn(
							"p-1 rounded transition-colors",
							activeView === "postman"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground hover:bg-muted",
						)}
					>
						<Terminal size={12} />
					</button>
				</div>
			</div>
			{activeView === "browser" && <BrowserViewer server={server} />}
			{activeView === "postman" && <PostmanTool server={server} />}
		</div>
	);
};

// ---------------------------------------------------------------------------
// SandboxServersPanel (public)
// ---------------------------------------------------------------------------

interface SandboxServersPanelProps {
	servers: SandboxServerInfo[];
	onRefresh: () => void;
}

export const SandboxServersPanel: React.FC<SandboxServersPanelProps> = ({
	servers,
	onRefresh,
}) => {
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(false);

	if (servers.length === 0) return null;

	return (
		<div
			className={cn(
				"flex-shrink-0 border-r bg-background flex flex-col transition-all duration-200 ease-in-out",
				collapsed ? "w-10" : "w-72",
			)}
		>
			{/* Header */}
			<div className="flex items-center gap-1 px-2 py-2 border-b bg-muted/20 flex-shrink-0">
				<Server size={13} className="shrink-0 text-muted-foreground" />
				{!collapsed && (
					<>
						<span className="text-xs font-semibold flex-1 truncate">
							{t("sandboxPanel.title")}
						</span>
						<button
							type="button"
							title={t("sandboxPanel.refresh")}
							onClick={onRefresh}
							className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
						>
							<RefreshCw size={11} />
						</button>
					</>
				)}
				{collapsed && (
					<span className="text-[10px] font-bold text-muted-foreground leading-none">
						{servers.length}
					</span>
				)}
				<button
					type="button"
					onClick={() => setCollapsed((v) => !v)}
					className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground ml-auto"
					title={
						collapsed ? t("sandboxPanel.expand") : t("sandboxPanel.collapse")
					}
				>
					{collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
				</button>
			</div>

			{/* Server list */}
			{!collapsed && (
				<div className="flex-1 overflow-y-auto p-2 space-y-2">
					{servers.map((server) => (
						<ServerCard key={server.port} server={server} />
					))}
				</div>
			)}
		</div>
	);
};
