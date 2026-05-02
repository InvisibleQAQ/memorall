import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Code2, Save, Check, ExternalLink } from "lucide-react";
import { serviceManager } from "@/services";
import type { SandboxHandleSwRequestResult } from "@/services/sandbox-container";
import { logError } from "@/utils/logger";
import { DocumentSaveFolderDialog } from "../DocumentSaveFolderDialog";
import type { ArtifactType } from "./artifact-protocol";

interface ArtifactProps {
	content: string;
	identifier?: string;
	title?: string;
}

type SaveState = "idle" | "saving" | "saved";

interface VirtualSandboxLocation {
	port: number;
	path: string;
}

interface SwRelayRequestMessage {
	type: "sw-relay-request";
	id: number;
	portNum: number;
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: ArrayBuffer | null;
}

interface SwRelayResponseMessage {
	type: "sw-relay-response";
	id: number;
	data?: SandboxHandleSwRequestResult;
	error?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isSwRelayRequestMessage = (
	value: unknown,
): value is SwRelayRequestMessage => {
	if (!isRecord(value)) {
		return false;
	}

	return (
		value.type === "sw-relay-request" &&
		typeof value.id === "number" &&
		typeof value.portNum === "number" &&
		typeof value.method === "string" &&
		typeof value.url === "string"
	);
};

const toUrl = (rawUrl: string): URL | null => {
	try {
		return new URL(
			rawUrl,
			typeof window !== "undefined"
				? window.location.origin
				: "http://localhost",
		);
	} catch {
		return null;
	}
};

const getVirtualSandboxLocation = (
	rawUrl: string,
): VirtualSandboxLocation | null => {
	const parsed = toUrl(rawUrl);
	if (!parsed) {
		return null;
	}

	const virtualMatch = parsed.pathname.match(/^\/__virtual__\/(\d+)(\/.*)?$/);
	if (virtualMatch) {
		return {
			port: Number(virtualMatch[1]),
			path: `${virtualMatch[2] || "/"}${parsed.search}`,
		};
	}

	if (parsed.pathname.endsWith("/sandbox/pages/renderer.html")) {
		const port = Number(parsed.searchParams.get("port"));
		if (!Number.isFinite(port)) {
			return null;
		}
		return {
			port,
			path: parsed.searchParams.get("path") || "/",
		};
	}

	return null;
};

const isFrameableUrl = (rawUrl: string): boolean => {
	const parsed = toUrl(rawUrl);
	if (!parsed) {
		return false;
	}

	return (
		parsed.protocol === "http:" ||
		parsed.protocol === "https:" ||
		parsed.protocol === "chrome-extension:"
	);
};

const toSafeFileName = (value?: string) => {
	const name = (value?.trim() || "artifact")
		.replace(/[^a-z0-9._-]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);

	return name || "artifact";
};

const ArtifactHeader: React.FC<{
	icon: React.ReactNode;
	label: string;
	title?: string;
	actions?: React.ReactNode;
}> = ({ icon, label, title, actions }) => (
	<div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 bg-muted/30">
		<div className="flex min-w-0 items-center gap-2">
			<span className="shrink-0 text-muted-foreground">{icon}</span>
			<span className="truncate text-xs text-muted-foreground">
				{title || label}
			</span>
		</div>
		{actions ? (
			<div className="flex shrink-0 items-center gap-1">{actions}</div>
		) : null}
	</div>
);

const HtmlArtifact: React.FC<ArtifactProps> = ({
	content,
	identifier,
	title,
}) => {
	const [saveState, setSaveState] = useState<SaveState>("idle");
	const [saveDialogOpen, setSaveDialogOpen] = useState(false);
	const { t } = useTranslation("chat");

	const handleSave = () => {
		if (saveState !== "idle") return;
		setSaveDialogOpen(true);
	};

	return (
		<div className="rounded-md overflow-hidden border border-border my-2">
			<ArtifactHeader
				icon={<Code2 size={13} />}
				label={t("htmlPreview.label")}
				title={title}
				actions={
					<button
						type="button"
						onClick={handleSave}
						disabled={saveState !== "idle"}
						className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/50 disabled:opacity-60"
					>
						{saveState === "saved" ? (
							<>
								<Check className="w-3 h-3" /> {t("htmlPreview.saved")}
							</>
						) : (
							<>
								<Save className="w-3 h-3" />{" "}
								{saveState === "saving"
									? t("htmlPreview.saving")
									: t("htmlPreview.save")}
							</>
						)}
					</button>
				}
			/>
			<DocumentSaveFolderDialog
				open={saveDialogOpen}
				content={content}
				initialFileName={`${toSafeFileName(identifier || title)}-${Date.now()}.html`}
				mimeType="text/html"
				onOpenChange={setSaveDialogOpen}
				onSaved={() => {
					setSaveState("saved");
					setTimeout(() => setSaveState("idle"), 2000);
				}}
				onError={(err) => {
					logError("Failed to save artifact HTML to documents:", err);
					setSaveState("idle");
				}}
			/>
			<iframe
				srcDoc={content}
				sandbox="allow-scripts allow-same-origin"
				className="w-full bg-white"
				style={{ height: "60vh", border: "none" }}
				title={title || "HTML Preview"}
			/>
		</div>
	);
};

const UrlArtifact: React.FC<ArtifactProps> = ({ content, title }) => {
	const url = content.trim();
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const virtualLocation = useMemo(() => getVirtualSandboxLocation(url), [url]);
	const [renderUrl, setRenderUrl] = useState<string | null>(null);
	const iframeSrc = virtualLocation
		? renderUrl
		: isFrameableUrl(url)
			? url
			: null;

	useEffect(() => {
		let cancelled = false;

		const resolveSandboxRenderUrl = async (): Promise<void> => {
			if (!virtualLocation) {
				setRenderUrl(null);
				return;
			}

			try {
				const result = await serviceManager
					.getSandboxContainerService()
					.getServerRenderUrl({
						port: virtualLocation.port,
						path: virtualLocation.path,
					});
				if (!cancelled) {
					setRenderUrl(result.url);
				}
			} catch (error) {
				logError("Failed to resolve sandbox artifact render URL:", error);
				if (!cancelled) {
					setRenderUrl(null);
				}
			}
		};

		void resolveSandboxRenderUrl();

		return () => {
			cancelled = true;
		};
	}, [virtualLocation]);

	useEffect(() => {
		if (!virtualLocation || !iframeSrc) {
			return;
		}

		const onMessage = (event: MessageEvent<unknown>): void => {
			if (event.source !== iframeRef.current?.contentWindow) {
				return;
			}
			if (!isSwRelayRequestMessage(event.data)) {
				return;
			}

			const message = event.data;
			void serviceManager
				.getSandboxContainerService()
				.handleSwRequestWithRetry({
					id: message.id,
					port: message.portNum,
					method: message.method,
					path: message.url,
					headers: message.headers ?? {},
					body: message.body ?? null,
				})
				.then((result) => {
					const response: SwRelayResponseMessage = {
						type: "sw-relay-response",
						id: message.id,
						data: result,
					};
					iframeRef.current?.contentWindow?.postMessage(response, "*");
				})
				.catch((error: unknown) => {
					const response: SwRelayResponseMessage = {
						type: "sw-relay-response",
						id: message.id,
						error: error instanceof Error ? error.message : String(error),
					};
					iframeRef.current?.contentWindow?.postMessage(response, "*");
				});
		};

		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [iframeSrc, virtualLocation]);

	const openInTab = () => {
		if (!iframeSrc) return;
		const tabUrl = iframeSrc.startsWith("/")
			? chrome.runtime.getURL(iframeSrc.replace(/^\//, ""))
			: iframeSrc;
		chrome.tabs.create({ url: tabUrl });
	};

	return (
		<div className="rounded-md overflow-hidden border border-border my-2">
			<ArtifactHeader
				icon={<Globe size={13} />}
				label={url}
				title={title}
				actions={
					iframeSrc ? (
						<button
							type="button"
							title="Open in new tab"
							onClick={openInTab}
							className="inline-flex items-center justify-center rounded border border-border/50 bg-muted/80 p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							<ExternalLink className="w-3 h-3" />
						</button>
					) : null
				}
			/>
			{iframeSrc ? (
				<iframe
					ref={iframeRef}
					src={iframeSrc}
					className="w-full bg-white"
					style={{ height: "60vh", border: "none" }}
					title={title || url}
					sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
					referrerPolicy="no-referrer"
				/>
			) : virtualLocation ? (
				<div className="px-3 py-4 text-sm text-muted-foreground">
					Resolving sandbox preview...
				</div>
			) : (
				<div className="px-3 py-4 text-sm text-muted-foreground">
					Unsupported artifact URL: {url}
				</div>
			)}
		</div>
	);
};

interface ArtifactRendererProps {
	type: ArtifactType;
	content: string;
	identifier?: string;
	title?: string;
}

export const ArtifactRenderer: React.FC<ArtifactRendererProps> = ({
	type,
	content,
	identifier,
	title,
}) => {
	switch (type) {
		case "html":
			return (
				<HtmlArtifact content={content} identifier={identifier} title={title} />
			);
		case "url":
			return <UrlArtifact content={content} title={title} />;
		default:
			return null;
	}
};
