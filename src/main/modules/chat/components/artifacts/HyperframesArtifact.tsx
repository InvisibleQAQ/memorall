import React, { useCallback, useEffect, useRef, useState } from "react";
import { documentFileSystemService } from "@/services/filesystem/document-filesystem";
import {
	FILESYSTEM_MOUNT_PATH,
	FILESYSTEM_SCOPE,
	type FilesystemScope,
} from "@/services/filesystem/filesystem-paths";
import type { DocumentTreeNode } from "@/types/document-library";
import type { ArtifactProps } from "./ArtifactActionsMenu";

type ImageReferenceCandidate = {
	scope: FilesystemScope;
	path: string;
	mimeType: string;
};

type FilesystemImageReference = ImageReferenceCandidate & {
	name: string;
};

const safeFilenameBase = (value?: string): string => {
	const cleaned = (value?.trim() || "hyperframes-composition")
		.replace(/[<>:"/\\|?*\x00-\x1f]+/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return cleaned || "hyperframes-composition";
};

const blobToDataUrl = async (url: string): Promise<string | null> => {
	try {
		const response = await fetch(url);
		if (!response.ok) return null;
		const blob = await response.blob();
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
};

const isExtensionBlobUrl = (value: string): boolean =>
	value.startsWith("blob:chrome-extension://");

const bytesToDataUrl = (bytes: Uint8Array, mimeType: string): string => {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...chunk);
	}
	return `data:${mimeType};base64,${btoa(binary)}`;
};

const imageMimeType = (path: string): string => {
	const ext = path.split(/[?#]/)[0]?.toLowerCase().split(".").pop();
	switch (ext) {
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "gif":
			return "image/gif";
		case "webp":
			return "image/webp";
		case "svg":
			return "image/svg+xml";
		case "ico":
			return "image/x-icon";
		case "png":
		default:
			return "image/png";
	}
};

const isExternalOrEmbeddedReference = (value: string): boolean =>
	/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);

const isLikelyImagePath = (value: string): boolean =>
	/\.(?:png|jpe?g|gif|webp|svg|ico)(?:[?#].*)?$/i.test(value);

const imageBasename = (value: string): string => {
	const clean = value.split(/[?#]/)[0]?.replace(/\\/g, "/") ?? "";
	const name = clean.split("/").filter(Boolean).pop() ?? clean;
	try {
		return decodeURIComponent(name).toLowerCase();
	} catch {
		return name.toLowerCase();
	}
};

const imageReferenceCandidates = (src: string): ImageReferenceCandidate[] => {
	const path = src.split(/[?#]/)[0]?.replace(/\\/g, "/") ?? src;
	if (!path) return [];

	const mimeType = imageMimeType(path);
	if (
		path === FILESYSTEM_MOUNT_PATH.DOCUMENTS ||
		path.startsWith(`${FILESYSTEM_MOUNT_PATH.DOCUMENTS}/`)
	) {
		return [
			{
				scope: FILESYSTEM_SCOPE.DOCUMENTS,
				path: path.slice(FILESYSTEM_MOUNT_PATH.DOCUMENTS.length) || "/",
				mimeType,
			},
		];
	}

	const workspaceMounts = [
		FILESYSTEM_MOUNT_PATH.WORKSPACES,
		FILESYSTEM_MOUNT_PATH.WORKSPACE_LEGACY,
	];
	for (const mount of workspaceMounts) {
		if (path === mount || path.startsWith(`${mount}/`)) {
			return [{ scope: FILESYSTEM_SCOPE.WORKSPACE, path, mimeType }];
		}
	}

	if (path.startsWith("/")) {
		return [{ scope: FILESYSTEM_SCOPE.DOCUMENTS, path, mimeType }];
	}

	return [];
};

const readImageReferenceCandidate = async (
	candidate: ImageReferenceCandidate,
): Promise<string | null> => {
	try {
		if (candidate.scope === FILESYSTEM_SCOPE.WORKSPACE) {
			const bytes = await documentFileSystemService.getWorkspaceFileContent(
				candidate.path,
			);
			return bytesToDataUrl(bytes, candidate.mimeType);
		}
		return await documentFileSystemService.readFileAsBase64(
			candidate.path,
			candidate.mimeType,
		);
	} catch {
		return null;
	}
};

const collectImageReferences = (
	nodes: DocumentTreeNode[],
	scope: FilesystemScope,
): FilesystemImageReference[] => {
	const images: FilesystemImageReference[] = [];
	for (const node of nodes) {
		const file = node.type === "file" ? node.file : null;
		if (file && (file.type === "image" || isLikelyImagePath(file.path))) {
			images.push({
				scope,
				name: file.name,
				path: file.path,
				mimeType: file.mimeType || imageMimeType(file.path),
			});
		}
		if (node.children.length > 0) {
			images.push(...collectImageReferences(node.children, scope));
		}
	}
	return images;
};

const findImageReferenceByRelativePath = async (
	src: string,
): Promise<FilesystemImageReference | null> => {
	const [documentTree, workspaceTree] = await Promise.all([
		documentFileSystemService.getTree(),
		documentFileSystemService.getWorkspaceTree(),
	]);
	const images = [
		...collectImageReferences(documentTree, FILESYSTEM_SCOPE.DOCUMENTS),
		...collectImageReferences(workspaceTree, FILESYSTEM_SCOPE.WORKSPACE),
	];
	const srcName = imageBasename(src);
	const normalizedSrc =
		src.split(/[?#]/)[0]?.replace(/\\/g, "/").toLowerCase() ?? srcName;
	const matches = images.filter((image) => {
		const imagePath = image.path.replace(/\\/g, "/").toLowerCase();
		return (
			image.name.toLowerCase() === srcName ||
			imagePath.endsWith(`/${normalizedSrc}`)
		);
	});

	return matches.length === 1 ? matches[0] : null;
};

const resolveImageReference = async (src: string): Promise<string | null> => {
	if (isExternalOrEmbeddedReference(src) || !isLikelyImagePath(src)) {
		return null;
	}

	for (const candidate of imageReferenceCandidates(src)) {
		const dataUrl = await readImageReferenceCandidate(candidate);
		if (dataUrl) return dataUrl;
	}

	if (src.startsWith("/")) return null;

	const image = await findImageReferenceByRelativePath(src);
	if (!image) return null;

	const path =
		image.scope === FILESYSTEM_SCOPE.WORKSPACE
			? `${FILESYSTEM_MOUNT_PATH.WORKSPACES}${image.path}`
			: image.path;
	return readImageReferenceCandidate({ ...image, path });
};

const replaceCssImageUrls = async (css: string): Promise<string> => {
	const URL_PATTERN = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
	const matches = Array.from(css.matchAll(URL_PATTERN));
	if (matches.length === 0) return css;

	let next = css;
	for (const match of matches) {
		const full = match[0];
		const src = match[2]?.trim();
		if (!src) continue;

		const dataUrl = await resolveImageReference(src);
		if (!dataUrl) continue;
		next = next.replace(full, `url("${dataUrl}")`);
	}
	return next;
};

const AUTHORED_HYPERFRAMES_SCRIPT_PATTERN =
	/(?:window\.__timelines|__timelines\s*=|gsap\.timeline|HyperShader\.init)/;

const extractAuthoredInlineScripts = (html: string): string[] => {
	const scripts: string[] = [];
	const inlineScriptPattern =
		/<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
	for (const match of html.matchAll(inlineScriptPattern)) {
		const code = match[2]?.trim();
		if (code && AUTHORED_HYPERFRAMES_SCRIPT_PATTERN.test(code)) {
			scripts.push(code);
		}
	}
	return scripts;
};

type NormalizedComposition = { html: string; inlineScripts: string[] };

/**
 * Normalise composition HTML before delivery to the sandbox page.
 *
 * Returns the cleaned HTML (with authored inline scripts removed — they are
 * sent separately so they survive DOMParser round-trips) and the extracted
 * inline animation scripts that must be executed in the preview page.
 */
const normalizeHyperframesHtml = async (
	html: string,
): Promise<NormalizedComposition> => {
	const authoredInlineScripts = extractAuthoredInlineScripts(html);
	const doc = new DOMParser().parseFromString(html, "text/html");
	const jobs: Promise<void>[] = [];

	for (const script of Array.from(
		doc.querySelectorAll<HTMLScriptElement>("script[src^='blob:']"),
	)) {
		const src = script.getAttribute("src");
		if (!src) continue;
		jobs.push(
			fetch(src)
				.then((response) => (response.ok ? response.text() : null))
				.then((code) => {
					if (!code) return;
					script.removeAttribute("src");
					script.textContent = code;
				})
				.catch(() => {
					// Stale extension blob URLs cannot be loaded cross-context.
					// Always remove them — the authored inline script is re-appended below.
					if (isExtensionBlobUrl(src)) {
						script.remove();
					}
				}),
		);
	}

	for (const img of Array.from(doc.querySelectorAll<HTMLImageElement>("img"))) {
		const src = img.getAttribute("src");
		if (!src) continue;

		if (src.startsWith("blob:")) {
			jobs.push(
				blobToDataUrl(src)
					.then((dataUrl) => {
						if (dataUrl) img.setAttribute("src", dataUrl);
						else if (isExtensionBlobUrl(src)) {
							return resolveImageReference(src).then((recovered) => {
								if (recovered) img.setAttribute("src", recovered);
							});
						}
					})
					.catch(() => undefined),
			);
		}

		jobs.push(
			resolveImageReference(src).then((dataUrl) => {
				if (dataUrl) img.setAttribute("src", dataUrl);
			}),
		);
	}

	for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[style]"))) {
		const style = el.getAttribute("style");
		if (!style || !/url\(/i.test(style)) continue;
		jobs.push(
			replaceCssImageUrls(style).then((nextStyle) => {
				if (nextStyle !== style) el.setAttribute("style", nextStyle);
			}),
		);
	}

	for (const styleEl of Array.from(
		doc.querySelectorAll<HTMLStyleElement>("style"),
	)) {
		const css = styleEl.textContent ?? "";
		if (!/url\(/i.test(css)) continue;
		jobs.push(
			replaceCssImageUrls(css).then((nextCss) => {
				if (nextCss !== css) styleEl.textContent = nextCss;
			}),
		);
	}

	await Promise.all(jobs);
	// Keep inline scripts in the serialised HTML so that the regex-based fallback
	// in the sandbox preview page can still find them if `inlineScripts` is lost.
	// The preview page uses `inlineScripts` as the primary path and falls back to
	// regex extraction from the raw HTML string — both paths need the scripts.
	const doctype = doc.doctype
		? `<!doctype ${doc.doctype.name}>`
		: "<!doctype html>";
	return {
		html: `${doctype}\n${doc.documentElement.outerHTML}`,
		inlineScripts: authoredInlineScripts,
	};
};

type HyperframesPlayerElement = HTMLElement & {
	iframeElement?: HTMLIFrameElement;
};

let hyperframesPlayerLoad: Promise<void> | null = null;

const ensureHyperframesPlayer = (): Promise<void> => {
	if (customElements.get("hyperframes-player")) return Promise.resolve();
	hyperframesPlayerLoad ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = chrome.runtime.getURL(
			"vendors/hyperframes/hyperframes-player.global.js",
		);
		script.onload = () => resolve();
		script.onerror = () =>
			reject(new Error("Failed to load HyperFrames player"));
		document.head.appendChild(script);
	});
	return hyperframesPlayerLoad;
};

export const HyperframesArtifact: React.FC<ArtifactProps> = ({
	content,
	identifier,
	title,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Use the GitHub Pages runner — no extension CSP applies there, so inline
	// animation scripts execute without restriction. The "/sandbox/" path segment
	// matches the player patch that removes the iframe sandbox attribute and skips
	// contentDocument probing for this URL, keeping cross-origin postMessage as
	// the only communication channel (which works fine).
	const previewUrl =
		"https://zrg-team.github.io/memorall/hyperframes-preview.html?v=20260522-download-mp4-2";
	const [previewHtml, setPreviewHtml] = useState<NormalizedComposition | null>(
		null,
	);

	// Normalise the composition HTML (inline stale blob scripts, convert images).
	useEffect(() => {
		let cancelled = false;
		setPreviewHtml(null);
		void normalizeHyperframesHtml(content).then((result) => {
			if (!cancelled) setPreviewHtml(result);
		});
		return () => {
			cancelled = true;
		};
	}, [content]);

	// Deliver the composition to the GitHub Pages runner via postMessage.
	//
	// Race-condition handling (no timeouts):
	//   The runner retries sending "ready" every 100 ms until it receives
	//   the composition HTML, so we only need one message listener here — no
	//   manual retry loop required.
	const postComposition = useCallback(
		(
			player: HyperframesPlayerElement,
			key: string,
			composition: NormalizedComposition,
			filenameBase: string,
		): void => {
			try {
				player.iframeElement?.contentWindow?.postMessage(
					{
						type: "memorall:hyperframes-composition",
						key,
						html: composition.html,
						inlineScripts: composition.inlineScripts,
						filenameBase,
					},
					"*",
				);
			} catch {
				// iframe may still be navigating; the preview page's retry will resend.
			}
		},
		[],
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container || !previewHtml) return;

		let cancelled = false;
		let removeMessageListener: (() => void) | null = null;
		const key = `memorall-hyperframes:${Date.now()}:${Math.random()
			.toString(36)
			.slice(2)}`;
		const compositionUrl = new URL(previewUrl);
		compositionUrl.hash = `composition=${encodeURIComponent(key)}`;
		const composition = previewHtml; // capture non-null for closure
		const filenameBase = safeFilenameBase(title || identifier || key);

		void ensureHyperframesPlayer().then(() => {
			if (cancelled) return;

			container.textContent = "";
			const player = document.createElement(
				"hyperframes-player",
			) as HyperframesPlayerElement;
			player.setAttribute("controls", "");
			player.setAttribute("autoplay", "");
			player.setAttribute("muted", "");
			player.style.cssText = "display:block;width:100%;height:100%";
			container.appendChild(player);

			// Listen for the "ready" signal from the GitHub Pages runner.
			// The runner re-sends "ready" every 100 ms so there is no race
			// condition — we never miss the signal regardless of load timing.
			const onMessage = (event: MessageEvent): void => {
				if (
					event.data?.type === "memorall:hyperframes-composition-ready" &&
					event.data.key === key
				) {
					postComposition(player, key, composition, filenameBase);
				}
			};
			window.addEventListener("message", onMessage);
			removeMessageListener = () =>
				window.removeEventListener("message", onMessage);

			// Set src last so the listener is in place before the page loads.
			player.setAttribute("src", compositionUrl.href);
		});

		return () => {
			cancelled = true;
			removeMessageListener?.();
			container.textContent = "";
		};
	}, [identifier, postComposition, previewHtml, previewUrl, title]);

	return (
		<div
			ref={containerRef}
			className="my-2 overflow-hidden rounded-md bg-black"
			style={{ display: "block", width: "100%", height: "60vh" }}
			aria-label={title || "HyperFrames composition"}
		/>
	);
};
