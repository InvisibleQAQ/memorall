import type { SandboxHandleSwRequestResult } from "./types";

const EMPTY_LOCAL_BUILD_RETRY_PATH_RE =
	/(?:^\/(?:$|\?)|\/$|\.html?(?:[?#].*)?$|\.(?:css|mjs|cjs|js|jsx|ts|tsx)(?:[?#].*)?$)/i;

export const getSwResponseHeader = (
	headers: Record<string, string> | undefined,
	name: string,
): string | undefined => {
	if (!headers) return undefined;
	const target = name.toLowerCase();
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === target) {
			return value;
		}
	}
	return undefined;
};

export const hasSwTransformErrorHeader = (
	result: Pick<SandboxHandleSwRequestResult, "headers">,
): boolean => {
	const value = getSwResponseHeader(result.headers, "x-transform-error");
	return value !== undefined && value.toLowerCase() !== "false";
};

export const decodeSwResponseBodyPreview = (
	result: Pick<SandboxHandleSwRequestResult, "bodyBase64">,
	maxChars = 1200,
): string => {
	if (!result.bodyBase64) return "";
	try {
		return atob(result.bodyBase64).slice(0, maxChars);
	} catch {
		return "";
	}
};

export const delay = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const isLikelyPendingLocalBuildResponse = (
	result: Pick<
		SandboxHandleSwRequestResult,
		"statusCode" | "headers" | "bodyBase64"
	>,
	params: { method: string; path: string },
): boolean => {
	const statusCode = result.statusCode ?? 200;
	if (params.method.toUpperCase() !== "GET") {
		return false;
	}
	if (statusCode < 200 || statusCode >= 300) {
		return false;
	}
	if (result.bodyBase64 && result.bodyBase64.length > 0) {
		return false;
	}

	const contentType =
		getSwResponseHeader(result.headers, "content-type")?.toLowerCase() ?? "";
	const isBuildAssetContentType =
		contentType.includes("text/html") ||
		contentType.includes("text/css") ||
		contentType.includes("javascript") ||
		contentType.includes("typescript");

	return (
		isBuildAssetContentType || EMPTY_LOCAL_BUILD_RETRY_PATH_RE.test(params.path)
	);
};

export const getLocalBuildRetryDelayMs = (attempt: number): number =>
	Math.min(500 + attempt * 250, 2_000);
