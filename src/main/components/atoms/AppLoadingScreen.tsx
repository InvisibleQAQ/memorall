import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "../ui/card";
import { Progress } from "../ui/progress";
import {
	Brain,
	Database,
	Zap,
	MessageSquare,
	CheckCircle2,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { serviceManager } from "@/services";
import type { InitializationProgress } from "@/services/service-manager";
import TypingText from "../ui/shadcn-io/typing-text";
import { isPopupSurface } from "@/utils/dom";

interface LoadingStep {
	id: string;
	icon: React.ReactNode;
	title: string;
	description: string;
	duration: number; // estimated duration in ms
}

interface AppLoadingScreenProps {
	error?: string | null;
	onRetry?: () => void;
	uiProgress?: number;
}

// Loading steps will be created inside component to access translations
const LOADING_STEP_ICONS = {
	database: <Database className="w-4 h-4" />,
	embedding: <Brain className="w-4 h-4" />,
	llm: <Zap className="w-4 h-4" />,
	interface: <MessageSquare className="w-4 h-4" />,
} as const;

const LOADING_STEP_DURATIONS = {
	database: 2000,
	embedding: 3000,
	llm: 2500,
	interface: 1500,
} as const;

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
	error,
	onRetry,
	uiProgress = 0,
}) => {
	const { t } = useTranslation("common");
	const isPopup = isPopupSurface();

	// Create loading steps with translations
	const LOADING_STEPS: LoadingStep[] = [
		{
			id: "database",
			icon: LOADING_STEP_ICONS.database,
			title: t("appLoading.steps.database.title"),
			description: t("appLoading.steps.database.description"),
			duration: LOADING_STEP_DURATIONS.database,
		},
		{
			id: "embedding",
			icon: LOADING_STEP_ICONS.embedding,
			title: t("appLoading.steps.embedding.title"),
			description: t("appLoading.steps.embedding.description"),
			duration: LOADING_STEP_DURATIONS.embedding,
		},
		{
			id: "llm",
			icon: LOADING_STEP_ICONS.llm,
			title: t("appLoading.steps.llm.title"),
			description: t("appLoading.steps.llm.description"),
			duration: LOADING_STEP_DURATIONS.llm,
		},
		{
			id: "interface",
			icon: LOADING_STEP_ICONS.interface,
			title: t("appLoading.steps.interface.title"),
			description: t("appLoading.steps.interface.description"),
			duration: LOADING_STEP_DURATIONS.interface,
		},
	];

	const [serviceProgress, setServiceProgress] =
		useState<InitializationProgress>({
			step: "Starting",
			progress: 0,
			isComplete: false,
		});
	const [elapsedTime, setElapsedTime] = useState(0);

	// Listen to real progress from ServiceManager
	useEffect(() => {
		if (error) return;

		const startTime = Date.now();

		// Update elapsed time
		const timeInterval = setInterval(() => {
			setElapsedTime(Date.now() - startTime);
		}, 100);

		// Listen to ServiceManager progress
		const unsubscribe = serviceManager.onProgressChange((progress) => {
			setServiceProgress(progress);
		});

		return () => {
			clearInterval(timeInterval);
			unsubscribe();
		};
	}, [error]);

	// Step status based on UX progress ranges
	const getStepStatus = (stepId: string) => {
		const progressToUse = uiProgress || serviceProgress.progress;

		switch (stepId) {
			case "database":
				return {
					isCompleted: progressToUse >= 5,
					isCurrent: progressToUse >= 0 && progressToUse < 5,
				};
			case "embedding":
				return {
					isCompleted: progressToUse >= 95,
					isCurrent: progressToUse >= 5 && progressToUse < 95,
				};
			case "llm":
				return {
					isCompleted: progressToUse >= 100,
					isCurrent: progressToUse >= 95 && progressToUse < 100,
				};
			case "interface":
				return {
					isCompleted: progressToUse >= 100,
					isCurrent: false, // Interface is instant when LLM completes
				};
			default:
				return { isCompleted: false, isCurrent: false };
		}
	};

	// Format elapsed time
	const formatElapsedTime = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	};

	const progressToUse = Math.round(uiProgress || serviceProgress.progress);
	const activeStep =
		LOADING_STEPS.find((step) => getStepStatus(step.id).isCurrent) ??
		LOADING_STEPS[LOADING_STEPS.length - 1];

	if (error) {
		return (
			<div
				className={`flex items-center justify-center bg-background ${
					isPopup
						? "h-full min-h-0 px-2 py-2 sm:px-3 sm:py-3"
						: "min-h-dvh px-3 py-4 sm:px-4"
				}`}
			>
				<Card
					className={`border-destructive ${
						isPopup ? "w-full max-w-none shadow-lg" : "w-full max-w-[480px]"
					}`}
				>
					<CardContent className={isPopup ? "p-3 sm:p-4" : "p-4 sm:p-6"}>
						<div className="text-center">
							<div
								className={`mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center overflow-hidden ${
									isPopup
										? "h-11 w-11 sm:h-12 sm:w-12"
										: "h-14 w-14 sm:h-16 sm:w-16"
								}`}
							>
								<img
									src="/logo.png"
									alt="Memorall Logo"
									className={`object-contain opacity-50 ${
										isPopup
											? "h-9 w-9 sm:h-10 sm:w-10"
											: "h-12 w-12 sm:h-14 sm:w-14"
									}`}
								/>
							</div>
							<h2
								className={`font-semibold text-foreground mb-2 ${
									isPopup ? "text-lg" : "text-xl"
								}`}
							>
								{t("appLoading.error.title")}
							</h2>
							<p className="text-sm text-muted-foreground mb-6 break-words">
								{error}
							</p>
							<div className={isPopup ? "space-y-2" : "space-y-3"}>
								<button
									onClick={onRetry}
									className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium inline-flex items-center justify-center gap-2"
								>
									<RefreshCw className="w-4 h-4" />
									{t("appLoading.error.tryAgain")}
								</button>
								<p className="text-xs text-muted-foreground">
									{t("appLoading.error.consoleHelp")}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (isPopup) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center bg-background p-2 sm:p-3">
				<Card className="relative h-full w-full max-w-[560px] overflow-hidden border-0 shadow-xl">
					<div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/14 via-primary/5 to-transparent sm:h-28" />
					<CardContent className="relative flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-4">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15 sm:h-12 sm:w-12 sm:rounded-2xl">
								<img
									src="/logo.png"
									alt="Memorall Logo"
									className="h-8 w-8 object-contain sm:h-9 sm:w-9"
								/>
							</div>
							<div className="min-w-0 flex-1">
								<div className="label-mono text-[11px] text-primary/80">
									Memorall
								</div>
								<h2 className="mt-1 text-base font-semibold tracking-tight text-foreground sm:text-lg">
									{t("appLoading.title")}
								</h2>
								<p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
									{activeStep?.description ?? t("appLoading.subtitle")}
								</p>
							</div>
							<div className="shrink-0 rounded-full border border-border bg-background/80 px-2 py-1 text-[11px] font-medium text-muted-foreground sm:px-2.5">
								{progressToUse}%
							</div>
						</div>

						<div className="space-y-2 rounded-xl border border-border/80 bg-background/80 p-3 sm:space-y-2.5 sm:rounded-2xl">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-foreground">
										{serviceProgress.step}
									</div>
									<div className="text-[11px] text-muted-foreground">
										{t("appLoading.elapsed", {
											time: formatElapsedTime(elapsedTime),
										})}
									</div>
								</div>
								<Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
							</div>
							<Progress
								value={progressToUse}
								className="h-1.5 rounded-full bg-muted/70"
							/>
						</div>

						<div className="grid gap-1.5 sm:gap-2">
							{LOADING_STEPS.map((step, index) => {
								const { isCompleted, isCurrent } = getStepStatus(step.id);

								return (
									<div
										key={step.id}
										className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-all duration-300 sm:gap-3 sm:px-3 sm:py-2.5 ${
											isCompleted
												? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900 dark:bg-emerald-950/30"
												: isCurrent
													? "border-primary/25 bg-primary/5 shadow-sm"
													: "border-border/70 bg-muted/20"
										}`}
									>
										<div
											className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 sm:h-8 sm:w-8 ${
												isCompleted
													? "bg-emerald-500 text-white"
													: isCurrent
														? "bg-primary text-primary-foreground"
														: "bg-muted text-muted-foreground"
											}`}
										>
											{isCompleted ? (
												<CheckCircle2 className="h-4 w-4" />
											) : isCurrent ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												step.icon
											)}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2">
												<div className="truncate text-sm font-medium text-foreground">
													{step.title}
												</div>
												<div className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:tracking-[0.18em]">
													0{index + 1}
												</div>
											</div>
											<div className="truncate text-xs text-muted-foreground">
												{step.description}
											</div>
										</div>
									</div>
								);
							})}
						</div>

						<div className="mt-auto flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
							<span className="min-w-0 truncate">
								{t("appLoading.firstLaunch")}
							</span>
							<span className="shrink-0 truncate">{activeStep?.title}</span>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex min-h-dvh items-center justify-center bg-background px-3 py-4 sm:px-4">
			<Card className="w-full max-w-[520px] border-0 shadow-xl">
				<CardContent className="p-4 sm:p-8">
					<div className="text-center">
						{/* Header with animated title */}
						<div className="mb-5 sm:mb-8">
							<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary/60 sm:h-20 sm:w-20">
								<img
									src="/logo.png"
									alt="Memorall Logo"
									className="h-12 w-12 object-contain sm:h-14 sm:w-14"
								/>
							</div>
							<TypingText
								text={[
									t("appLoading.title"),
									t("appLoading.subtitle"),
									...(t("appLoading.taglines", {
										returnObjects: true,
									}) as string[]),
								]}
								typingSpeed={60}
								pauseDuration={200}
								showCursor={true}
								cursorCharacter="|"
								className="break-words text-2xl font-bold leading-tight sm:text-4xl"
								textColors={["#3b82f6", "#8b5cf6", "#06b6d4"]}
								variableSpeed={{ min: 50, max: 120 }}
							/>
							<p className="text-sm text-muted-foreground">
								{t("appLoading.subtitle")}
							</p>
						</div>

						{/* Progress bar */}
						<div className="mb-5 sm:mb-6">
							<div className="flex justify-between items-center mb-2">
								<span className="text-sm font-medium text-foreground">
									{serviceProgress.step}
								</span>
								<span className="text-sm text-muted-foreground">
									{progressToUse}%
								</span>
							</div>
							<Progress
								value={progressToUse}
								className="h-2 transition-all duration-300"
							/>
						</div>

						{/* Loading steps */}
						<div className="space-y-2 text-left sm:space-y-3">
							{LOADING_STEPS.map((step) => {
								const { isCompleted, isCurrent } = getStepStatus(step.id);

								return (
									<div
										key={step.id}
										className={`flex items-center gap-2.5 rounded-lg p-2.5 transition-all duration-300 sm:gap-3 sm:p-3 ${
											isCompleted
												? "bg-green-50 dark:bg-green-950/20"
												: isCurrent
													? "bg-primary/5 border border-primary/20"
													: "bg-muted/30"
										}`}
									>
										<div
											className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 sm:h-8 sm:w-8 ${
												isCompleted
													? "bg-green-500 text-white"
													: isCurrent
														? "bg-primary text-primary-foreground"
														: "bg-muted text-muted-foreground"
											}`}
										>
											{isCompleted ? (
												<CheckCircle2 className="h-4 w-4" />
											) : isCurrent ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												step.icon
											)}
										</div>
										<div className="min-w-0 flex-1">
											<div
												className={`truncate text-sm font-medium transition-colors ${
													isCompleted
														? "text-green-700 dark:text-green-300"
														: isCurrent
															? "text-foreground"
															: "text-muted-foreground"
												}`}
											>
												{step.title}
											</div>
											<div
												className={`line-clamp-2 text-xs transition-colors ${
													isCompleted
														? "text-green-600 dark:text-green-400"
														: isCurrent
															? "text-foreground/80"
															: "text-muted-foreground/80"
												}`}
											>
												{step.description}
											</div>
										</div>
										{isCompleted && (
											<div className="shrink-0 text-xs font-medium text-green-600 dark:text-green-400">
												{t("appLoading.done")}
											</div>
										)}
									</div>
								);
							})}
						</div>

						{/* Footer info */}
						<div className="mt-5 border-t border-border pt-4 sm:mt-8 sm:pt-6">
							<div className="flex flex-col gap-1 text-xs text-muted-foreground min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
								<span>
									{t("appLoading.elapsed", {
										time: formatElapsedTime(elapsedTime),
									})}
								</span>
								<span>{t("appLoading.firstLaunch")}</span>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
