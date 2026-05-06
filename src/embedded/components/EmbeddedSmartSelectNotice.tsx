import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";

export const EmbeddedSmartSelectNotice = () => {
	const t = useEmbeddedTranslation("contextSection");
	return (
		<div className="px-3 py-3">
			<div className="rounded-xl border bg-background/90 px-3 py-3 shadow-sm">
				<div className="text-base font-semibold text-foreground">
					{t("smartSelect")}
				</div>
				<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
					{t("smartSelectInstruction")}
				</p>
			</div>
		</div>
	);
};
