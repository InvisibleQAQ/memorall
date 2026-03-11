import type { SandboxHandleSwRequestResult } from "./types";

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
