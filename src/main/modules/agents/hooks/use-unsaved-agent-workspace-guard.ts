import React from "react";
import { useBeforeUnload } from "react-router-dom";
import { useTranslation } from "react-i18next";

export const useUnsavedAgentWorkspaceGuard = (hasUnsavedChanges: boolean) => {
	const { t } = useTranslation(["agents"]);

	useBeforeUnload(
		React.useCallback(
			(event) => {
				if (!hasUnsavedChanges) return;
				event.preventDefault();
				event.returnValue = "";
			},
			[hasUnsavedChanges],
		),
	);

	React.useEffect(() => {
		if (!hasUnsavedChanges) return;
		const handleAnchorNavigation = (event: MouseEvent) => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.altKey ||
				event.ctrlKey ||
				event.shiftKey
			)
				return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest("a[href]");
			if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank")
				return;
			const nextUrl = new URL(anchor.href, window.location.href);
			const currentUrl = new URL(window.location.href);
			const isSameLocation =
				nextUrl.pathname === currentUrl.pathname &&
				nextUrl.search === currentUrl.search &&
				nextUrl.hash === currentUrl.hash;
			if (nextUrl.origin !== currentUrl.origin || isSameLocation) return;
			if (!window.confirm(t("agents:confirm.leavePage"))) {
				event.preventDefault();
				event.stopPropagation();
			}
		};
		document.addEventListener("click", handleAnchorNavigation, true);
		return () =>
			document.removeEventListener("click", handleAnchorNavigation, true);
	}, [hasUnsavedChanges, t]);
};
