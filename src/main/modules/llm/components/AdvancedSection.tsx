import React from "react";
import { Card, CardContent } from "@/main/components/ui/card";
import { ProviderPanel } from "./ProviderPanel";
import type { FileInfo, ProgressData } from "../hooks/use-llm-state";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";

interface AdvancedSectionProps {
	repo: string;
	setRepo: (repo: string) => void;
	filePath: string;
	setFilePath: (filePath: string) => void;
	availableFiles: FileInfo[];
	setAvailableFiles: (files: FileInfo[]) => void;
	advancedProvider: ServiceProvider;
	setAdvancedProvider: (provider: ServiceProvider) => void;
	model: string;
	setModel: (model: string) => void;
	webllmAvailableModels: string[];
	customRepo: string;
	setCustomRepo: (repo: string) => void;
	useCustomRepo: boolean;
	setUseCustomRepo: (use: boolean) => void;
	status: string;
	logs: string[];
	loading: boolean;
	prompt: string;
	setPrompt: (prompt: string) => void;
	output: string;
	ready: boolean;
	downloadProgress: ProgressData;
	onLoadModel: () => Promise<void>;
	onLoadAdvancedModel: () => Promise<void>;
	onUnloadModel: () => Promise<void>;
	onGenerate: () => Promise<void>;
	onFetchRepoFiles: (repoInfo: string) => Promise<void>;
	onProviderChange: () => void;
	onWebLLMTabSelect: (webllmAvailableModels: string[]) => void;
	onOpenAITabSelect: () => void;
	onModelLoaded?: (modelId: string, provider: ServiceProvider) => void;
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = (props) => (
	<Card className="rounded-none md:rounded-lg">
		<CardContent className="p-0">
			<ProviderPanel {...props} />
		</CardContent>
	</Card>
);
