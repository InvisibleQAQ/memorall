import { useCallback, useEffect, useRef, useState } from "react";
import { createSmartSelectOverlay } from "@/embedded/components/SmartSelectOverlay";
import type { EmbeddedContextItem } from "@/embedded/types";

interface UseEmbeddedSmartSelectOptions {
	onAttachContext: (contextItem: EmbeddedContextItem) => void;
	onSelected?: () => void;
}

export const useEmbeddedSmartSelect = ({
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
		);
	}, [onAttachContext, onSelected]);

	return {
		isSmartSelectMode,
		startSmartSelect,
	};
};
