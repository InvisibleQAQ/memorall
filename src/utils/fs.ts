import { configure, InMemory, fs } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { logDebug, logError } from "@/utils/logger";

let fsReady = false;
let fsReadyPromise: Promise<void> | null = null;

// Initialize filesystem configuration
const initializeFs = async (): Promise<void> => {
	if (fsReady) return;

	if (!fsReadyPromise) {
		fsReadyPromise = configure({
			mounts: {
				"/tmp": InMemory,
				"/home": IndexedDB,
			},
		})
			.then(() => {
				fsReady = true;
				logDebug("Filesystem configured");
			})
			.catch((error) => {
				logError("Filesystem configuration error", error);
				fsReadyPromise = null; // Reset so retry is possible
				throw error;
			});
	}

	return fsReadyPromise;
};

// Start initialization immediately
initializeFs();

// Export both the fs object and the ready promise
export default fs;
export { initializeFs, fsReady };
