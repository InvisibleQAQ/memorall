import type { useTranslation } from "react-i18next";
import type {
	SandboxCommandInfo,
	SandboxServerInfo,
} from "@/services/sandbox-container";
import type { ActiveWebSessionInfo } from "@/services/web-browser";

export type RuntimeSessionsVariant = "docked" | "compact";

export interface RuntimeSessionsSharedProps {
	commands: SandboxCommandInfo[];
	servers: SandboxServerInfo[];
	activeWebSession?: ActiveWebSessionInfo;
	onRefresh: () => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// SW relay types (mirrors WebAccess.tsx)
// ---------------------------------------------------------------------------

export interface SwRelayRequestMessage {
	type: "sw-relay-request";
	id: number;
	portNum: number;
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: ArrayBuffer | null;
}

export const isSwRelayRequestMessage = (
	v: unknown,
): v is SwRelayRequestMessage => {
	if (typeof v !== "object" || v === null) return false;
	const r = v as Record<string, unknown>;
	return (
		r.type === "sw-relay-request" &&
		typeof r.id === "number" &&
		typeof r.portNum === "number" &&
		typeof r.method === "string"
	);
};

export type { SandboxCommandInfo, SandboxServerInfo, ActiveWebSessionInfo };
export type TranslationFn = ReturnType<typeof useTranslation>["t"];
