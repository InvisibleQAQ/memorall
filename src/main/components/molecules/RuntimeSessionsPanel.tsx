import React, { useEffect, useRef, useState } from "react";
import {
	ChevronLeft,
	ChevronRight,
	Loader2,
	ExternalLink,
	Globe,
	Power,
	RefreshCw,
	Send,
	Server,
	Terminal,
	RotateCw,
	X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { serviceManager } from "@/services";
import type {
	SandboxServerInfo,
	SandboxServerRequestResult,
} from "@/services/sandbox-container";
import type { ActiveWebSessionInfo } from "@/services/web-browser";
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

const formatSessionTime = (value?: number): string | null => {
	if (!value) {
		return null;
	}

	return new Date(value).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
};

const RuntimeSummaryTile: React.FC<{
	icon: React.ReactNode;
	value: number | string;
	label: string;
}> = ({ icon, value, label }) => (
	<div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border/70 bg-muted/30 px-2 py-2 text-center">
		<div className="text-muted-foreground">{icon}</div>
		<div className="text-sm font-semibold leading-none text-foreground">
			{value}
		</div>
		<div className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
			{label}
		</div>
	</div>
);

const ActionIconButton: React.FC<{
	title: string;
	onClick: () => void;
	icon: React.ReactNode;
	disabled?: boolean;
	variant?: "default" | "danger";
}> = ({ title, onClick, icon, disabled = false, variant = "default" }) => (
	<button
		type="button"
		title={title}
		onClick={onClick}
		disabled={disabled}
		className={cn(
			"inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
			variant === "danger"
				? "border-transparent hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
				: "border-transparent hover:border-border hover:bg-muted/80 hover:text-foreground",
		)}
	>
		{icon}
	</button>
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

const ServerCard: React.FC<{
	server: SandboxServerInfo;
	onChanged: () => void;
}> = ({ server, onChanged }) => {
	const { t } = useTranslation();
	const [activeView, setActiveView] = useState<ActiveView>(null);
	const [isRestarting, setIsRestarting] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const toggle = (view: "browser" | "postman") =>
		setActiveView((prev) => (prev === view ? null : view));

	const openServerUrl = () => {
		chrome.tabs.create({ url: server.url });
	};

	const handleRestart = async () => {
		setIsRestarting(true);
		setActionError(null);
		try {
			await serviceManager.getSandboxContainerService().startServer({
				kind: server.kind,
				port: server.port,
				rootDir: server.rootDir,
				autoInstall: false,
			});
			onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsRestarting(false);
		}
	};

	const handleStop = async () => {
		setIsStopping(true);
		setActionError(null);
		try {
			await serviceManager
				.getSandboxContainerService()
				.stopServer({ port: server.port });
			onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsStopping(false);
		}
	};

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
					<ActionIconButton
						title={t("sandboxPanel.openInTab")}
						onClick={openServerUrl}
						icon={<ExternalLink size={14} />}
					/>
					<ActionIconButton
						title={t("sandboxPanel.restartServer")}
						onClick={() => void handleRestart()}
						disabled={isRestarting || isStopping}
						icon={
							isRestarting ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<RotateCw size={14} />
							)
						}
					/>
					<ActionIconButton
						title={t("sandboxPanel.stopServer")}
						onClick={() => void handleStop()}
						disabled={isRestarting || isStopping}
						variant="danger"
						icon={
							isStopping ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<Power size={14} />
							)
						}
					/>
					<button
						type="button"
						title={t("sandboxPanel.browser")}
						onClick={() => toggle("browser")}
						className={cn(
							"inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-transparent transition-colors",
							activeView === "browser"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:border-border",
						)}
					>
						<Globe size={14} />
					</button>
					<button
						type="button"
						title={t("sandboxPanel.api")}
						onClick={() => toggle("postman")}
						className={cn(
							"inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-transparent transition-colors",
							activeView === "postman"
								? "bg-primary text-primary-foreground shadow-sm"
								: "text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:border-border",
						)}
					>
						<Terminal size={14} />
					</button>
				</div>
			</div>
			{actionError ? (
				<div className="border-t border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
					{actionError}
				</div>
			) : null}
			{activeView === "browser" && <BrowserViewer server={server} />}
			{activeView === "postman" && <PostmanTool server={server} />}
		</div>
	);
};

