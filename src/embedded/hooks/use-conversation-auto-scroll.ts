import React, { useCallback, useRef, useState } from "react";

export const useConversationAutoScroll = () => {
	const conversationRef = useRef<HTMLDivElement>(null);
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		if (conversationRef.current) {
			conversationRef.current.scrollTo({
				top: conversationRef.current.scrollHeight,
				behavior,
			});
		}
	}, []);

	const checkIfNearBottom = useCallback(() => {
		if (!conversationRef.current) {
			return false;
		}

		const { scrollTop, scrollHeight, clientHeight } = conversationRef.current;
		const threshold = 100;
		return scrollHeight - scrollTop - clientHeight < threshold;
	}, []);

	const handleScroll = useCallback(() => {
		setShouldAutoScroll(checkIfNearBottom());
	}, [checkIfNearBottom]);

	const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
		const element = conversationRef.current;
		if (!element) {
			return;
		}

		const { scrollTop, scrollHeight, clientHeight } = element;
		const isScrollingDown = event.deltaY > 0;
		const isScrollingUp = event.deltaY < 0;
		const atTop = scrollTop === 0;
		const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

		if ((atTop && isScrollingUp) || (atBottom && isScrollingDown)) {
			event.preventDefault();
			event.stopPropagation();
		}
	}, []);

	return {
		conversationRef,
		shouldAutoScroll,
		scrollToBottom,
		handleScroll,
		handleWheel,
		setShouldAutoScroll,
	};
};
