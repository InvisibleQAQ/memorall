/**
 * Port Bridge for Chrome Extension
 *
 * Relays Port connections from popup/UI to offscreen document.
 * Required because chrome.runtime.connect() from popup goes to background script,
 * not directly to offscreen documents.
 *
 * Architecture:
 * Popup --[Port]--> Background (this bridge) --[Port]--> Offscreen
 */

import { logInfo, logError, logWarn } from "@/utils/logger";

interface PortPair {
	popupPort: chrome.runtime.Port;
	offscreenPort: chrome.runtime.Port;
}

class PortBridge {
	private activeBridges = new Map<string, PortPair>();

	/**
	 * Initialize the Port bridge
	 * Listens for Port connections from popup and relays them to offscreen
	 */
	initialize({
		proxyOptions,
	}: {
		proxyOptions: {
			channelName: string;
		};
	}): void {
		logInfo("🌉 RPC Port bridge initializing...", {
			channelName: proxyOptions.channelName,
		});

		chrome.runtime.onConnect.addListener((popupPort) => {
			logInfo("🔍 RPC PORT BRIDGE: onConnect event fired", {
				portName: popupPort.name,
				expectedChannel: proxyOptions.channelName,
				hasSender: !!popupPort.sender,
				senderInfo: popupPort.sender
					? {
							id: popupPort.sender.id,
							url: popupPort.sender.url,
							origin: popupPort.sender.origin,
						}
					: null,
				timestamp: new Date().toISOString(),
			});

			// Only handle pglite-rpc connections
			if (popupPort.name !== proxyOptions.channelName) {
				logInfo("🔍 PORT BRIDGE: Ignoring - channel name mismatch", {
					received: popupPort.name,
					expected: proxyOptions.channelName,
				});
				return;
			}

			// Only handle connections from popup, not from background itself
			// popupPort.sender will be undefined if the connection is from the same context (background)
			if (!popupPort.sender) {
				logInfo(
					"🔍 PORT BRIDGE: Ignoring - no sender (background self-connection)",
				);
				return;
			}

			logInfo("🌉 Port bridge: Popup connected, creating bridge to offscreen", {
				portName: popupPort.name,
				timestamp: new Date().toISOString(),
			});

			try {
				logInfo(
					"🔍 PORT BRIDGE: Calling chrome.runtime.connect to create offscreen port...",
					{
						channelName: popupPort.name,
						timestamp: new Date().toISOString(),
					},
				);

				// Create matching Port connection to offscreen document
				const offscreenPort = chrome.runtime.connect({ name: popupPort.name });

				logInfo("🔍 PORT BRIDGE: Offscreen port created successfully", {
					portName: offscreenPort.name,
					hasPort: !!offscreenPort,
					timestamp: new Date().toISOString(),
				});

				// Store the bridge
				const bridgeId = `${popupPort.name}-${Date.now()}`;
				this.activeBridges.set(bridgeId, { popupPort, offscreenPort });

				// Set up bidirectional message relay
				this.setupRelay(bridgeId, popupPort, offscreenPort);

				logInfo("✅ Port bridge established", {
					bridgeId,
					portName: popupPort.name,
					timestamp: new Date().toISOString(),
				});
			} catch (error) {
				logError("❌ Failed to create port bridge to offscreen:", error);
				// Disconnect popup port if offscreen connection fails
				try {
					popupPort.disconnect();
				} catch {}
			}
		});

		logInfo("🌉 Port bridge initialized - ready to relay popup ↔ offscreen");
	}

	/**
	 * Set up bidirectional message relay between popup and offscreen ports
	 */
	private setupRelay(
		bridgeId: string,
		popupPort: chrome.runtime.Port,
		offscreenPort: chrome.runtime.Port,
	): void {
		// Relay messages from popup to offscreen
		popupPort.onMessage.addListener((message) => {
			try {
				offscreenPort.postMessage(message);
			} catch (error) {
				logWarn("Failed to relay message from popup to offscreen:", error);
			}
		});

		// Relay messages from offscreen to popup
		offscreenPort.onMessage.addListener((message) => {
			try {
				popupPort.postMessage(message);
			} catch (error) {
				logWarn("Failed to relay message from offscreen to popup:", error);
			}
		});

		// Handle disconnection - clean up when either side disconnects
		const cleanup = () => {
			logInfo("🌉 Port bridge disconnected", { bridgeId });

			// Remove listeners and disconnect both ports
			try {
				popupPort.disconnect();
			} catch {}
			try {
				offscreenPort.disconnect();
			} catch {}

			// Remove from active bridges
			this.activeBridges.delete(bridgeId);
		};

		popupPort.onDisconnect.addListener(cleanup);
		offscreenPort.onDisconnect.addListener(cleanup);
	}

	/**
	 * Get number of active port bridges
	 */
	getActiveBridgeCount(): number {
		return this.activeBridges.size;
	}
}

// Singleton instance
export const portBridge = new PortBridge();