const WebBrowserSessionCard: React.FC<{
	session: ActiveWebSessionInfo;
	onChanged: () => void;
}> = ({ session, onChanged }) => {
	const { t } = useTranslation();
	const [urlInput, setUrlInput] = useState(session.currentUrl ?? "");
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [isNavigating, setIsNavigating] = useState(false);
	const [isClosing, setIsClosing] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	if (!session.isOpen) {
		return null;
	}

	useEffect(() => {
		setUrlInput(session.currentUrl ?? "");
	}, [session.currentUrl]);

	const openInTab = () => {
		if (!session.currentUrl) {
			return;
		}
		chrome.tabs.create({ url: session.currentUrl });
	};

	const lastAccessed = formatSessionTime(session.lastAccessedAt);
	const createdAt = formatSessionTime(session.createdAt);
	const actionBusy = isRefreshing || isNavigating || isClosing;

	const handleRefresh = async () => {
		if (!session.sessionId) {
			return;
		}
		setIsRefreshing(true);
		setActionError(null);
		try {
			await serviceManager
				.getWebBrowserService()
				.refreshSession({ sessionId: session.sessionId });
			onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleNavigate = async () => {
		const nextUrl = urlInput.trim();
		if (!nextUrl) {
			return;
		}
		setIsNavigating(true);
		setActionError(null);
		try {
			await serviceManager.getWebBrowserService().openSession({
				url: nextUrl,
				persist: true,
				mode: session.mode,
			});
			onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsNavigating(false);
		}
	};

	const handleClose = async () => {
		if (!session.sessionId) {
			return;
		}
		setIsClosing(true);
		setActionError(null);
		try {
			await serviceManager
				.getWebBrowserService()
				.closeSession(session.sessionId);
			onChanged();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsClosing(false);
		}
	};

	return (
		<div className="border border-border rounded-md overflow-hidden">
			<div className="flex items-center gap-2 px-2 py-2 bg-muted/20">
				<span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
					<Globe size={11} />
					{session.mode || "iframe"}
				</span>
				<span className="text-xs font-medium truncate flex-1">
					{session.title || t("sandboxPanel.webSessionUntitled")}
				</span>
				<div className="flex items-center gap-1">
					<ActionIconButton
						title={t("sandboxPanel.openInTab")}
						onClick={openInTab}
						disabled={actionBusy}
						icon={<ExternalLink size={14} />}
					/>
					<ActionIconButton
						title={t("sandboxPanel.refreshSession")}
						onClick={() => void handleRefresh()}
						disabled={actionBusy}
						icon={
							isRefreshing ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<RefreshCw size={14} />
							)
						}
					/>
					<ActionIconButton
						title={t("sandboxPanel.closeSession")}
						onClick={() => void handleClose()}
						disabled={actionBusy}
						variant="danger"
						icon={
							isClosing ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								<X size={14} />
							)
						}
					/>
				</div>
			</div>
			<div className="space-y-2 p-2">
				<div className="flex gap-1">
					<input
						type="text"
						value={urlInput}
						onChange={(e) => setUrlInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && void handleNavigate()}
						placeholder={t("sandboxPanel.urlPlaceholder")}
						className="flex-1 min-w-0 rounded border border-border bg-background px-2 py-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<button
						type="button"
						onClick={() => void handleNavigate()}
						disabled={actionBusy || !urlInput.trim()}
						className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground transition-opacity disabled:opacity-50"
					>
						{isNavigating ? (
							<Loader2 size={13} className="animate-spin" />
						) : (
							<Send size={13} />
						)}
						<span>{t("sandboxPanel.go")}</span>
					</button>
				</div>
				<div className="space-y-1">
					<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
						{t("sandboxPanel.webSessionCurrentUrl")}
					</div>
					<div
						className="break-all rounded bg-muted px-2 py-1 text-[11px] font-mono text-muted-foreground"
						title={session.currentUrl}
					>
						{session.currentUrl}
					</div>
				</div>
				{session.requestedUrl && session.requestedUrl !== session.currentUrl ? (
					<div className="space-y-1">
						<div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							{t("sandboxPanel.webSessionRequestedUrl")}
						</div>
						<div
							className="break-all rounded bg-muted/60 px-2 py-1 text-[11px] font-mono text-muted-foreground"
							title={session.requestedUrl}
						>
							{session.requestedUrl}
						</div>
					</div>
				) : null}
				<div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
					<span>{`sessionId: ${session.sessionId}`}</span>
					{lastAccessed ? (
						<span>{`${t("sandboxPanel.webSessionLastAccessed")}: ${lastAccessed}`}</span>
					) : null}
					{createdAt ? (
						<span>{`${t("sandboxPanel.webSessionCreatedAt")}: ${createdAt}`}</span>
					) : null}
				</div>
				{actionError ? (
					<div className="rounded border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
						{actionError}
					</div>
				) : null}
			</div>
		</div>
	);
};

