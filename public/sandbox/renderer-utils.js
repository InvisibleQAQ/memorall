/**
 * renderer-utils.js — injected into the rewritten Vite/Next/Express HTML by
 * renderer.js BEFORE the base-href override.
 *
 * Two responsibilities:
 *
 * 1. React Refresh no-op stubs — the ViteDevServer transforms JSX with HMR
 *    calls ($RefreshReg$, $RefreshSig$, etc.). The HMR inline <script> blocks
 *    that normally set these globals are blocked by the extension CSP
 *    (no 'unsafe-inline'). We provide safe no-ops so the app loads without HMR
 *    but still renders correctly.
 *
 * 2. Ready signal — after the page's load event (all modules fetched) plus a
 *    2 s grace period for React to mount, postMessage the rendered outerHTML
 *    to the parent frame (the offscreen document's renderViaIframe).
 *    The renderId is read from window.name, which survives document.write.
 */

// ─── React Refresh stubs ─────────────────────────────────────────────────────
if (!window.$RefreshRuntime$) {
	window.$RefreshRuntime$ = {
		injectIntoGlobalHook: () => {},
		register: () => {},
		performReactRefresh: () => {},
	};
}
if (!window.$RefreshReg$) {
	window.$RefreshReg$ = () => {};
}
if (!window.$RefreshSig$) {
	window.$RefreshSig$ = () => (type) => type;
}
if (window.$RefreshRegCount$ === undefined) {
	window.$RefreshRegCount$ = 0;
}

// ─── Ready signal ─────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
	setTimeout(() => {
		const renderId = window.name; // set as iframe.name before navigation
		parent.postMessage(
			{
				type: 'virtual-renderer-ready',
				renderId,
				html: document.documentElement.outerHTML,
			},
			'*',
		);
	}, 2000);
});
