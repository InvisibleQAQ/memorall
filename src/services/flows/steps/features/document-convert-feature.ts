import { logError } from "@/utils/logger";
import { defineStep, bindStep } from "@/services/flows/interfaces/step";
import type {
	StepFactoryFromSpec,
	StepSpecFromDefinition,
} from "@/services/flows/interfaces/step";
import { stepRegistry } from "@/services/flows/step-registry";
import {
	featureCatalogRegistry,
	FEATURE_DEFAULT_INPUTS,
	type FeatureCatalogMetadata,
} from "@/services/flows/feature-catalog-registry";
import { GraphBase, type GraphTool } from "@/services/flows/graph/graph.base";
import type { ChatCompletionMessageParam } from "@/types/openai";

const STEP_NAME = "document-convert-feature" as const;
export const DOCUMENT_CONVERT_FEATURE_NAME = STEP_NAME;

// ============================================================================
// STEP-SPECIFIC TYPES
// ============================================================================

export interface DocumentConvertFeatureInput {
	messages: ChatCompletionMessageParam[];
	tools: GraphTool[];
}

export interface DocumentConvertFeatureOutput {
	tools?: GraphTool[];
	messages?: ChatCompletionMessageParam[];
}

export interface DocumentConvertFeatureConfig {}

export type DocumentConvertFeatureServices = {};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT_INSTRUCTION = `
# DOCUMENT CONVERSION TOOLS
You have access to tools for extracting text from PDF and Excel files stored in /documents.

## TOOLS OVERVIEW

| Tool | Purpose |
|---|---|
| \`pdf_to_text\` | Extract text from a PDF in /documents |
| \`excel_to_text\` | Extract text or tables from an Excel file in /documents |

## pdf_to_text

Extracts text from a PDF at \`source_path\` (must end with \`.pdf\`).
- \`output_path\`: optional — save extracted text to this path in /documents. If omitted, text is returned directly.
- \`format\`: \`"text"\` (default, with page separators) | \`"markdown"\` (with frontmatter and page headings)
- \`page_range\`: optional \`{ start, end }\` (1-based) to extract a specific page range only.
- Parent folders are created automatically when \`output_path\` is set.

## excel_to_text

Extracts text from an Excel file at \`source_path\` (must end with \`.xls\`, \`.xlsx\`, or \`.xlsm\`).
- \`output_path\`: optional — save extracted text to this path in /documents. If omitted, text is returned directly.
- \`format\`: \`"markdown"\` (default, each sheet as a Markdown table) | \`"csv"\` (each sheet as CSV rows)
- \`sheets\`: optional array of sheet names to include. Defaults to all sheets.
- Parent folders are created automatically when \`output_path\` is set.

## IMPORTANT RULES
- After saving extracted text, only mention the output path — do not include the full text in your response.
- Prefer saving to a file for long documents to keep responses concise.
`;

export const DOCUMENT_CONVERT_FEATURE_SYSTEM_PROMPT =
	SYSTEM_PROMPT_INSTRUCTION.trim();

export const DOCUMENT_CONVERT_FEATURE_TOOLS = [
	"pdf_to_text",
	"excel_to_text",
] as const;

export const DOCUMENT_CONVERT_FEATURE_DESCRIPTION =
	"Enable document conversion tools: extract text from PDFs (plain text or Markdown) and extract text or tables from Excel files.";

// ============================================================================
// STEP IMPLEMENTATION
// ============================================================================

const definition = defineStep<
	DocumentConvertFeatureInput,
	DocumentConvertFeatureOutput,
	DocumentConvertFeatureServices,
	DocumentConvertFeatureConfig
>({
	name: STEP_NAME,
	execute: async ({ input }) => {
		try {
			const tools = GraphBase.chat.addTool(
				input.tools,
				...DOCUMENT_CONVERT_FEATURE_TOOLS,
			);
			const messages = GraphBase.chat.systemMessage(
				input.messages,
				DOCUMENT_CONVERT_FEATURE_SYSTEM_PROMPT,
			);

			return {
				output: {
					tools,
					messages,
				},
			};
		} catch (error) {
			logError("[DOCUMENT_CONVERT_FEATURE] Failed:", error);

			return {
				output: {
					tools: input.tools,
					messages: input.messages,
					errors: [
						error instanceof Error
							? error.message
							: "Document convert feature step failed",
					],
				},
			};
		}
	},
});

type DocumentConvertFeatureSpec = StepSpecFromDefinition<typeof definition>;

export const createDocumentConvertFeatureStep: StepFactoryFromSpec<
	DocumentConvertFeatureSpec
> = (
	services: DocumentConvertFeatureServices,
	config?: DocumentConvertFeatureConfig,
) => bindStep(definition, services, config);

stepRegistry.register(STEP_NAME, createDocumentConvertFeatureStep, {
	description: DOCUMENT_CONVERT_FEATURE_DESCRIPTION,
	defaultStateMapping: { messages: "messages", tools: "tools" },
	enabledByDefault: false,
});

featureCatalogRegistry.register({
	id: "step-document-convert-feature",
	name: DOCUMENT_CONVERT_FEATURE_NAME,
	type: "feature",
	graphTypes: ["foundation"],
	inputs: FEATURE_DEFAULT_INPUTS,
	outputs: [
		{
			name: "messages",
			type: "Message[]",
			description: "Messages with document conversion instructions",
		},
		{
			name: "tools",
			type: "Tool[]",
			description: "Tools extended with pdf_to_text and excel_to_text",
		},
	],
	metadata: {
		description: DOCUMENT_CONVERT_FEATURE_DESCRIPTION,
		descriptionKey: "flowBuilder.features.documentConvertFeature.description",
		displayName: "Document Convert",
		nameKey: "flowBuilder.features.documentConvertFeature.name",
		tools: [...DOCUMENT_CONVERT_FEATURE_TOOLS],
		systemPrompt: DOCUMENT_CONVERT_FEATURE_SYSTEM_PROMPT,
		customizable: false,
		recommended: false,
		icon: { name: "FileOutput", type: "lucide" },
	} satisfies FeatureCatalogMetadata,
});

declare global {
	interface StepTypeRegistry {
		[STEP_NAME]: DocumentConvertFeatureSpec;
	}
}
