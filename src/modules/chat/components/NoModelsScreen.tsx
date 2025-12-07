import React from "react";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { YourModels } from "@/modules/llm/components/YourModels";
import { useAuth } from "@/modules/supabase";
import type { ServiceProvider } from "@/services/llm/interfaces/llm-service.interface";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface NoModelsScreenProps {
	onModelLoaded: (modelId: string, provider: ServiceProvider) => void;
	onNavigateToModels: () => void;
}

export const NoModelsScreen: React.FC<NoModelsScreenProps> = ({
	onModelLoaded,
	onNavigateToModels,
}) => {
	const { t } = useTranslation("chat");
	const navigate = useNavigate();
	const { isLoading, isInitialized } = useAuth();
	const [showAdvanced, setShowAdvanced] = React.useState(false);

	// Wait for auth to initialize
	if (!isInitialized || isLoading) {
		return (
			<div className="flex flex-col h-full bg-background">
				<div className="flex-1 flex items-center justify-center">
					<div className="text-center">
						<img
							src="/logo.png"
							alt="Memorall Logo"
							className="w-12 h-12 mx-auto mb-4 object-contain animate-pulse"
						/>
						<p className="text-muted-foreground">{t("noModels.loading")}</p>
					</div>
				</div>
			</div>
		);
	}

	// Show no-models screen with app branding always visible
	return (
		<div className="flex flex-col h-full bg-background">
			<div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
				<div className="w-full max-w-2xl mx-auto space-y-6 max-h-full">
					{/* App Branding - Always visible */}
					<div className="text-center space-y-3">
						<img
							src="/logo.png"
							alt="Memorall Logo"
							className="w-16 h-16 mx-auto object-contain"
						/>
						<h1 className="text-2xl font-semibold">{t("noModels.appName")}</h1>
						<h2 className="text-lg font-medium text-muted-foreground">
							{t("noModels.appDescription")}
						</h2>
					</div>

					{/* Login Section */}
					{!showAdvanced && (
						<Card className="border-2 border-primary">
							<CardContent className="pt-6 space-y-3">
								<p className="text-sm text-muted-foreground text-center">
									{t("noModels.signInDescription")}
								</p>
								<Button
									onClick={() => navigate("/auth")}
									className="w-full"
									size="lg"
								>
									<LogIn className="w-5 h-5 mr-2" />
									{t("noModels.signInOrSignUp")}
								</Button>
							</CardContent>
						</Card>
					)}

					{/* Advanced Options */}
					<details className="group" open={showAdvanced}>
						<summary
							onClick={(e) => {
								e.preventDefault();
								setShowAdvanced((prev) => !prev);
							}}
							className="cursor-pointer text-sm text-muted-foreground hover:text-foreground text-center"
						>
							{t("noModels.showAdvancedOptions")}
						</summary>
						<div className="mt-4">
							<h2 className="text-lg font-semibold mb-1">
								{t("noModels.title")}
							</h2>
							<p className="text-sm text-muted-foreground mb-3">
								{t("noModels.description")}
							</p>
							<YourModels
								onModelLoaded={onModelLoaded}
								showQuickDownload={true}
							/>
						</div>
					</details>
				</div>
			</div>
		</div>
	);
};
