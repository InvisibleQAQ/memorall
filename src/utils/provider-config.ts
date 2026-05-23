import { eq } from "drizzle-orm";
import { serviceManager } from "@/services";
import secureSession from "@/utils/secure-session";

export type AuthProvider = "openai" | "openrouter";

export interface ProviderConfig {
	apiKey: string;
	baseUrl: string;
}

const getProviderKey = (provider: AuthProvider) => `${provider}_config`;
const getProviderReadyKey = (provider: AuthProvider) => `${provider}_ready`;

const readProviderRecord = async (provider: AuthProvider) => {
	const key = getProviderKey(provider);
	const [record] = await serviceManager.databaseService.use(({ db, schema }) => {
		return db
			.select()
			.from(schema.encryption)
			.where(eq(schema.encryption.key, key))
			.limit(1);
	});

	return record ?? null;
};

const isProviderConfig = (value: unknown): value is ProviderConfig => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as Partial<ProviderConfig>;
	return (
		typeof candidate.apiKey === "string" &&
		typeof candidate.baseUrl === "string"
	);
};

export async function saveProviderConfig(
	provider: AuthProvider,
	config: ProviderConfig,
): Promise<void> {
	const key = getProviderKey(provider);
	const payload = JSON.stringify(config);
	const existing = await readProviderRecord(provider);

	if (existing) {
		await serviceManager.databaseService.use(({ db, schema }) => {
			return db
				.update(schema.encryption)
				.set({
					encryptedData: payload,
					advancedSeed: null,
					updatedAt: new Date(),
				})
				.where(eq(schema.encryption.key, key));
		});
		return;
	}

	await serviceManager.databaseService.use(({ db, schema }) => {
		return db.insert(schema.encryption).values({
			key,
			encryptedData: payload,
			advancedSeed: null,
		});
	});
}

export async function createProviderService(
	provider: AuthProvider,
	config: ProviderConfig,
): Promise<void> {
	if (serviceManager.llmService.has(provider)) {
		serviceManager.llmService.remove(provider);
	}

	try {
		await serviceManager.llmService.create(provider, {
			type: provider,
			apiKey: config.apiKey,
			baseURL: config.baseUrl,
		});
		await secureSession.set(getProviderReadyKey(provider), "true");
	} catch (error) {
		secureSession.delete(getProviderReadyKey(provider));
		if (serviceManager.llmService.has(provider)) {
			serviceManager.llmService.remove(provider);
		}
		throw error;
	}
}

export async function loadProviderConfig(
	provider: AuthProvider,
): Promise<ProviderConfig | null> {
	const record = await readProviderRecord(provider);
	if (!record) {
		return null;
	}

	const parsed: unknown = JSON.parse(record.encryptedData);
	if (!isProviderConfig(parsed)) {
		throw new Error(`Invalid ${provider} config record`);
	}

	return parsed;
}

export async function hasProviderConfig(
	provider: AuthProvider,
): Promise<boolean> {
	return (await readProviderRecord(provider)) !== null;
}

export async function clearProviderReadyState(
	provider: AuthProvider,
): Promise<void> {
	secureSession.delete(getProviderReadyKey(provider));
}

export async function isProviderReadyInSession(
	provider: AuthProvider,
): Promise<boolean> {
	return secureSession.exists(getProviderReadyKey(provider));
}

export async function deleteProviderConfig(
	provider: AuthProvider,
): Promise<void> {
	const key = getProviderKey(provider);
	await serviceManager.databaseService.use(({ db, schema }) => {
		return db.delete(schema.encryption).where(eq(schema.encryption.key, key));
	});
	await clearProviderReadyState(provider);
}

