export const ABORT_ERROR_MESSAGE = "Operation aborted";

export const isAbortError = (error: unknown): boolean => {
	if (error instanceof DOMException && error.name === "AbortError") return true;
	if (error instanceof Error) {
		return error.name === "AbortError" || error.message === ABORT_ERROR_MESSAGE;
	}
	return false;
};
