import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmbeddedContextItem } from "@/embedded/types";

export const useEmbeddedContextAttachments = (
	contextOptions?: EmbeddedContextItem[],
) => {
	const initialContextOptions = useMemo(
		() => contextOptions ?? [],
		[contextOptions],
	);
	const initialContextOptionMap = useMemo(
		() =>
			new Map(
				initialContextOptions.map((contextItem) => [
					contextItem.id,
					contextItem,
				]),
			),
		[initialContextOptions],
	);
	const initialContextOrder = useMemo(
		() =>
			new Map(
				initialContextOptions.map((contextItem, index) => [
					contextItem.id,
					index,
				]),
			),
		[initialContextOptions],
	);

	const [availableContexts, setAvailableContexts] = useState<
		EmbeddedContextItem[]
	>(initialContextOptions);
	const [attachedContexts, setAttachedContexts] = useState<
		EmbeddedContextItem[]
	>([]);
	const [showContextSection, setShowContextSection] = useState(false);

	const restoreAvailableContext = useCallback(
		(itemId: string, currentAvailable: EmbeddedContextItem[]) => {
			const originalItem = initialContextOptionMap.get(itemId);
			if (!originalItem) {
				return currentAvailable;
			}

			const nextAvailable = [...currentAvailable, originalItem];
			nextAvailable.sort((left, right) => {
				const leftIndex =
					initialContextOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER;
				const rightIndex =
					initialContextOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER;
				return leftIndex - rightIndex;
			});
			return nextAvailable;
		},
		[initialContextOptionMap, initialContextOrder],
	);

	const resetContexts = useCallback(
		(showSection?: boolean) => {
			setAttachedContexts([]);
			setAvailableContexts(initialContextOptions);
			if (typeof showSection === "boolean") {
				setShowContextSection(showSection);
			}
		},
		[initialContextOptions],
	);

	const attachContext = useCallback((contextItem: EmbeddedContextItem) => {
		setAvailableContexts((prev) =>
			prev.filter((availableItem) => availableItem.id !== contextItem.id),
		);
		setAttachedContexts((prev) => [...prev, contextItem]);
		setShowContextSection(false);
	}, []);

	const attachSmartContext = useCallback((contextItem: EmbeddedContextItem) => {
		setAttachedContexts((prev) => [...prev, contextItem]);
		setShowContextSection(false);
	}, []);

	const removeAttachedContext = useCallback(
		(itemId: string) => {
			setAttachedContexts((prev) =>
				prev.filter((contextItem) => contextItem.id !== itemId),
			);

			if (!initialContextOptionMap.has(itemId)) {
				return;
			}

			setAvailableContexts((prev) => restoreAvailableContext(itemId, prev));
		},
		[initialContextOptionMap, restoreAvailableContext],
	);

	const clearAttachedContexts = useCallback(() => {
		resetContexts(false);
	}, [resetContexts]);

	const toggleContextSection = useCallback(() => {
		setShowContextSection((prev) => !prev);
	}, []);

	useEffect(() => {
		const preattachedContexts = initialContextOptions.filter(
			(contextItem) => contextItem.kind === "selected_image",
		);
		if (preattachedContexts.length > 0) {
			setAttachedContexts(preattachedContexts);
			setAvailableContexts(
				initialContextOptions.filter(
					(contextItem) => contextItem.kind !== "selected_image",
				),
			);
			setShowContextSection(false);
			return;
		}

		resetContexts(false);
	}, [initialContextOptions, resetContexts]);

	return {
		initialContextOptions,
		availableContexts,
		attachedContexts,
		showContextSection,
		setShowContextSection,
		attachContext,
		attachSmartContext,
		removeAttachedContext,
		clearAttachedContexts,
		resetContexts,
		toggleContextSection,
	};
};
