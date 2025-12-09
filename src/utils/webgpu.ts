/**
 * WebGPU detection utilities
 * Shared across the application for consistent WebGPU support detection
 */

/**
 * Synchronously checks if the WebGPU API is available in the current environment.
 * This is a fast check that only verifies the API exists, not whether an adapter can be created.
 *
 * @returns true if navigator.gpu exists, false otherwise
 *
 * @example
 * ```typescript
 * if (isWebGPUSupported()) {
 *   // Use WebGPU backend
 * } else {
 *   // Fallback to WASM
 * }
 * ```
 */
export function isWebGPUSupported(): boolean {
	return typeof navigator !== "undefined" && "gpu" in navigator;
}

/**
 * Asynchronously detects WebGPU availability by attempting to request an adapter.
 * This is a more thorough check that verifies WebGPU is not only available but functional.
 *
 * Use this for comprehensive detection (e.g., system specs analysis).
 * Use `isWebGPUSupported()` for quick synchronous checks (e.g., choosing device backend).
 *
 * @returns Promise<boolean> true if an adapter can be requested, false otherwise
 *
 * @example
 * ```typescript
 * const hasWebGPU = await detectWebGPUAdapter();
 * if (hasWebGPU) {
 *   console.log("WebGPU is fully supported!");
 * }
 * ```
 */
export async function detectWebGPUAdapter(): Promise<boolean> {
	if (!isWebGPUSupported()) {
		return false;
	}

	try {
		const nav = navigator as Navigator & {
			gpu: { requestAdapter: () => Promise<any> };
		};
		const adapter = await nav.gpu.requestAdapter();
		return adapter !== null;
	} catch {
		return false;
	}
}

/**
 * Throws an error if WebGPU is not supported.
 * Useful for components that require WebGPU to function.
 *
 * @throws Error if WebGPU is not available
 *
 * @example
 * ```typescript
 * ensureWebGPUSupported(); // Throws if not available
 * // Continue with WebGPU-dependent code
 * ```
 */
export function ensureWebGPUSupported(): void {
	if (!isWebGPUSupported()) {
		throw new Error(
			"WebGPU is not available in this environment. WebGPU is required for this feature.",
		);
	}
}
