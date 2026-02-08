import { useState, useEffect, useCallback } from "react";
import {
	hasMasterKey as checkHasMasterKey,
	isMasterKeyUnlocked,
	detectEncryptionFormat,
	getEncryptedProviders,
	setupMasterKey as setupMasterKeyUtil,
	unlockMasterKey as unlockMasterKeyUtil,
	lockMasterKey as lockMasterKeyUtil,
	getLegacyProviders,
} from "@/utils/master-key";

type AuthProvider = "openai" | "openrouter";

interface MasterKeyState {
	/** Whether master key exists in database */
	hasMasterKey: boolean;
	/** Whether master key is currently unlocked in session */
	isUnlocked: boolean;
	/** List of encrypted provider configs */
	encryptedProviders: AuthProvider[];
	/** Whether migration from legacy format is needed */
	needsMigration: boolean;
	/** Legacy providers that need migration */
	legacyProviders: AuthProvider[];
	/** Whether state is loading */
	isLoading: boolean;
	/** Current encryption format */
	encryptionFormat: "master" | "legacy" | "none";
}

interface MasterKeyActions {
	/** Setup a new master key */
	setupMasterKey: (passkey: string) => Promise<void>;
	/** Unlock the master key with passkey */
	unlockMasterKey: (passkey: string) => Promise<void>;
	/** Lock the master key (clear from session) */
	lockMasterKey: () => Promise<void>;
	/** Refresh state from database/session */
	refresh: () => Promise<void>;
}

export function useMasterKey(): MasterKeyState & MasterKeyActions {
	const [state, setState] = useState<MasterKeyState>({
		hasMasterKey: false,
		isUnlocked: false,
		encryptedProviders: [],
		needsMigration: false,
		legacyProviders: [],
		isLoading: true,
		encryptionFormat: "none",
	});

	const refresh = useCallback(async () => {
		setState((prev) => ({ ...prev, isLoading: true }));

		try {
			const [hasMaster, isUnlocked, format, encryptedProviders, legacyProviders] =
				await Promise.all([
					checkHasMasterKey(),
					isMasterKeyUnlocked(),
					detectEncryptionFormat(),
					getEncryptedProviders(),
					getLegacyProviders(),
				]);

			setState({
				hasMasterKey: hasMaster,
				isUnlocked,
				encryptedProviders,
				needsMigration: format === "legacy",
				legacyProviders,
				isLoading: false,
				encryptionFormat: format,
			});
		} catch (error) {
			console.error("Failed to refresh master key state:", error);
			setState((prev) => ({ ...prev, isLoading: false }));
		}
	}, []);

	// Load initial state
	useEffect(() => {
		refresh();
	}, [refresh]);

	const setupMasterKey = useCallback(
		async (passkey: string) => {
			await setupMasterKeyUtil(passkey);
			await refresh();
		},
		[refresh],
	);

	const unlockMasterKey = useCallback(
		async (passkey: string) => {
			await unlockMasterKeyUtil(passkey);
			await refresh();
		},
		[refresh],
	);

	const lockMasterKey = useCallback(async () => {
		await lockMasterKeyUtil();
		await refresh();
	}, [refresh]);

	return {
		...state,
		setupMasterKey,
		unlockMasterKey,
		lockMasterKey,
		refresh,
	};
}
