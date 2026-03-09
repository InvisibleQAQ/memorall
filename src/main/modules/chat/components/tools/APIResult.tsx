import React from "react";
import { useTranslation } from "react-i18next";
import {
  Database,
} from "lucide-react";
import type { ActionRenderer } from "@/main/modules/chat/components/types";

export interface MessageActionItem {
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

interface ApiResultPayload {
  url: string;
  method?: string;
  path?: string;
  status?: number;
  ok?: boolean;
  contentType?: string;
  responseType?: string;
  body?: string;
}


const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractApiResultPayload = (
  item: MessageActionItem,
): ApiResultPayload | null => {
  const fromMetadata = item.metadata;
  if (fromMetadata && typeof fromMetadata.url === "string") {
    return {
      url: fromMetadata.url,
      method:
        typeof fromMetadata.method === "string"
          ? fromMetadata.method
          : undefined,
      path:
        typeof fromMetadata.path === "string" ? fromMetadata.path : undefined,
      status:
        typeof fromMetadata.status === "number"
          ? fromMetadata.status
          : undefined,
      ok: typeof fromMetadata.ok === "boolean" ? fromMetadata.ok : undefined,
      contentType:
        typeof fromMetadata.contentType === "string"
          ? fromMetadata.contentType
          : undefined,
      responseType:
        typeof fromMetadata.responseType === "string"
          ? fromMetadata.responseType
          : undefined,
      body:
        typeof fromMetadata.body === "string" ? fromMetadata.body : undefined,
    };
  }

  try {
    const parsed = JSON.parse(item.description);
    if (!isRecord(parsed) || typeof parsed.url !== "string") {
      return null;
    }
    return {
      url: parsed.url,
      method: typeof parsed.method === "string" ? parsed.method : undefined,
      path: typeof parsed.path === "string" ? parsed.path : undefined,
      status: typeof parsed.status === "number" ? parsed.status : undefined,
      ok: typeof parsed.ok === "boolean" ? parsed.ok : undefined,
      contentType:
        typeof parsed.contentType === "string" ? parsed.contentType : undefined,
      responseType:
        typeof parsed.responseType === "string"
          ? parsed.responseType
          : undefined,
      body: typeof parsed.body === "string" ? parsed.body : undefined,
    };
  } catch {
    return null;
  }
};

const ApiResultPreview: React.FC<{ payload: ApiResultPayload }> = ({
  payload,
}) => {
  const { t } = useTranslation("chat");

  return (
    <div className="w-full rounded-lg border border-border/60 overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/30 text-xs">
        <Database className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="font-mono">{payload.method ?? "GET"}</span>
        <span className="font-mono truncate">
          {payload.path ?? payload.url}
        </span>
        {typeof payload.status === "number" ? (
          <span
            className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
              payload.ok
                ? "text-green-600 border-green-600/30 bg-green-600/10"
                : "text-red-600 border-red-600/30 bg-red-600/10"
            }`}
          >
            {payload.status}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/60">
        <div className="font-mono break-all">{payload.url}</div>
        {payload.contentType ? (
          <div>
            {t("actions.apiResult.contentType", {
              defaultValue: "content-type",
            })}
            : {payload.contentType}
          </div>
        ) : null}
        {payload.responseType ? (
          <div>
            {t("actions.apiResult.responseType", {
              defaultValue: "response-type",
            })}
            : {payload.responseType}
          </div>
        ) : null}
      </div>
      <pre className="max-h-72 overflow-auto p-3 text-xs whitespace-pre-wrap break-all bg-muted/20">
        {payload.body ||
          t("actions.apiResult.emptyBody", { defaultValue: "(empty body)" })}
      </pre>
    </div>
  );
};

export const apiResultRenderer: ActionRenderer = (item, isOpen) => {
  if (!isOpen) return null;
  const payload = extractApiResultPayload(item);
  if (!payload) {
    return (
      <div className="w-full overflow-hidden whitespace-pre-wrap break-words">
        {item.description}
      </div>
    );
  }
  return <ApiResultPreview payload={payload} />;
};
