import { logError } from "@/utils/logger";
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
// These can be overridden via environment variables or chrome.storage
const getSupabaseConfig = async (): Promise<{
	url: string;
	anonKey: string;
}> => {
	try {
		// Try to get config from chrome.storage
		const stored = await chrome.storage?.local?.get?.([
			"supabaseUrl",
			"supabaseAnonKey",
		]);

		if (stored?.supabaseUrl && stored?.supabaseAnonKey) {
			return {
				url: stored.supabaseUrl,
				anonKey: stored.supabaseAnonKey,
			};
		}
	} catch (error) {
		// Fallback to environment variables or defaults
	}

	// Fallback to environment variables (if available)
	const envUrl =
		import.meta?.env?.EXTENSION_PUBLIC_SUPABASE_URL ||
		import.meta?.env?.VITE_SUPABASE_URL ||
		"";
	const envKey =
		import.meta?.env?.EXTENSION_PUBLIC_SUPABASE_ANON_KEY ||
		import.meta?.env?.VITE_SUPABASE_ANON_KEY ||
		"";

	return {
		url: envUrl,
		anonKey: envKey,
	};
};

// Create Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = async () => {
	if (supabaseClient) {
		return supabaseClient;
	}

	const config = await getSupabaseConfig();

	// Only create client if both URL and key are available
	if (!config.url || !config.anonKey) {
		return null;
	}

	supabaseClient = createClient(config.url, config.anonKey, {
		auth: {
			persistSession: true,
			autoRefreshToken: true,
			detectSessionInUrl: false,
			storage: {
				getItem: async (key: string) => {
					try {
						const result = await chrome.storage?.local?.get?.(key);
						return result?.[key] || null;
					} catch {
						return null;
					}
				},
				setItem: async (key: string, value: string) => {
					try {
						await chrome.storage?.local?.set?.({ [key]: value });
					} catch {
						// Ignore errors
					}
				},
				removeItem: async (key: string) => {
					try {
						await chrome.storage?.local?.remove?.(key);
					} catch {
						// Ignore errors
					}
				},
			},
		},
	});

	return supabaseClient;
};

// Update Supabase configuration
export const updateSupabaseConfig = async (url: string, anonKey: string) => {
	try {
		await chrome.storage?.local?.set?.({
			supabaseUrl: url,
			supabaseAnonKey: anonKey,
		});

		// Reset client to force recreation with new config
		supabaseClient = null;
	} catch (error) {
		logError("Failed to update Supabase config:", error);
		throw error;
	}
};

// Clear Supabase configuration
export const clearSupabaseConfig = async () => {
	try {
		await chrome.storage?.local?.remove?.(["supabaseUrl", "supabaseAnonKey"]);
		supabaseClient = null;
	} catch (error) {
		logError("Failed to clear Supabase config:", error);
		throw error;
	}
};

// Check if Supabase is configured
export const isSupabaseConfigured = async (): Promise<boolean> => {
	const config = await getSupabaseConfig();
	return Boolean(config.url && config.anonKey);
};
