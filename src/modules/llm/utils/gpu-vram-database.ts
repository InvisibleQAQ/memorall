/**
 * Comprehensive GPU VRAM database
 * Maps GPU model names to VRAM capacity in GB
 */

interface GPUSpec {
	vram: number;
	tier: "flagship" | "high-end" | "mid-range" | "entry" | "integrated";
}

/**
 * GPU VRAM Database
 * Sources: TechPowerUp, manufacturer specs, community data
 */
export const GPU_VRAM_MAP: Record<string, GPUSpec> = {
	// === NVIDIA RTX 40 Series (Ada Lovelace, 2022-2024) ===
	"rtx 4090": { vram: 24, tier: "flagship" },
	"rtx 4080 super": { vram: 16, tier: "flagship" },
	"rtx 4080": { vram: 16, tier: "flagship" },
	"rtx 4070 ti super": { vram: 16, tier: "high-end" },
	"rtx 4070 ti": { vram: 12, tier: "high-end" },
	"rtx 4070 super": { vram: 12, tier: "high-end" },
	"rtx 4070": { vram: 12, tier: "high-end" },
	"rtx 4060 ti 16gb": { vram: 16, tier: "mid-range" },
	"rtx 4060 ti": { vram: 8, tier: "mid-range" },
	"rtx 4060": { vram: 8, tier: "mid-range" },
	"rtx 4050": { vram: 6, tier: "entry" },

	// === NVIDIA RTX 30 Series (Ampere, 2020-2022) ===
	"rtx 3090 ti": { vram: 24, tier: "flagship" },
	"rtx 3090": { vram: 24, tier: "flagship" },
	"rtx 3080 ti": { vram: 12, tier: "high-end" },
	"rtx 3080 12gb": { vram: 12, tier: "high-end" },
	"rtx 3080": { vram: 10, tier: "high-end" },
	"rtx 3070 ti": { vram: 8, tier: "high-end" },
	"rtx 3070": { vram: 8, tier: "high-end" },
	"rtx 3060 ti": { vram: 8, tier: "mid-range" },
	"rtx 3060 12gb": { vram: 12, tier: "mid-range" },
	"rtx 3060": { vram: 12, tier: "mid-range" },
	"rtx 3050": { vram: 8, tier: "entry" },

	// === NVIDIA RTX 20 Series (Turing, 2018-2020) ===
	"rtx 2080 ti": { vram: 11, tier: "flagship" },
	"rtx 2080 super": { vram: 8, tier: "high-end" },
	"rtx 2080": { vram: 8, tier: "high-end" },
	"rtx 2070 super": { vram: 8, tier: "high-end" },
	"rtx 2070": { vram: 8, tier: "high-end" },
	"rtx 2060 super": { vram: 8, tier: "mid-range" },
	"rtx 2060": { vram: 6, tier: "mid-range" },

	// === NVIDIA GTX 16 Series (Turing, no RT cores) ===
	"gtx 1660 ti": { vram: 6, tier: "mid-range" },
	"gtx 1660 super": { vram: 6, tier: "mid-range" },
	"gtx 1660": { vram: 6, tier: "mid-range" },
	"gtx 1650 super": { vram: 4, tier: "entry" },
	"gtx 1650": { vram: 4, tier: "entry" },

	// === NVIDIA GTX 10 Series (Pascal, 2016-2018) ===
	"gtx 1080 ti": { vram: 11, tier: "flagship" },
	"gtx 1080": { vram: 8, tier: "high-end" },
	"gtx 1070 ti": { vram: 8, tier: "high-end" },
	"gtx 1070": { vram: 8, tier: "high-end" },
	"gtx 1060 6gb": { vram: 6, tier: "mid-range" },
	"gtx 1060": { vram: 3, tier: "mid-range" },
	"gtx 1050 ti": { vram: 4, tier: "entry" },
	"gtx 1050": { vram: 2, tier: "entry" },

	// === NVIDIA Mobile/Laptop GPUs ===
	"rtx 4090 laptop": { vram: 16, tier: "flagship" },
	"rtx 4080 laptop": { vram: 12, tier: "high-end" },
	"rtx 4070 laptop": { vram: 8, tier: "high-end" },
	"rtx 4060 laptop": { vram: 8, tier: "mid-range" },
	"rtx 4050 laptop": { vram: 6, tier: "entry" },
	"rtx 3080 ti laptop": { vram: 16, tier: "flagship" },
	"rtx 3080 laptop": { vram: 16, tier: "high-end" },
	"rtx 3070 ti laptop": { vram: 8, tier: "high-end" },
	"rtx 3070 laptop": { vram: 8, tier: "high-end" },
	"rtx 3060 laptop": { vram: 6, tier: "mid-range" },
	"rtx 3050 ti laptop": { vram: 4, tier: "entry" },
	"rtx 3050 laptop": { vram: 4, tier: "entry" },
	"gtx 1650 ti laptop": { vram: 4, tier: "entry" },
	"gtx 1650 laptop": { vram: 4, tier: "entry" },

	// === NVIDIA MX Series (Entry Mobile) ===
	mx570: { vram: 2, tier: "entry" },
	mx550: { vram: 2, tier: "entry" },
	mx450: { vram: 2, tier: "entry" },
	mx350: { vram: 2, tier: "entry" },
	mx250: { vram: 2, tier: "entry" },
	mx150: { vram: 2, tier: "entry" },

	// === AMD Radeon RX 7000 Series (RDNA 3, 2022-2024) ===
	"rx 7900 xtx": { vram: 24, tier: "flagship" },
	"rx 7900 xt": { vram: 20, tier: "flagship" },
	"rx 7900 gre": { vram: 16, tier: "high-end" },
	"rx 7800 xt": { vram: 16, tier: "high-end" },
	"rx 7700 xt": { vram: 12, tier: "high-end" },
	"rx 7600 xt": { vram: 16, tier: "mid-range" },
	"rx 7600": { vram: 8, tier: "mid-range" },

	// === AMD Radeon RX 6000 Series (RDNA 2, 2020-2022) ===
	"rx 6950 xt": { vram: 16, tier: "flagship" },
	"rx 6900 xt": { vram: 16, tier: "flagship" },
	"rx 6800 xt": { vram: 16, tier: "high-end" },
	"rx 6800": { vram: 16, tier: "high-end" },
	"rx 6750 xt": { vram: 12, tier: "high-end" },
	"rx 6700 xt": { vram: 12, tier: "high-end" },
	"rx 6700": { vram: 10, tier: "mid-range" },
	"rx 6650 xt": { vram: 8, tier: "mid-range" },
	"rx 6600 xt": { vram: 8, tier: "mid-range" },
	"rx 6600": { vram: 8, tier: "mid-range" },
	"rx 6500 xt": { vram: 4, tier: "entry" },
	"rx 6400": { vram: 4, tier: "entry" },

	// === AMD Radeon RX 5000 Series (RDNA, 2019-2020) ===
	"rx 5700 xt": { vram: 8, tier: "high-end" },
	"rx 5700": { vram: 8, tier: "high-end" },
	"rx 5600 xt": { vram: 6, tier: "mid-range" },
	"rx 5500 xt": { vram: 8, tier: "mid-range" },

	// === AMD Radeon VII & Vega ===
	"radeon vii": { vram: 16, tier: "flagship" },
	"vega 64": { vram: 8, tier: "high-end" },
	"vega 56": { vram: 8, tier: "high-end" },

	// === AMD Mobile GPUs ===
	"rx 7900m": { vram: 16, tier: "flagship" },
	"rx 7800m": { vram: 12, tier: "high-end" },
	"rx 7700m": { vram: 8, tier: "high-end" },
	"rx 7600m xt": { vram: 8, tier: "mid-range" },
	"rx 7600m": { vram: 8, tier: "mid-range" },
	"rx 6850m xt": { vram: 12, tier: "flagship" },
	"rx 6800m": { vram: 12, tier: "high-end" },
	"rx 6700m": { vram: 10, tier: "high-end" },
	"rx 6600m": { vram: 8, tier: "mid-range" },
	"rx 6500m": { vram: 4, tier: "entry" },

	// === Intel Arc (Alchemist, 2022-2024) ===
	"arc a770": { vram: 16, tier: "high-end" },
	"arc a750": { vram: 8, tier: "mid-range" },
	"arc a580": { vram: 8, tier: "mid-range" },
	"arc a380": { vram: 6, tier: "entry" },
	"arc a310": { vram: 4, tier: "entry" },

	// === Intel Arc Mobile ===
	"arc a770m": { vram: 16, tier: "high-end" },
	"arc a730m": { vram: 12, tier: "high-end" },
	"arc a550m": { vram: 8, tier: "mid-range" },
	"arc a370m": { vram: 4, tier: "entry" },

	// === Intel Integrated Graphics (Iris Xe, UHD) ===
	"iris xe": { vram: 0, tier: "integrated" }, // Uses shared RAM
	"iris plus": { vram: 0, tier: "integrated" },
	"uhd graphics 770": { vram: 0, tier: "integrated" },
	"uhd graphics 730": { vram: 0, tier: "integrated" },
	"uhd graphics 630": { vram: 0, tier: "integrated" },
	"uhd graphics": { vram: 0, tier: "integrated" },

	// === AMD Integrated Graphics (Vega, RDNA) ===
	"radeon 780m": { vram: 0, tier: "integrated" }, // Ryzen 7000 series
	"radeon 680m": { vram: 0, tier: "integrated" }, // Ryzen 6000 series
	"radeon 660m": { vram: 0, tier: "integrated" },
	"radeon graphics": { vram: 0, tier: "integrated" },
	"vega 11": { vram: 0, tier: "integrated" },
	"vega 8": { vram: 0, tier: "integrated" },
	"vega 7": { vram: 0, tier: "integrated" },
	"vega 6": { vram: 0, tier: "integrated" },

	// === Apple Silicon (Unified Memory) ===
	"apple m3 max": { vram: 0, tier: "flagship" }, // 48-128GB unified
	"apple m3 pro": { vram: 0, tier: "high-end" }, // 18-36GB unified
	"apple m3": { vram: 0, tier: "mid-range" }, // 8-24GB unified
	"apple m2 ultra": { vram: 0, tier: "flagship" },
	"apple m2 max": { vram: 0, tier: "flagship" },
	"apple m2 pro": { vram: 0, tier: "high-end" },
	"apple m2": { vram: 0, tier: "mid-range" },
	"apple m1 ultra": { vram: 0, tier: "flagship" },
	"apple m1 max": { vram: 0, tier: "flagship" },
	"apple m1 pro": { vram: 0, tier: "high-end" },
	"apple m1": { vram: 0, tier: "mid-range" },

	// === Qualcomm Adreno (Mobile) ===
	adreno: { vram: 0, tier: "integrated" },

	// === Mali (ARM Mobile) ===
	mali: { vram: 0, tier: "integrated" },
};

/**
 * Estimates VRAM based on GPU renderer string
 * Uses comprehensive GPU database for accurate detection
 */
export function estimateVRAM(renderer: string): number | undefined {
	const rendererLower = renderer.toLowerCase();

	// Try exact matches first (most specific to least specific)
	for (const [gpuName, spec] of Object.entries(GPU_VRAM_MAP)) {
		if (rendererLower.includes(gpuName)) {
			return spec.vram > 0 ? spec.vram : undefined;
		}
	}

	// Fallback: Generic patterns
	if (rendererLower.includes("integrated")) {
		return undefined; // Integrated graphics use shared RAM
	}

	// Unknown GPU
	return undefined;
}

/**
 * Gets GPU tier for performance categorization
 */
export function getGPUTier(renderer: string): GPUSpec["tier"] | undefined {
	const rendererLower = renderer.toLowerCase();

	for (const [gpuName, spec] of Object.entries(GPU_VRAM_MAP)) {
		if (rendererLower.includes(gpuName)) {
			return spec.tier;
		}
	}

	return undefined;
}
