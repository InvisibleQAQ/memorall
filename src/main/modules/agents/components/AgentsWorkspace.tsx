import React from "react";
import { useTranslation } from "react-i18next";
import { CreateFlowDialog } from "@/main/modules/flow-builder/components";
import {
	AgentWizardChatPanel,
	AgentWizardTemplatePanel,
} from "@/main/modules/agent-wizard";
import { AgentPresetList } from "./AgentPresetList";
import { AgentConfigForm } from "./AgentConfigForm";
import {
	AgentMemoryTypeDialog,
	AgentMemoryTypeFields,
	type CreateAgentTopicOptions,
} from "./AgentMemoryTypeControls";
import { AgentsWorkspaceLayout } from "./AgentsWorkspaceLayout";
import { useAgentsWorkspaceController } from "../hooks/use-agents-workspace-controller";
import { cn } from "@/lib/utils";

export const AgentsWorkspace: React.FC = () => {
	const { t } = useTranslation(["agents", "chat", "common"]);
	const {
		activeCompactTab,
		agentWizard,
		filteredPresets,
		selectedPreset,
		selectedPresetId,
		searchQuery,
		metadataDraft,
		isPresetListLoading,
		isCreating,
		error,
		setSearchQuery,
		updateMetadataField,
		configSummary,
		containerRef,
		draftMemoryOptions,
		formActions,
		handleCreatePreset,
		handleOpenAgentWizard,
		handlePresetSelection,
		handleResizeStart,
		handleSavePage,
		handleSelectWizardTemplate,
		isAgentWizardMode,
		isCreateDialogOpen,
		isDesktop,
		isMemoryTypeDialogOpen,
		isSavingPage,
		isWizardTemplateChooserOpen,
		memoryTopic,
		panelSizes,
		setActiveCompactTab,
		setDraftMemoryOptions,
		setIsCreateDialogOpen,
		setIsMemoryTypeDialogOpen,
	} = useAgentsWorkspaceController();

	// ── Panel sections ────────────────────────────────────────────────────────
	const listSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			{isAgentWizardMode ? (
				<AgentWizardChatPanel
					messages={agentWizard.messages}
					inputValue={agentWizard.inputValue}
					onInputChange={agentWizard.setInputValue}
					onSubmit={agentWizard.submitMessage}
					onStop={agentWizard.stop}
					onBack={agentWizard.requestClose}
					isStreaming={agentWizard.isStreaming}
					isModelReady={agentWizard.isModelReady}
				/>
			) : (
				<AgentPresetList
					presets={filteredPresets}
					selectedPresetId={selectedPresetId}
					searchQuery={searchQuery}
					isLoading={isPresetListLoading}
					isCreating={isCreating}
					scrollMode={isDesktop ? "contained" : "page"}
					onSearchChange={setSearchQuery}
					onSelectPreset={handlePresetSelection}
					onCreatePreset={() => setIsCreateDialogOpen(true)}
					onOpenAgentWizard={() => void handleOpenAgentWizard()}
				/>
			)}
		</section>
	);

	const configSection = (
		<section
			className={cn(
				"min-h-0",
				isDesktop ? "overflow-hidden bg-background" : "",
			)}
		>
			<div className={cn("flex flex-col", isDesktop ? "h-full min-h-0" : "")}>
				{isAgentWizardMode ? (
					<div
						className={cn("min-h-0", isDesktop ? "flex-1 overflow-y-auto" : "")}
					>
						{isWizardTemplateChooserOpen ? (
							<AgentWizardTemplatePanel
								templates={agentWizard.templates}
								selectedTemplateId={agentWizard.draft.templateId}
								onSelectTemplate={handleSelectWizardTemplate}
								error={agentWizard.error}
							/>
						) : selectedPreset ? (
							<AgentConfigForm
								className="p-4 sm:p-5"
								metadataDraft={metadataDraft}
								configSummary={configSummary}
								memoryTopic={memoryTopic}
								onMetadataChange={updateMetadataField}
								formActions={formActions}
							/>
						) : (
							<div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
								{t("agents:wizard.creatingDraftAgent")}
							</div>
						)}
					</div>
				) : (
					<>
						{selectedPreset ? (
							<div
								className={cn(
									isDesktop ? "flex-1 min-h-0 overflow-y-auto" : "",
								)}
							>
								{error ? (
									<div className="px-4 pt-4 max-w-3xl mx-auto">
										<div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
											{error}
										</div>
									</div>
								) : null}
								<AgentConfigForm
									className="p-4 sm:p-5"
									metadataDraft={metadataDraft}
									configSummary={configSummary}
									memoryTopic={memoryTopic}
									onMetadataChange={updateMetadataField}
									formActions={formActions}
								/>
							</div>
						) : (
							<div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
								{t("overview.emptyDescription")}
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);

	return (
		<AgentsWorkspaceLayout
			activeCompactTab={activeCompactTab}
			configSection={configSection}
			containerRef={containerRef}
			isDesktop={isDesktop}
			listSection={listSection}
			panelSizes={panelSizes}
			onCompactTabChange={setActiveCompactTab}
			onResizeStart={handleResizeStart}
		>
			<CreateFlowDialog<CreateAgentTopicOptions>
				open={isCreateDialogOpen}
				onOpenChange={setIsCreateDialogOpen}
				onCreateFlow={(name, options) => void handleCreatePreset(name, options)}
				title={t("createDialog.title")}
				description={t("createDialog.description")}
				namePlaceholder={t("createDialog.namePlaceholder")}
				submitLabel={t("actions.create")}
			>
				{({ resetToken, setExtra }) => (
					<AgentMemoryTypeFields resetToken={resetToken} setExtra={setExtra} />
				)}
			</CreateFlowDialog>

			<AgentMemoryTypeDialog
				open={isMemoryTypeDialogOpen}
				defaultValue={draftMemoryOptions}
				isBusy={isSavingPage}
				onOpenChange={setIsMemoryTypeDialogOpen}
				onSubmit={(options) => {
					setDraftMemoryOptions(options);
					setIsMemoryTypeDialogOpen(false);
					void handleSavePage(options);
				}}
			/>
		</AgentsWorkspaceLayout>
	);
};
