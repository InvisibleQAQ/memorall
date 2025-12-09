import React, {
	createContext,
	useContext,
	useState,
	useCallback,
	useEffect,
} from "react";
import { useTranslation } from "react-i18next";
import { serviceManager } from "@/services";
import { logError } from "@/utils/logger";

export interface CopilotStep {
	id: string;
	title: string;
	content: string;
	target: string; // CSS selector or element ID
	placement?: "top" | "bottom" | "left" | "right";
	action?: "navigate" | "click" | "none";
	navigationPath?: string; // For navigate action
	disableBeacon?: boolean;
	showProgress?: boolean;
}

interface CopilotState {
	isActive: boolean;
	currentStep: number;
	steps: CopilotStep[];
	hasCompletedTour: boolean;
	showOnFirstVisit: boolean;
	hasLLMConfigured: boolean;
	isServicesReady: boolean;
}

interface CopilotContextType {
	state: CopilotState;
	startTour: (steps?: CopilotStep[]) => void;
	nextStep: () => void;
	prevStep: () => void;
	skipTour: () => void;
	endTour: () => void;
	goToStep: (stepIndex: number) => void;
	registerStep: (step: CopilotStep) => void;
	setSteps: (steps: CopilotStep[]) => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

const STORAGE_KEY = "memorall-copilot-completed";

// Default steps will be created inside component to access translations

export const CopilotProvider: React.FC<{ children: React.ReactNode }> = ({
	children,
}) => {
	const { t } = useTranslation("common");

	// Create default steps with translations
	const defaultSteps: CopilotStep[] = [
		{
			id: "welcome",
			title: t("copilot.steps.welcome.title"),
			content: t("copilot.steps.welcome.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "product-overview",
			title: t("copilot.steps.productOverview.title"),
			content: t("copilot.steps.productOverview.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "chat-tab-quick",
			title: t("copilot.steps.chatTab.title"),
			content: t("copilot.steps.chatTab.content"),
			target: '[href="/"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/",
			showProgress: true,
		},
		{
			id: "documents-tab-quick",
			title: t("copilot.steps.documentsTab.title"),
			content: t("copilot.steps.documentsTab.content"),
			target: '[href="/documents"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/documents",
			showProgress: true,
		},
		{
			id: "knowledge-graph-tab-quick",
			title: t("copilot.steps.knowledgeGraphTab.title"),
			content: t("copilot.steps.knowledgeGraphTab.content"),
			target: '[href="/knowledge-graph"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/knowledge-graph",
			showProgress: true,
		},
		{
			id: "models-tab-intro",
			title: t("copilot.steps.modelsTabIntro.title"),
			content: t("copilot.steps.modelsTabIntro.content"),
			target: '[href="/llm"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/llm",
			showProgress: true,
		},
		{
			id: "current-model-section",
			title: t("copilot.steps.currentModelSection.title"),
			content: t("copilot.steps.currentModelSection.content"),
			target: '[data-copilot="current-model"]',
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "quick-setup-section",
			title: t("copilot.steps.quickSetupSection.title"),
			content: t("copilot.steps.quickSetupSection.content"),
			target: '[data-copilot="quick-setup"]',
			placement: "top",
			showProgress: true,
		},
		{
			id: "provider-advantages",
			title: t("copilot.steps.providerAdvantages.title"),
			content: t("copilot.steps.providerAdvantages.content"),
			target: '[data-copilot="quick-setup"]',
			placement: "top",
			showProgress: true,
		},
		{
			id: "get-started",
			title: t("copilot.steps.getStarted.title"),
			content: t("copilot.steps.getStarted.content"),
			target: '[href="/"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/",
			showProgress: true,
		},
	];

	const [state, setState] = useState<CopilotState>(() => {
		const hasCompleted = localStorage.getItem(STORAGE_KEY) === "true";
		return {
			isActive: false,
			currentStep: 0,
			steps: defaultSteps,
			hasCompletedTour: hasCompleted,
			showOnFirstVisit: !hasCompleted,
			hasLLMConfigured: false,
			isServicesReady: false,
		};
	});

	// Monitor service manager and LLM status
	useEffect(() => {
		const checkServicesStatus = async () => {
			try {
				const isReady = serviceManager.isInitialized();
				let hasLLM = false;

				if (isReady) {
					const currentModel =
						await serviceManager.llmService.getCurrentModel();
					hasLLM = !!currentModel;
				}

				setState((prev) => ({
					...prev,
					isServicesReady: isReady,
					hasLLMConfigured: hasLLM,
				}));
			} catch (error) {
				logError("Failed to check services status:", error);
			}
		};

		// Check immediately
		checkServicesStatus();

		// Set up periodic checks
		const interval = setInterval(checkServicesStatus, 2000);

		return () => clearInterval(interval);
	}, []);

	const startTour = useCallback((customSteps?: CopilotStep[]) => {
		setState((prev) => ({
			...prev,
			isActive: true,
			currentStep: 0,
			steps: customSteps || prev.steps,
		}));
	}, []);

	const nextStep = useCallback(() => {
		setState((prev) => {
			if (prev.currentStep < prev.steps.length - 1) {
				return { ...prev, currentStep: prev.currentStep + 1 };
			} else {
				// Tour complete
				localStorage.setItem(STORAGE_KEY, "true");
				return {
					...prev,
					isActive: false,
					hasCompletedTour: true,
					showOnFirstVisit: false,
				};
			}
		});
	}, []);

	const prevStep = useCallback(() => {
		setState((prev) => ({
			...prev,
			currentStep: Math.max(0, prev.currentStep - 1),
		}));
	}, []);

	const skipTour = useCallback(() => {
		localStorage.setItem(STORAGE_KEY, "true");
		setState((prev) => ({
			...prev,
			isActive: false,
			hasCompletedTour: true,
			showOnFirstVisit: false,
		}));
	}, []);

	const endTour = useCallback(() => {
		localStorage.setItem(STORAGE_KEY, "true");
		setState((prev) => ({
			...prev,
			isActive: false,
			hasCompletedTour: true,
			showOnFirstVisit: false,
		}));
	}, []);

	const goToStep = useCallback((stepIndex: number) => {
		setState((prev) => ({
			...prev,
			currentStep: Math.max(0, Math.min(stepIndex, prev.steps.length - 1)),
		}));
	}, []);

	const registerStep = useCallback((step: CopilotStep) => {
		setState((prev) => ({
			...prev,
			steps: [...prev.steps.filter((s) => s.id !== step.id), step],
		}));
	}, []);

	const setSteps = useCallback((steps: CopilotStep[]) => {
		setState((prev) => ({ ...prev, steps }));
	}, []);

	const contextValue: CopilotContextType = {
		state,
		startTour,
		nextStep,
		prevStep,
		skipTour,
		endTour,
		goToStep,
		registerStep,
		setSteps,
	};

	return (
		<CopilotContext.Provider value={contextValue}>
			{children}
		</CopilotContext.Provider>
	);
};

export const useCopilot = (): CopilotContextType => {
	const { t } = useTranslation("common");
	const context = useContext(CopilotContext);
	if (!context) {
		throw new Error(t("copilot.error"));
	}
	return context;
};
