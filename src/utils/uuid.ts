import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdef";
const segmentLengths = [8, 4, 4, 4, 12];

export function v4() {
	const uuid = segmentLengths
		.map((length) => customAlphabet(alphabet, length)())
		.join("-");
	return uuid;
}

export function isUuid(uuid: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		uuid,
	);
}
