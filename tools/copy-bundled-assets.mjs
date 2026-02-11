/*
 Copies assets required by AI libraries to web-accessible locations for MV3 extensions.

 1. ONNX Runtime Web (for @huggingface/transformers)
    - Source: node_modules/onnxruntime-web/dist
    - Dest:   public/vendors/transformers

 2. Wllama WASM files
    - Source: node_modules/@wllama/wllama/esm
    - Dest:   public/runner/libs

 3. WebLLM library
    - Source: node_modules/@mlc-ai/web-llm/lib
    - Dest:   public/runner/libs

 3b. Transformers.js library
    - Source: node_modules/@huggingface/transformers/dist
    - Dest:   public/runner/libs

 4. PDF.js worker
    - Source: node_modules/pdfjs-dist/build
    - Dest:   public/vendors/pdfjs
*/

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const require = createRequire(import.meta.url);

function ensureDir(p) {
	fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest) {
	ensureDir(path.dirname(dest));
	fs.copyFileSync(src, dest);
	console.log(`Copied: ${path.relative(process.cwd(), dest)}`);
}

function copyDirectory(src, dest) {
	ensureDir(dest);
	const entries = fs.readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			copyDirectory(srcPath, destPath);
		} else {
			copyFile(srcPath, destPath);
		}
	}
}

