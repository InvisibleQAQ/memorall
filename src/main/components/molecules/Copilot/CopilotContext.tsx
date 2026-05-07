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
			id: "chat-navigate",
			title: t("copilot.steps.chatNavigate.title"),
			content: t("copilot.steps.chatNavigate.content"),
			target: '[href="/"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/",
			showProgress: true,
		},
		{
			id: "layout-explain",
			title: t("copilot.steps.layoutExplain.title"),
			content: t("copilot.steps.layoutExplain.content"),
			target: "nav",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "documents-navigate",
			title: t("copilot.steps.documentsNavigate.title"),
			content: t("copilot.steps.documentsNavigate.content"),
			target: '[href="/documents"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/documents",
			showProgress: true,
		},
		{
			id: "documents-explain",
			title: t("copilot.steps.documentsExplain.title"),
			content: t("copilot.steps.documentsExplain.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "agents-navigate",
			title: t("copilot.steps.agentsNavigate.title"),
			content: t("copilot.steps.agentsNavigate.content"),
			target: '[href="/agents"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/agents",
			showProgress: true,
		},
		{
			id: "agents-explain",
			title: t("copilot.steps.agentsExplain.title"),
			content: t("copilot.steps.agentsExplain.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "knowledge-navigate",
			title: t("copilot.steps.knowledgeNavigate.title"),
			content: t("copilot.steps.knowledgeNavigate.content"),
			target: '[href="/knowledge-graph"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/knowledge-graph",
			showProgress: true,
		},
		{
			id: "knowledge-explain",
			title: t("copilot.steps.knowledgeExplain.title"),
			content: t("copilot.steps.knowledgeExplain.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "models-navigate",
			title: t("copilot.steps.modelsNavigate.title"),
			content: t("copilot.steps.modelsNavigate.content"),
			target: '[href="/llm"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/llm",
			showProgress: true,
		},
		{
			id: "models-explain",
			title: t("copilot.steps.modelsExplain.title"),
			content: t("copilot.steps.modelsExplain.content"),
			target: "body",
			placement: "bottom",
			showProgress: true,
		},
		{
			id: "chat-final-navigate",
			title: t("copilot.steps.chatFinalNavigate.title"),
			content: t("copilot.steps.chatFinalNavigate.content"),
			target: '[href="/"]',
			placement: "bottom",
			action: "navigate",
			navigationPath: "/",
			showProgress: true,
		},
		{
			id: "chat-setup",
			title: t("copilot.steps.chatSetup.title"),
			content: t("copilot.steps.chatSetup.content"),
			target: "body",
			placement: "bottom",
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
