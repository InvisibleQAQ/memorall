import type { TranslationFn, SandboxCommandInfo } from "./types";

export const normalizePreviewUrl = (rawUrl: string): string => {
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

export const formatSessionTime = (value?: number): string | null => {
	if (!value) {
		return null;
	}

	return new Date(value).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
};

export const buildRuntimeSummaryLabel = (
	t: TranslationFn,
	commandCount: number,
	serverCount: number,
	hasWebSession: boolean,
): string => {
	const parts: string[] = [];

	if (commandCount > 0) {
		parts.push(`${commandCount} ${t("sandboxPanel.commandsShort")}`);
	}

	if (serverCount > 0) {
		parts.push(`${serverCount} ${t("sandboxPanel.serversShort")}`);
	}

	if (hasWebSession) {
		parts.push(`1 ${t("sandboxPanel.webSessionShort")}`);
	}

	return parts.join(" · ") || t("sandboxPanel.title");
};

export const getCommandStatusLabel = (
	t: TranslationFn,
	status: SandboxCommandInfo["status"],
): string => {
	switch (status) {
		case "completed":
			return t("sandboxPanel.commandCompleted");
		case "failed":
			return t("sandboxPanel.commandFailed");
		case "stopped":
			return t("sandboxPanel.commandStopped");
		default:
			return t("sandboxPanel.commandRunning");
	}
};
