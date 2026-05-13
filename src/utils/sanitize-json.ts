export function sanitizeForJson(value: unknown, seen = new WeakSet()): unknown {
	if (value === undefined || value === null) return null;

	const type = typeof value;
	if (type === "string" || type === "number" || type === "boolean") {
		return value;
	}
	if (type === "bigint") return (value as bigint).toString();
	if (type === "function" || type === "symbol") return null;
	if (value instanceof Date) return value.toISOString();

	if (Array.isArray(value)) {
		return value.map((item) => sanitizeForJson(item, seen));
	}

	if (type === "object") {
		if (seen.has(value as object)) return null;
		seen.add(value as object);
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(
			value as Record<string, unknown>,
		)) {
			result[key] = sanitizeForJson(item, seen);
		}
		return result;
	}

	return null;
}
