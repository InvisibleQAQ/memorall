import { configure, InMemory, fs, resolveMountConfig } from "@zenfs/core";
import { IndexedDB } from "@zenfs/dom";
import { logDebug, logError, logInfo } from "@/utils/logger";

let fsReady = false;
let fsReadyPromise: Promise<void> | null = null;
let refreshInProgress = false;

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

/**
 * Force ZenFS to refresh its cache by reconfiguring it
 * This is necessary when files are modified in a different context (e.g., offscreen)
 * and we need to ensure the current context sees the latest data from IndexedDB
 */
const refreshFsCache = async (): Promise<void> => {
	// Prevent concurrent refresh attempts
	if (refreshInProgress) {
		logInfo("⏸️ Refresh already in progress, skipping...");
		return;
	}

	refreshInProgress = true;

	try {
		logInfo("🔄 Refreshing ZenFS cache (unmounting and reconfiguring filesystem)");

		// Reset state to force reconfiguration
		fsReady = false;
		fsReadyPromise = null;

		// Unmount existing mounts to avoid "already in use" errors
		try {
			await fs.umount("/tmp");
			logInfo("📤 Unmounted /tmp");
		} catch (e) {
			// Ignore if not mounted
			logDebug("Could not unmount /tmp:", e);
		}

		try {
			await fs.umount("/home");
			logInfo("📤 Unmounted /home");
		} catch (e) {
			// Ignore if not mounted
			logDebug("Could not unmount /home:", e);
		}

		// Small delay to ensure unmounting is complete
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Reconfigure the filesystem - this forces ZenFS to reload from IndexedDB
		await configure({
			mounts: {
				"/tmp": InMemory,
				"/home": IndexedDB,
			},
		});

		fsReady = true;
		logInfo("✅ ZenFS cache refreshed successfully");
	} catch (error) {
		logError("Failed to refresh ZenFS cache:", error);
		// Reset state so next call can try again
		fsReady = false;
		fsReadyPromise = null;
		throw error;
	} finally {
		refreshInProgress = false;
	}
};

// Start initialization immediately
initializeFs();

// Export both the fs object and the ready promise
export default fs;
export { initializeFs, fsReady, refreshFsCache };
