import { serviceManager } from "@/services";
import { eq } from "drizzle-orm";
import { FIXED_ENCRYPTION_KEY } from "@/config/security";
import {
	deriveAesKeyFromString,
	deriveAesKeyFromCombined,
	decryptStringAes,
} from "@/utils/aes";
import secureSession from "@/utils/secure-session";
import { logInfo, logError } from "@/utils/logger";

/**
 * Decrypt and restore an authentication provider (OpenAI or OpenRouter)
 * This works in both UI thread (proxy) and offscreen thread (main)
 */
export async function restoreAuthProvider(
	provider: "openai" | "openrouter",
	passkey: string,
): Promise<void> {
	const configKey = `${provider}_config`;
	const readyKey = `${provider}_ready`;
	const passkeyKey = `${provider}_passkey`;
	const combinedKeyKey = `${provider}_combined_key`;

	try {
		// 1. Fetch encrypted config from database
		const encryptedConfig = (
			await serviceManager.databaseService.use(({ db, schema }) => {
				return db
					.select()
					.from(schema.encryption)
					.where(eq(schema.encryption.key, configKey));
			})
		)[0];

		if (!encryptedConfig) {
			throw new Error(`No ${provider} configuration found in database`);
		}

		// 2. Decrypt strong password using user-entered passkey
		const passkeyKey_derived = await deriveAesKeyFromString(passkey);
		const strongPassword = await decryptStringAes(
			encryptedConfig.advancedSeed || "",
			passkeyKey_derived,
		);

		// 3. Combine with fixed key and decrypt config
		const combinedKey = await deriveAesKeyFromCombined(
			strongPassword,
			FIXED_ENCRYPTION_KEY,
		);
		const decryptedData = await decryptStringAes(
			encryptedConfig.encryptedData,
			combinedKey,
		);
		const config = JSON.parse(decryptedData);

		// 4. Create service in LLM service manager
		// This works for both proxy (UI thread) and main (offscreen thread)
		const serviceName = provider; // Service names match provider names
		if (serviceManager.llmService.has(serviceName)) {
			serviceManager.llmService.remove(serviceName);
		}

		await serviceManager.llmService.create(serviceName, {
			type: provider,
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});

		// 5. Mark as ready in secure session
		await secureSession.set(readyKey, "true");
		await secureSession.set(passkeyKey, passkey);
		await secureSession.set(
			combinedKeyKey,
			strongPassword + FIXED_ENCRYPTION_KEY,
		);

		logInfo(`✅ ${provider} service restored successfully`);
	} catch (error) {
		logError(`Failed to restore ${provider} service:`, error);
		throw error;
	}
}

/**
 * Check if a provider needs restoration (has config but not loaded)
 */
export async function checkProviderNeedsRestore(
	provider: "openai" | "openrouter",
): Promise<boolean> {
	const configKey = `${provider}_config`;
	const readyKey = `${provider}_ready`;

	try {
		// Check if service is already loaded in memory and ready
		if (
			serviceManager.llmService.has(provider) &&
			(await secureSession.exists(readyKey))
		) {
			return false; // Already restored
		}

		// Check if config exists in database
		const encryptedConfig = (
			await serviceManager.databaseService.use(({ db, schema }) => {
				return db
					.select()
					.from(schema.encryption)
					.where(eq(schema.encryption.key, configKey));
			})
		)[0];

		return !!encryptedConfig; // Needs restore if config exists but not loaded
	} catch (error) {
		logError(`Failed to check if ${provider} needs restore:`, error);
		return false;
	}
}
