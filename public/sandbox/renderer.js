/**
 * renderer.js — loaded by renderer.html inside the SW-controlled /sandbox/ scope.
 *
 * Fetches the target virtual server page (the SW intercepts the request and
 * routes it to AlmostNode via server.handleSwRequest → handleRequest), then
 * rewrites the current document via document.write so all subsequent module
 * fetches (JS/CSS/assets) are also intercepted by the SW while keeping the
 * page URL at /sandbox/renderer.html (i.e. within the SW scope).
 */
(async () => {
	const params = new URLSearchParams(location.search);
	const port = params.get('port');
	const path = decodeURIComponent(params.get('path') || '/');

	// renderId is also stored in window.name (set by the outer renderViaIframe
	// before navigation) so it survives document.write for renderer-utils.js.
	if (!port) return;

	try {
		const virtualPath =
			'/__virtual__/' + port + (path.startsWith('/') ? path : '/' + path);

		// This fetch is intercepted by the SW (scope /sandbox/) and relayed to
		// the sandbox AlmostNode virtual server via server.handleSwRequest.
		const response = await fetch(virtualPath);
		if (!response.ok) return;

		let html = await response.text();

		// Full URL of renderer-utils.js so it survives the base-href override below.
		const utilsUrl = chrome.runtime.getURL('sandbox/renderer-utils.js');

		// Inject renderer-utils.js (React Refresh stubs + ready-signal) into
		// <head> BEFORE the base href so its URL resolves against the extension
		// origin, not the virtual server.
		const utilsScript = '<script src="' + utilsUrl + '"><\/script>';
		html = html.replace(/(<head[^>]*>)/i, '$1' + utilsScript);

		// Set base href so all relative module imports in the Vite/Next HTML
		// resolve to /__virtual__/<port>/ — the SW will intercept those too.
		const baseHref = '/__virtual__/' + port + '/';
		const baseTag = '<base href="' + baseHref + '">';
		// Insert base after renderer-utils script so that script's own src
		// (already absolute) is unaffected.
		html = html.replace(utilsScript, utilsScript + baseTag);

		// Rewrite this document. Page URL stays /sandbox/renderer.html so the
		// SW continues to control all subsequent fetches (JS, CSS, fonts, etc.).
		document.open();
		document.write(html);
		document.close();
	} catch (_err) {
		// Silently fail — the timeout in renderViaIframe handles empty results.
	}
})();
