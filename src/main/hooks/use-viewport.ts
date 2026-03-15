import { useState, useEffect } from "react";
import { RUNTIME_PANEL_BREAKPOINT } from "@/utils/dom";

export function useIsWideViewport(): boolean {
	const [isWide, setIsWide] = useState(
		() => window.innerWidth >= RUNTIME_PANEL_BREAKPOINT,
	);

	useEffect(() => {
		const update = () =>
			setIsWide(window.innerWidth >= RUNTIME_PANEL_BREAKPOINT);
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, []);

	return isWide;
}
