import type { useTranslation } from "react-i18next";

export const translateCommonKey = (
	key: string | undefined,
	t: ReturnType<typeof useTranslation>["t"],
): string | undefined => {
	if (!key) return undefined;
	const translated = t(key, { ns: "common", defaultValue: "" });
	return translated || undefined;
};
