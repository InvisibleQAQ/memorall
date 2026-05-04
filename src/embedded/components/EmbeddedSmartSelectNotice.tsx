import type { EMBEDDED_TRANSLATIONS } from "@/embedded/language";

interface EmbeddedSmartSelectNoticeProps {
	texts: typeof EMBEDDED_TRANSLATIONS.en.contextSection;
}

export const EmbeddedSmartSelectNotice = ({
	texts,
}: EmbeddedSmartSelectNoticeProps) => (
	<div className="px-3 py-3">
		<div className="rounded-xl border bg-background/90 px-3 py-3 shadow-sm">
			<div className="text-base font-semibold text-foreground">
				{texts.smartSelect}
			</div>
			<p className="mt-1 text-sm leading-relaxed text-muted-foreground">
				{texts.smartSelectInstruction}
			</p>
		</div>
	</div>
);