async function main() {
	console.log("📦 Copying AI library assets...\n");

	// 1. Copy ONNX Runtime assets
	const ortSrcDir = path.resolve(
		process.cwd(),
		"node_modules/onnxruntime-web/dist",
	);
	const ortDestDir = path.resolve(process.cwd(), "public/vendors/transformers");

	if (!fs.existsSync(ortSrcDir)) {
		console.error("onnxruntime-web not found at", ortSrcDir);
		process.exit(1);
	}

	ensureDir(ortDestDir);

	const entries = fs.readdirSync(ortSrcDir);
	const wanted = entries.filter((f) => /\.jsep\.(wasm|mjs)$/.test(f));

	if (wanted.length === 0) {
		console.warn(
			"No JSEP assets found in onnxruntime-web/dist; copying simd-threaded pair if present.",
		);
	}

	const filesToCopy =
		wanted.length > 0
			? wanted
			: [
					"ort-wasm-simd-threaded.jsep.mjs",
					"ort-wasm-simd-threaded.jsep.wasm",
				].filter((f) => fs.existsSync(path.join(ortSrcDir, f)));

	if (filesToCopy.length === 0) {
		console.error("Required ORT wasm assets not found.");
		process.exit(2);
	}

	for (const file of filesToCopy) {
		copyFile(path.join(ortSrcDir, file), path.join(ortDestDir, file));
	}

	console.log("✅ ONNX Runtime assets prepared.\n");

	// 2. Copy Wllama library and WASM files
	const wllamaSrc = path.resolve(
		process.cwd(),
		"node_modules/@wllama/wllama/esm",
	);
	const wllamaDestLibs = path.resolve(process.cwd(), "public/runner/libs");

	if (fs.existsSync(wllamaSrc)) {
		// Copy main library
		copyFile(
			path.join(wllamaSrc, "index.js"),
			path.join(wllamaDestLibs, "wllama.js"),
		);

		// Copy WASM files (single-thread and multi-thread)
		const wllamaWasmDirs = ["single-thread", "multi-thread"];
		for (const dir of wllamaWasmDirs) {
			const srcDir = path.join(wllamaSrc, dir);
			const destDir = path.join(wllamaDestLibs, dir);
			if (fs.existsSync(srcDir)) {
				copyDirectory(srcDir, destDir);
			}
		}

		console.log("✅ Wllama library and WASM files copied.\n");
	} else {
		console.warn("⚠️  @wllama/wllama not found, skipping.\n");
	}

	// 3. Copy WebLLM library
	const webllmSrc = path.resolve(
		process.cwd(),
		"node_modules/@mlc-ai/web-llm/lib/index.js",
	);
	const webllmDest = path.resolve(
		process.cwd(),
		"public/runner/libs/web-llm.js",
	);

	if (fs.existsSync(webllmSrc)) {
		copyFile(webllmSrc, webllmDest);
		console.log("✅ WebLLM library copied.\n");
	} else {
		console.warn("⚠️  @mlc-ai/web-llm not found, skipping.\n");
	}

	// 3b. Copy Transformers.js library
	const transformersSrc = path.resolve(
		process.cwd(),
		"node_modules/@huggingface/transformers/dist/transformers.min.js",
	);
	const transformersDest = path.resolve(
		process.cwd(),
		"public/runner/libs/transformers.js",
	);

	if (fs.existsSync(transformersSrc)) {
		copyFile(transformersSrc, transformersDest);
		console.log("✅ Transformers.js library copied.\n");
	} else {
		console.warn("⚠️  @huggingface/transformers not found, skipping.\n");
	}

	// 4. Copy PDF.js worker
	const pdfjsSrc = path.resolve(
		process.cwd(),
		"node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
	);
	const pdfjsDestDir = path.resolve(process.cwd(), "public/vendors/pdfjs");
	const pdfjsDest = path.join(pdfjsDestDir, "pdf.worker.min.mjs");

	if (fs.existsSync(pdfjsSrc)) {
		copyFile(pdfjsSrc, pdfjsDest);
		console.log("✅ PDF.js worker copied.\n");
	} else {
		console.warn("⚠️  pdfjs-dist worker not found, skipping.\n");
	}

	// 5. Copy sandbox assets to extension root (for manifest sandbox.pages)
	// 5a. Bundle almostnode for sandbox runtime core-module shims
	const almostnodeEntry = path.resolve(
		process.cwd(),
		"node_modules/almostnode/dist/index.mjs",
	);
	const almostnodeAssetsDir = path.resolve(
		process.cwd(),
		"node_modules/almostnode/dist/assets",
	);
	const brotliWasmSrc = path.resolve(
		process.cwd(),
		"node_modules/brotli-wasm/pkg.web/brotli_wasm_bg.wasm",
	);
	const esbuildBrowserSrc = path.resolve(
		process.cwd(),
		"node_modules/esbuild-wasm/esm/browser.min.js",
	);
	const esbuildWasmSrc = path.resolve(
		process.cwd(),
		"node_modules/esbuild-wasm/esbuild.wasm",
	);
	const almostnodeOut = path.resolve(
		process.cwd(),
		"public/sandbox/vendors/almostnode.bundle.js",
	);
	const almostnodeOutDir = path.dirname(almostnodeOut);

	if (fs.existsSync(almostnodeEntry)) {
		ensureDir(path.dirname(almostnodeOut));
		await build({
			entryPoints: [almostnodeEntry],
			outfile: almostnodeOut,
			bundle: true,
			format: "esm",
			platform: "browser",
			target: ["esnext"],
			sourcemap: false,
			minify: true,
			banner: {
				js: [
					"globalThis.global ??= globalThis;",
					"globalThis.process ??= {",
					"  env: {},",
					"  argv: [],",
					"  browser: true,",
					"  version: \"v20.0.0\",",
					"  versions: { node: \"20.0.0\" },",
					"  cwd: () => \"/\",",
					"  nextTick: (cb, ...args) => Promise.resolve().then(() => cb(...args)),",
					"};",
				].join("\n"),
			},
			logLevel: "silent",
			plugins: [
				{
					name: "almostnode-node-polyfill-alias",
					setup(buildApi) {
						buildApi.onResolve({ filter: /^node:zlib$/ }, () => ({
							path: require.resolve("browserify-zlib"),
						}));
						buildApi.onResolve({ filter: /^zlib$/ }, () => ({
							path: require.resolve("browserify-zlib"),
						}));
						buildApi.onResolve({ filter: /^stream$/ }, () => ({
							path: require.resolve("stream-browserify"),
						}));
						buildApi.onResolve({ filter: /^node:stream$/ }, () => ({
							path: require.resolve("stream-browserify"),
						}));
					},
				},
			],
		});

		// almostnode bundle may reference worker assets via "/assets/runtime-worker-*.js".
		// Repoint to colocated files under sandbox/vendors to keep extension bundling resolvable.
		let almostnodeBundle = fs.readFileSync(almostnodeOut, "utf8");
		const workerAssetNames = new Set(
			Array.from(
				almostnodeBundle.matchAll(/\/assets\/(runtime-worker-[^"]+\.js)/g),
			).map((match) => match[1]),
		);
		almostnodeBundle = almostnodeBundle.replace(
			/"\/assets\/(runtime-worker-[^"]+\.js)"/g,
			'"./$1"',
		);
		// Rewrite almostnode CDN imports to local, bundled assets to satisfy CSP.
		almostnodeBundle = almostnodeBundle
			.replaceAll(
				"https://esm.sh/esbuild-wasm@0.20.0",
				"./esbuild-wasm-browser.min.js",
			)
			.replaceAll(
				"https://unpkg.com/esbuild-wasm@0.20.0/esbuild.wasm",
				"./vendors/esbuild.wasm",
			);
		// Force esbuild-wasm to run without spawning blob: workers (MV3 CSP-safe).
		almostnodeBundle = almostnodeBundle
			.replaceAll(
				'initialize({wasmURL:"./esbuild.wasm"})',
				'initialize({wasmURL:"./vendors/esbuild.wasm",worker:false})',
			)
			.replaceAll(
				"initialize({wasmURL:'./esbuild.wasm'})",
				"initialize({wasmURL:'./vendors/esbuild.wasm',worker:false})",
			)
			.replaceAll(
				'initialize({wasmURL:"./esbuild.wasm",worker:false})',
				'initialize({wasmURL:"./vendors/esbuild.wasm",worker:false})',
			)
			.replaceAll(
				"initialize({wasmURL:'./esbuild.wasm',worker:false})",
				"initialize({wasmURL:'./vendors/esbuild.wasm',worker:false})",
			)
			.replaceAll(
				'initialize({wasmURL:"./vendors/esbuild.wasm"})',
				'initialize({wasmURL:"./vendors/esbuild.wasm",worker:false})',
			)
			.replaceAll(
				"initialize({wasmURL:'./vendors/esbuild.wasm'})",
				"initialize({wasmURL:'./vendors/esbuild.wasm',worker:false})",
			);
		// Rspack rejects node:module specifiers even in dynamic import dead branches.
		// Replace with non-resolving promise to avoid compile-time scheme handling.
		almostnodeBundle = almostnodeBundle.replace(
			/import\(\s*(?:"node:module"|"node"\s*\+\s*":module")\s*\)/g,
			'Promise.reject(new Error("node:module unavailable in sandbox"))',
		);
		fs.writeFileSync(almostnodeOut, almostnodeBundle);

		// Copy referenced runtime-worker assets next to almostnode bundle.
		for (const workerName of workerAssetNames) {
			const workerSrc = path.join(almostnodeAssetsDir, workerName);
			if (fs.existsSync(workerSrc)) {
				copyFile(workerSrc, path.join(almostnodeOutDir, workerName));
			} else {
				console.warn(
					`⚠️  almostnode worker asset not found, skipping: ${workerSrc}`,
				);
			}
		}

		// brotli-wasm is loaded via URL relative to almostnode.bundle.js.
		// Ensure the wasm binary is colocated so extension bundlers can resolve it.
		if (fs.existsSync(brotliWasmSrc)) {
			copyFile(brotliWasmSrc, path.join(almostnodeOutDir, "brotli_wasm_bg.wasm"));
		} else {
			console.warn("⚠️  brotli wasm asset not found, skipping copy.\n");
		}

		// Local esbuild-wasm assets for CSP-safe transformer initialization.
		if (fs.existsSync(esbuildBrowserSrc) && fs.existsSync(esbuildWasmSrc)) {
			copyFile(
				esbuildBrowserSrc,
				path.join(almostnodeOutDir, "esbuild-wasm-browser.min.js"),
			);
			copyFile(esbuildWasmSrc, path.join(almostnodeOutDir, "esbuild.wasm"));
			// Fallback location for runtimes that resolve wasmURL from /sandbox base.
			copyFile(
				esbuildWasmSrc,
				path.resolve(process.cwd(), "public/sandbox/esbuild.wasm"),
			);
		} else {
			console.warn(
				"⚠️  esbuild-wasm local assets not found, package install transform may fail under CSP.\n",
			);
		}

		console.log("✅ almostnode bundled for sandbox runtime.\n");
	} else {
		console.warn("⚠️  almostnode entry not found, skipping bundle.\n");
	}

	// 5b. Copy sandbox assets to extension root (for manifest sandbox.pages)
	const sandboxSrcDir = path.resolve(process.cwd(), "public/sandbox");
	const sandboxDestDir = path.resolve(process.cwd(), "sandbox");
	if (fs.existsSync(sandboxSrcDir)) {
		copyDirectory(sandboxSrcDir, sandboxDestDir);
		console.log("✅ Sandbox assets copied.\n");
	} else {
		console.warn("⚠️  public/sandbox not found, skipping.\n");
	}

	console.log("🎉 All AI library assets prepared successfully!");
}

main().catch((error) => {
	console.error("❌ Failed to copy bundled assets:", error);
	process.exit(1);
});
