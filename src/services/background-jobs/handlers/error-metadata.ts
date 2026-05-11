export interface JobErrorMetadata {
	message: string;
	rawMessage: string;
	statusCode?: number;
	code?: string | number;
	providerName?: string | null;
	userId?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const parseEmbeddedJson = (message: string): Record<string, unknown> | null => {
	const jsonStart = message.indexOf("{");
	if (jsonStart === -1) return null;

	try {
		const parsed = JSON.parse(message.slice(jsonStart));
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
};

export const getErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

export const createJobErrorMetadata = (error: unknown): JobErrorMetadata => {
	const rawMessage = getErrorMessage(error);
	const parsed = parseEmbeddedJson(rawMessage);
	const parsedError = isRecord(parsed?.error) ? parsed.error : undefined;
	const parsedMetadata = isRecord(parsedError?.metadata)
		? parsedError.metadata
		: undefined;
	const statusMatch = rawMessage.match(/\bfailed:\s+(\d{3})\b/i);

	return {
		message:
			typeof parsedError?.message === "string"
				? parsedError.message
				: rawMessage,
		rawMessage,
		statusCode: statusMatch ? Number(statusMatch[1]) : undefined,
		code:
			typeof parsedError?.code === "string" ||
			typeof parsedError?.code === "number"
				? parsedError.code
				: undefined,
		providerName:
			typeof parsedMetadata?.provider_name === "string" ||
			parsedMetadata?.provider_name === null
				? parsedMetadata.provider_name
				: undefined,
		userId: typeof parsed?.user_id === "string" ? parsed.user_id : undefined,
	};
};