// ---------------------------------------------------------------------------
// RuntimeSessionsPanel (public)
// ---------------------------------------------------------------------------

interface RuntimeSessionsPanelProps {
	servers: SandboxServerInfo[];
	activeWebSession?: ActiveWebSessionInfo;
	onRefresh: () => void;
}

export const RuntimeSessionsPanel: React.FC<RuntimeSessionsPanelProps> = ({
	servers,
	activeWebSession,
	onRefresh,
}) => {
	const { t } = useTranslation();
	const [collapsed, setCollapsed] = useState(false);
	const hasWebSession = Boolean(activeWebSession?.isOpen);
	const itemCount = servers.length + (hasWebSession ? 1 : 0);

	if (itemCount === 0) return null;

	return (
		<div
			className={cn(
				"flex-shrink-0 transition-all duration-200 ease-in-out",
				collapsed ? "w-16" : "w-80",
			)}
		>
			<div className="flex h-full flex-col border-r bg-background">
				{/* Header */}
				<div
					className={cn(
						"border-b bg-muted/20 flex-shrink-0",
						collapsed
							? "flex items-center justify-center px-2 py-2"
							: "flex items-center gap-2 px-2 py-2",
					)}
				>
					{collapsed ? (
						<button
							type="button"
							onClick={() => setCollapsed(false)}
							className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							title={t("sandboxPanel.expand")}
							aria-label={t("sandboxPanel.expand")}
						>
							<ChevronRight size={18} />
						</button>
					) : (
						<>
							<div className="flex items-center gap-2 text-muted-foreground min-w-0">
								<Server size={13} className="shrink-0" />
								<span className="text-xs font-semibold text-foreground truncate">
									{t("sandboxPanel.title")}
								</span>
							</div>
							<div className="ml-auto flex items-center gap-1">
								<button
									type="button"
									title={t("sandboxPanel.refresh")}
									onClick={onRefresh}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									<RefreshCw size={14} />
								</button>
								<button
									type="button"
									onClick={() => setCollapsed(true)}
									className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									title={t("sandboxPanel.collapse")}
									aria-label={t("sandboxPanel.collapse")}
								>
									<ChevronLeft size={18} />
								</button>
							</div>
						</>
					)}
				</div>

				{collapsed ? (
					<div className="flex-1 space-y-3 px-2 py-3">
						{hasWebSession ? (
							<RuntimeSummaryTile
								icon={<Globe size={14} />}
								value={1}
								label={t("sandboxPanel.webSessionShort")}
							/>
						) : null}
						{servers.length > 0 ? (
							<RuntimeSummaryTile
								icon={<Server size={14} />}
								value={servers.length}
								label={t("sandboxPanel.serversShort")}
							/>
						) : null}
					</div>
				) : null}

				{/* Server list */}
				{!collapsed && (
					<div className="flex-1 overflow-y-auto p-2 space-y-2">
						{hasWebSession ? (
							<div className="space-y-2">
								<div className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									{t("sandboxPanel.webSessionTitle")}
								</div>
								<WebBrowserSessionCard
									session={activeWebSession!}
									onChanged={onRefresh}
								/>
							</div>
						) : null}
						{servers.length > 0 ? (
							<div className="space-y-2">
								<div className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
									{t("sandboxPanel.serversTitle")}
								</div>
								{servers.map((server) => (
									<ServerCard
										key={server.port}
										server={server}
										onChanged={onRefresh}
									/>
								))}
							</div>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
};
