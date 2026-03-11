/**
 * renderer.js — loaded by pages/renderer.html inside the SW-controlled /sandbox/ scope.
 * DEBUG BUILD — verbose console logging at every step.
 */
(async () => {
	const params = new URLSearchParams(location.search);
	const port = params.get('port');
	const path = decodeURIComponent(params.get('path') || '/');
	const importMapParam = params.get('importMap');
	let rendererImportMap = null;
	if (importMapParam) {
		try {
			const imports = JSON.parse(decodeURIComponent(importMapParam));
			if (imports && typeof imports === 'object' && Object.keys(imports).length > 0) {
				rendererImportMap = imports;
			}
		} catch (err) {
			console.warn('[renderer] failed to parse importMap query param', err);
		}
	}

	console.log('[renderer] start port=' + port + ' path=' + path);

	if (!port) return;

	// ── SW relay init ──────────────────────────────────────────────────────────
	const swController = navigator.serviceWorker?.controller;
	console.log('[renderer] swController=', swController);

	if (swController) {
		const channel = new MessageChannel();

		window._swRelayPort = channel.port1;
		window._swRelayFn = (event) => {
			console.log('[renderer] port1.onmessage fired type=' + event.data?.type + ' id=' + event.data?.id);
			if (event.data?.type === 'request') {
				console.log('[renderer] relaying sw-relay-request id=' + event.data.id + ' url=' + event.data.data?.url);
				parent.postMessage({
					type: 'sw-relay-request',
					id: event.data.id,
					portNum: event.data.data.port,
					method: event.data.data.method,
					url: event.data.data.url,
					headers: event.data.data.headers,
					body: event.data.data.body,
				}, '*');
			}
		};
		channel.port1.start();
		channel.port1.onmessage = window._swRelayFn;

		// Parent → renderer → SW (response).
		// NOTE: document.open() removes this listener. renderer-utils.js re-adds it.
		window.addEventListener('message', (e) => {
			if (e.data?.type === 'sw-relay-response') {
				console.log('[renderer] got sw-relay-response id=' + e.data.id + ' error=' + e.data.error);
				if (window._swRelayPort) {
					window._swRelayPort.postMessage({
						type: 'response',
						id: e.data.id,
						data: e.data.data,
						error: e.data.error,
					});
				}
			}
		});

		swController.postMessage({ type: 'init' }, [channel.port2]);
		console.log('[renderer] sent init to SW with port2');

		if (rendererImportMap) {
			swController.postMessage({
				type: 'set-import-map',
				data: { port: Number(port), importMap: rendererImportMap },
			});
			console.log('[renderer] sent import map to controlling SW for port=' + port);
		}

		await new Promise((r) => setTimeout(r, 100));
	} else {
		console.warn('[renderer] NO swController — SW requests will timeout!');
	}

	// ── Fetch virtual server HTML ─────────────────────────────────────────────
	try {
		const virtualPath =
			'/__virtual__/' + port + (path.startsWith('/') ? path : '/' + path);

		console.log('[renderer] fetching', virtualPath);
		const response = await fetch(virtualPath);
		console.log('[renderer] fetch response status=' + response.status);
		if (!response.ok) return;

		let html = await response.text();
		console.log('[renderer] html length=' + html.length);
		console.log('[renderer] html head (first 1000):', html.slice(0, 1000));

		// Extract import maps before stripping inline scripts. They are declarative,
		// CSP-safe, and needed when the browser executes modules before the SW has a
		// chance to rewrite bare specifiers.
		const importMapMatches = html.match(/<script\b[^>]*\btype\s*=\s*["']importmap["'][^>]*>[\s\S]*?<\/script>/gi) || [];

		// Strip inline <script> blocks that have no src= — CSP blocks them; renderer-utils.js provides stubs.
		html = html.replace(/<script\b(?![^>]*\bsrc\s*=)(?![^>]*\btype\s*=\s*["']importmap["'])[^>]*>[\s\S]*?<\/script>/gi, '');

		// Rewrite absolute-path HTML attributes to relative so <base href> routes them.
		html = html.replace(/((?:src|href|action)=)"\/(?!\/)/g, '$1"');

		// ── Inject utilities into <head> ──────────────────────────────────────
		// Reinsert any import maps explicitly. The earlier strip keeps only the
		// import-map blocks, but downstream rewrites should not have to rely on
		// that implicit preservation.
		const utilsUrl = chrome.runtime.getURL('sandbox/pages/renderer-utils.js');
		const utilsScript = '<script src="' + utilsUrl + '"><\/script>';
		const baseTag = '<base href="/__virtual__/' + port + '/">';
		const headInjection = utilsScript + baseTag + importMapMatches.join('');
		html = html.replace(/(<head[^>]*>)/i, '$1' + headInjection);

		window._memorallRenderId = window.name;
		console.log('[renderer] renderId=' + window._memorallRenderId + ' about to document.write');

		document.open();
		document.write(html);
		document.close();

		console.log('[renderer] after document.write — _swRelayPort=', window._swRelayPort);
	} catch (err) {
		console.error('[renderer] error:', err);
	}
})();
