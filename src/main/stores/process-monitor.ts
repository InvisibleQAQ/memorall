/**
 * Process Monitor Store
 * Manages state for tracking knowledge graph processing and other background jobs
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { Source } from "@/services/database/entities/sources";
import { getEffectiveSourceStatus } from "@/services/database/types";

const PROCESS_TIMEOUT_MINUTES = 60;

const isActiveStatus = (status: string | null | undefined): boolean =>
	status === "pending" || status === "processing";

const getEffectiveProcessStatus = (source: Source): string =>
	getEffectiveSourceStatus(source, PROCESS_TIMEOUT_MINUTES);

export interface ProcessingSource extends Source {
	progress?: number;
	stage?: string;
}

export interface ProcessMonitorState {
	// Active processes (in-memory, real-time)
	activeProcesses: Map<string, ProcessingSource>;

	// History from database (cached)
	processHistory: Source[];
	historyLoading: boolean;

	// Actions
	addProcess: (filePath: string, source: ProcessingSource) => void;
	updateProcess: (filePath: string, updates: Partial<ProcessingSource>) => void;
	removeProcess: (filePath: string) => void;
	setProcessHistory: (history: Source[]) => void;
	setHistoryLoading: (loading: boolean) => void;

	// Computed
	hasActiveProcesses: () => boolean;
	getProcessByFilePath: (filePath: string) => ProcessingSource | undefined;
	isProcessing: (filePath: string) => boolean;
}

export const useProcessMonitor = create<ProcessMonitorState>()(
	subscribeWithSelector((set, get) => ({
		activeProcesses: new Map(),
		processHistory: [],
		historyLoading: false,

		addProcess: (filePath: string, source: ProcessingSource) => {
			set((state) => {
				const newProcesses = new Map(state.activeProcesses);
				newProcesses.set(filePath, source);
				return { activeProcesses: newProcesses };
			});
		},

		updateProcess: (filePath: string, updates: Partial<ProcessingSource>) => {
			set((state) => {
				const newProcesses = new Map(state.activeProcesses);
				const existing = newProcesses.get(filePath);
				if (existing) {
					newProcesses.set(filePath, { ...existing, ...updates });
				}
				return { activeProcesses: newProcesses };
			});
		},

		removeProcess: (filePath: string) => {
			set((state) => {
				const newProcesses = new Map(state.activeProcesses);
				newProcesses.delete(filePath);
				return { activeProcesses: newProcesses };
			});
		},

		setProcessHistory: (history: Source[]) => {
			set({ processHistory: history });
		},

		setHistoryLoading: (loading: boolean) => {
			set({ historyLoading: loading });
		},

		hasActiveProcesses: () => {
			return Array.from(get().activeProcesses.values()).some((process) =>
				isActiveStatus(getEffectiveProcessStatus(process)),
			);
		},

		getProcessByFilePath: (filePath: string) => {
			return get().activeProcesses.get(filePath);
		},

		isProcessing: (filePath: string) => {
			const process = get().activeProcesses.get(filePath);
			return process
				? isActiveStatus(getEffectiveProcessStatus(process))
				: false;
		},
	})),
);

/**
 * Hook to check if a specific file is currently being processed
 */
export function useIsProcessing(filePath: string): boolean {
	return useProcessMonitor((state) => state.isProcessing(filePath));
}

/**
 * Hook to get active process count
 */
export function useActiveProcessCount(): number {
	return useProcessMonitor(
		(state) =>
			Array.from(state.activeProcesses.values()).filter((process) =>
				isActiveStatus(getEffectiveProcessStatus(process)),
			).length,
	);
}
