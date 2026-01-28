import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Sparkles, type LucideIcon } from "lucide-react";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/main/components/ui/card";
import { OpenAITab } from "./OpenAITab";
import { OpenRouterTab } from "./OpenRouterTab";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";

type ProviderKey = "openai" | "openrouter";

interface ProviderConfig {
	key: ProviderKey;
	icon: LucideIcon;
	iconColor: string;
	iconBgColor: string;
	component: React.ComponentType<{
		onModelLoaded?: (modelId: string, provider: ServiceProvider) => void;
	}>;
}

const PROVIDERS: ProviderConfig[] = [
	{
		key: "openai",
		icon: Sparkles,
		iconColor: "text-primary",
		iconBgColor: "bg-primary/10",
		component: OpenAITab,
	},
	{
		key: "openrouter",
		icon: Globe,
		iconColor: "text-purple-600 dark:text-purple-500",
		iconBgColor: "bg-purple-500/10",
		component: OpenRouterTab,
	},
];

interface ExternalProvidersConfigProps {
	onModelLoaded?: (modelId: string, provider: ServiceProvider) => void;
	defaultProvider?: ProviderKey;
}

export const ExternalProvidersConfig: React.FC<
	ExternalProvidersConfigProps
> = ({ onModelLoaded, defaultProvider }) => {
	const { t } = useTranslation("llm");
	const [activeProvider, setActiveProvider] = useState<ProviderKey>(
		defaultProvider || PROVIDERS[0].key,
	);

	const activeConfig = PROVIDERS.find((p) => p.key === activeProvider);
	const ActiveComponent = activeConfig?.component;

	return (
		<div className="space-y-6">
			{/* Providers Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{PROVIDERS.map((provider) => {
					const Icon = provider.icon;
					const isActive = activeProvider === provider.key;

					return (
						<Card
							key={provider.key}
							className={`cursor-pointer transition-all border-2 ${
								isActive
									? "border-primary bg-primary/5"
									: "border-border hover:border-primary/50"
							}`}
							onClick={() => setActiveProvider(provider.key)}
						>
							<CardHeader className="p-4">
								<div className="flex items-center gap-3">
									<div className={`p-2 rounded-lg ${provider.iconBgColor}`}>
										<Icon className={`w-5 h-5 ${provider.iconColor}`} />
									</div>
									<div>
										<CardTitle className="text-base">
											{t(`externalProviders.providers.${provider.key}.name`)}
										</CardTitle>
										<CardDescription className="text-xs">
											{t(
												`externalProviders.providers.${provider.key}.description`,
											)}
										</CardDescription>
									</div>
								</div>
							</CardHeader>
						</Card>
					);
				})}
			</div>

			{/* Configuration Panel */}
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">
						{t("externalProviders.configureProvider", {
							provider: t(`externalProviders.providers.${activeProvider}.name`),
						})}
					</CardTitle>
					<CardDescription>
						{t("externalProviders.connectProvider", {
							provider: t(`externalProviders.providers.${activeProvider}.name`),
						})}
					</CardDescription>
				</CardHeader>
				<div className="p-6 pt-0">
					{ActiveComponent && (
						<ActiveComponent
							onModelLoaded={(modelId) =>
								onModelLoaded?.(modelId, activeProvider as ServiceProvider)
							}
						/>
					)}
				</div>
			</Card>

			{/* Help Text */}
			<div className="text-center space-y-2 py-4">
				<p className="text-sm text-muted-foreground">
					{t("externalProviders.noApiKey")}
				</p>
				<div className="flex justify-center gap-4 text-xs flex-wrap">
					{PROVIDERS.map((provider) => (
						<a
							key={provider.key}
							href={t(`externalProviders.providers.${provider.key}.apiKeyUrl`)}
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							{t("externalProviders.getApiKey", {
								provider: t(`externalProviders.providers.${provider.key}.name`),
							})}{" "}
							→
						</a>
					))}
				</div>
			</div>
		</div>
	);
};
