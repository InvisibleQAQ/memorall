import React from "react";
import { useTranslation } from "react-i18next";
import {
  Globe,
  ExternalLink,
} from "lucide-react";
import type { ActionRenderer, MessageActionItem } from "@/main/modules/chat/components/types";

interface WebAccessPayload {
  url: string;
  requestedUrl?: string;
  html?: string;
  status?: number;
  ok?: boolean;
  contentType?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFrameableUrl = (value: string): boolean => {
  if (value.startsWith("/__virtual__/")) return true;
  try {
    const parsed = new URL(
      value,
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost",
    );
    return (
      parsed.protocol === "http:" ||
      parsed.protocol === "https:" ||
      parsed.protocol === "chrome-extension:"
    );
  } catch {
    return false;
  }
};

const normalizePreviewUrl = (rawUrl: string): string => {
  if (rawUrl.startsWith("/__virtual__/")) {
    return /\/$/.test(rawUrl) ? rawUrl : `${rawUrl}/`;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname.startsWith("/__virtual__/")) {
      const normalizedPath = /\/$/.test(parsed.pathname)
        ? parsed.pathname
        : `${parsed.pathname}/`;
      return `${normalizedPath}${parsed.search}${parsed.hash}`;
    }
    if (parsed.hostname === "0.0.0.0" || parsed.hostname === "::") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const extractWebAccessPayload = (
  item: MessageActionItem,
): WebAccessPayload | null => {
  const fromMetadata = item.metadata;
  if (fromMetadata && typeof fromMetadata.url === "string") {
    return {
      requestedUrl:
        typeof fromMetadata.requestedUrl === "string"
          ? fromMetadata.requestedUrl
          : undefined,
      url: fromMetadata.url,
      html:
        typeof fromMetadata.html === "string" ? fromMetadata.html : undefined,
      status:
        typeof fromMetadata.status === "number"
          ? fromMetadata.status
          : undefined,
      ok: typeof fromMetadata.ok === "boolean" ? fromMetadata.ok : undefined,
      contentType:
        typeof fromMetadata.contentType === "string"
          ? fromMetadata.contentType
          : undefined,
    };
  }

  try {
    const parsed = JSON.parse(item.description);
    if (!isRecord(parsed) || typeof parsed.url !== "string") {
      return null;
    }
    return {
      requestedUrl:
        typeof parsed.requestedUrl === "string"
          ? parsed.requestedUrl
          : undefined,
      url: parsed.url,
      html: typeof parsed.html === "string" ? parsed.html : undefined,
      status: typeof parsed.status === "number" ? parsed.status : undefined,
      ok: typeof parsed.ok === "boolean" ? parsed.ok : undefined,
      contentType:
        typeof parsed.contentType === "string" ? parsed.contentType : undefined,
    };
  } catch {
    return null;
  }
};

const WebAccessPreview: React.FC<{ payload: WebAccessPayload }> = ({
  payload,
}) => {
  const { t } = useTranslation("chat");
  const previewUrl = normalizePreviewUrl(payload.url);
  const canFrameUrl = isFrameableUrl(previewUrl);
  const htmlPreview = payload.html?.trim() || "";

  return (
    <div className="w-full rounded-lg border border-border/60 overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 text-xs font-mono truncate">{previewUrl}</div>
        {typeof payload.status === "number" ? (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded border ${
              payload.ok
                ? "text-green-600 border-green-600/30 bg-green-600/10"
                : "text-red-600 border-red-600/30 bg-red-600/10"
            }`}
          >
            {payload.status}
          </span>
        ) : null}
        <button
          type="button"
          title="Open in new tab"
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => {
            const url = previewUrl.startsWith("/")
              ? chrome.runtime.getURL(previewUrl.replace(/^\//, ""))
              : previewUrl;
            chrome.tabs.create({ url });
          }}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>
      {htmlPreview ? (
        <iframe
          title={t("actions.webAccess.htmlIframeTitle", {
            defaultValue: "Web access HTML preview",
          })}
          srcDoc={htmlPreview}
          className="w-full h-[360px] bg-white"
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
        />
      ) : canFrameUrl ? (
        <iframe
          title={t("actions.webAccess.iframeTitle", {
            defaultValue: "Web access preview: {{url}}",
            url: payload.url,
          })}
          src={previewUrl}
          className="w-full h-[360px] bg-white"
          sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-presentation allow-same-origin allow-scripts"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          {t("actions.webAccess.emptyPreview", {
            defaultValue: "No renderable URL/HTML found for web preview.",
          })}
        </div>
      )}
      {htmlPreview ? (
        <details className="border-t border-border/60">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            {t("actions.webAccess.htmlSourcePreview", {
              defaultValue: "HTML source preview",
            })}
          </summary>
          <pre className="max-h-64 overflow-auto p-3 text-xs whitespace-pre-wrap break-all bg-muted/20 border-t border-border/60">
            {htmlPreview}
          </pre>
        </details>
      ) : null}
    </div>
  );
};

export const webAccessRenderer: ActionRenderer = (item, isOpen) => {
  if (!isOpen) return null;
  const payload = extractWebAccessPayload(item);
  if (!payload) {
    return (
      <div className="w-full overflow-hidden whitespace-pre-wrap break-words">
        {item.description}
      </div>
    );
  }
  return <WebAccessPreview payload={payload} />;
};

