import type { SystemSpecs } from "../types/system-specs";
import { detectWebGPUAdapter } from "@/utils/webgpu";

/**
 * Detects the user's system specifications
 */
export async function detectSystemSpecs(): Promise<SystemSpecs> {
	// Detect memory (approximation based on device memory API)
	const memoryGB = detectMemory();

	// Detect CPU cores
	const cpuCores = navigator.hardwareConcurrency || 4;

	// Detect WebGPU availability
	const hasWebGPU = await detectWebGPUAdapter();

	// Detect GPU information
	const gpu = await detectGPU();

	// Calculate device category
	const deviceCategory = calculateDeviceCategory(
		memoryGB,
		cpuCores,
		hasWebGPU,
		gpu,
	);

	return {
		memoryGB,
		cpuCores,
		hasWebGPU,
		gpu,
		deviceCategory,
	};
}

/**
 * Detects available memory in GB
 */
function detectMemory(): number {
	// Try to use device memory API if available
	const nav = navigator as Navigator & { deviceMemory?: number };
	if (nav.deviceMemory) {
		return nav.deviceMemory;
	}

	// Fallback: estimate based on other factors
	// Most modern devices have at least 4GB
	return 8; // Conservative default
}

/**
 * Detects GPU information using WebGL
 */
async function detectGPU(): Promise<SystemSpecs["gpu"] | undefined> {
	try {
		const canvas = document.createElement("canvas");
		const gl =
			canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

		if (!gl || !(gl instanceof WebGLRenderingContext)) {
			return undefined;
		}

		const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
		if (!debugInfo) {
			return undefined;
		}

		const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;
		const renderer = gl.getParameter(
			debugInfo.UNMASKED_RENDERER_WEBGL,
		) as string;

		// Estimate VRAM based on renderer string (very rough estimation)
		const estimatedVRAM = estimateVRAM(renderer);

		return {
			vendor,
			renderer,
			estimatedVRAM,
		};
	} catch {
		return undefined;
	}
}

/**
 * Estimates VRAM based on GPU renderer string
 */
function estimateVRAM(renderer: string): number | undefined {
	const rendererLower = renderer.toLowerCase();

	// Look for VRAM indicators in the renderer string
	// This is a very rough estimation
	if (
		rendererLower.includes("rtx 4090") ||
		rendererLower.includes("rtx 4080")
	) {
		return 16;
	}
	if (
		rendererLower.includes("rtx 3090") ||
		rendererLower.includes("rtx 3080")
	) {
		return 12;
	}
	if (
		rendererLower.includes("rtx 3070") ||
		rendererLower.includes("rtx 4060")
	) {
		return 8;
	}
	if (rendererLower.includes("rtx 3060") || rendererLower.includes("gtx")) {
		return 6;
	}
	if (rendererLower.includes("mx") || rendererLower.includes("integrated")) {
		return 2;
	}

	// Default: unknown
	return undefined;
}

/**
 * Calculates device category based on specs
 */
function calculateDeviceCategory(
	memoryGB: number,
	cpuCores: number,
	hasWebGPU: boolean,
	gpu: SystemSpecs["gpu"],
): SystemSpecs["deviceCategory"] {
	// Ultra: High-end desktop/laptop with dedicated GPU
	if (
		memoryGB >= 16 &&
		cpuCores >= 8 &&
		hasWebGPU &&
		gpu &&
		(gpu.estimatedVRAM ?? 0) >= 8
	) {
		return "ultra";
	}

	// High: Good desktop/laptop with GPU
	if (memoryGB >= 8 && cpuCores >= 6 && hasWebGPU) {
		return "high";
	}

	// Medium: Average laptop/desktop
	if (memoryGB >= 4 && cpuCores >= 4) {
		return "medium";
	}

	// Low: Entry-level device
	return "low";
}
