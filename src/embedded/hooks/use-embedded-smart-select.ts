import { useCallback, useEffect, useRef, useState } from "react";
import { createSmartSelectOverlay } from "@/embedded/components/SmartSelectOverlay";
import type { EmbeddedContextItem } from "@/embedded/types";
import type { EMBEDDED_TRANSLATIONS } from "@/embedded/language";

interface UseEmbeddedSmartSelectOptions {
	texts: typeof EMBEDDED_TRANSLATIONS.en.contextSection;
	onAttachContext: (contextItem: EmbeddedContextItem) => void;
	onSelected?: () => void;
}

export const useEmbeddedSmartSelect = ({
	texts,
	onAttachContext,
	onSelected,
}: UseEmbeddedSmartSelectOptions) => {
	const smartSelectCleanupRef = useRef<(() => void) | null>(null);
	const [isSmartSelectMode, setIsSmartSelectMode] = useState(false);

	useEffect(() => {
		return () => {
			smartSelectCleanupRef.current?.();
			smartSelectCleanupRef.current = null;
		};
	}, []);

	const startSmartSelect = useCallback(() => {
		setIsSmartSelectMode(true);
		smartSelectCleanupRef.current?.();
		smartSelectCleanupRef.current = createSmartSelectOverlay(
			(contextItem) => {
				smartSelectCleanupRef.current = null;
				setIsSmartSelectMode(false);
				onAttachContext(contextItem);
				onSelected?.();
			},
			() => {
				smartSelectCleanupRef.current = null;
				setIsSmartSelectMode(false);
			},
			{
				smartSelect: texts.smartSelect,
				smartSelectInstruction: texts.smartSelectInstruction,
				smartSelectCancel: texts.smartSelectCancel,
				smartSelectChooseFormat: texts.smartSelectChooseFormat,
				smartSelectText: texts.smartSelectText,
				smartSelectCleanHtml: texts.smartSelectCleanHtml,
				smartSelectHtml: texts.smartSelectHtml,
			},
		);
	}, [onAttachContext, onSelected, texts]);

	return {
		isSmartSelectMode,
		startSmartSelect,
	};
};
