import {
	restoreAllProviders,
	getEncryptedProviders,
} from "@/utils/auth-provider-restore";
import { unlockMasterKey } from "@/utils/master-key";

export interface UnlockAndRestoreProvidersResult {
	masterStrongPassword: string;
	providers: string[];
}

export async function unlockAndRestoreProvidersWithPasskey(
	passkey: string,
): Promise<UnlockAndRestoreProvidersResult> {
	const masterStrongPassword = await unlockMasterKey(passkey);
	const providers = await getEncryptedProviders();
	await restoreAllProviders(masterStrongPassword);

	return {
		masterStrongPassword,
		providers,
	};
}
