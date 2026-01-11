import type { KnowledgeGraphState, ExtractedFact } from "./state";
import { logInfo, logError, logWarn } from "@/utils/logger";
import { mapRefine } from "@/utils/map-refine";
import type { AllServices } from "@/services/flows/interfaces/tool";
import type { ILLMService } from "@/services/llm/interfaces/llm-service.interface";

const FACT_EXTRACTION_SYSTEM_PROMPT = `Extract ALL possible factual relationships between the provided ENTITIES from the given CONTENT. Your goal is to generate as many edges as possible for the knowledge graph.

CRITICAL ENTITY MATCHING RULES:
1. The "source_entity" and "destination_entity" fields MUST contain the EXACT entity names from the ENTITIES list below.
2. Do NOT modify, abbreviate, or paraphrase entity names - use them EXACTLY as they appear in the ENTITIES list.
3. If you're uncertain about an entity name, choose the closest EXACT match from the provided list.

RELATIONSHIP EXTRACTION GUIDELINES:
1. Extract facts ONLY between entities that appear in the provided ENTITIES list.
2. Generate as many relationships as possible - be comprehensive and thorough.
3. Each fact should represent a clear relationship between two DISTINCT entities.
4. Look for DIRECT relationships (explicit connections) AND INDIRECT relationships (implied by context).
5. The relation_type should be a concise, all-caps description (e.g., WORKS_FOR, CREATED_BY, LOCATED_IN, FOUNDED, ACQUIRED, COLLABORATED_WITH, MENTIONED_WITH, RELATED_TO).
6. The fact_text should contain the complete factual description including relevant context and details.
7. Include temporal context when mentioned (this will be processed separately for precise dates).

COMPREHENSIVE EXTRACTION STRATEGY:
- For web pages/documents: Extract authorship, organizational relationships, creation relationships, ownership, mentions, citations, etc.
- For conversations: Extract social relationships, professional connections, opinions expressed, co-mentions, etc.
- For any content: Look for co-occurrence relationships, hierarchical relationships, temporal relationships, causal relationships.
- Create "MENTIONED_WITH" or "RELATED_TO" relationships for entities that appear together even without explicit connection.
- Don't miss subtle relationships - if two entities appear in the same context, there's likely some relationship.

ENTITY NAME MATCHING EXAMPLES:
Correct: If entity list contains "Apple Inc.", use "Apple Inc." exactly
Wrong: Using "Apple", "Apple Corporation", or "apple inc."

Correct: If entity list contains "John Smith", use "John Smith" exactly
Wrong: Using "John", "Smith", or "john smith"

Return your response as a valid JSON array of objects with the following structure:
[
  {
    "source_entity": "Exact Entity Name From List",
    "destination_entity": "Exact Entity Name From List",
    "relation_type": "RELATION_TYPE",
    "fact_text": "Complete factual description of the relationship with context",
    "attributes": {}
  }
]

REMEMBER: Use entity names EXACTLY as they appear in the ENTITIES list, and extract as many relationships as possible!`;

const UNCONNECTED_EXTRACTION_PROMPT = `You previously extracted relationships, but some entities still have NO connections. Your task is to find ANY possible relationships for these unconnected entities.

UNCONNECTED ENTITIES (find relationships for these):
{{nodes}}

CRITICAL REQUIREMENTS:
1. Focus SPECIFICALLY on the unconnected entities listed above
2. Use EXACT entity names from the ENTITIES list below
3. Look for ANY type of relationship: explicit, implicit, contextual, or co-occurrence
4. Generate relationships between unconnected entities and ANY other entities in the list
5. Be creative but accurate - if entities appear in the same context, create "MENTIONED_WITH" or "RELATED_TO" relationships
6. Don't leave ANY entity without at least one connection if possible

RELATIONSHIP STRATEGIES:
- Direct relationships (explicit connections)
- Contextual relationships (appear in same paragraph/section)
- Hierarchical relationships (part of same category/domain)
- Temporal relationships (mentioned in same time context)
- Topical relationships (related to same subject matter)
- Co-occurrence relationships (mentioned together)

Return your response as a valid JSON array of objects with the following structure:
[
  {
    "source_entity": "Exact Entity Name From List",
    "destination_entity": "Exact Entity Name From List",
    "relation_type": "RELATION_TYPE",
    "fact_text": "Complete factual description of the relationship with context",
    "attributes": {}
  }
]

REMEMBER: Use entity names EXACTLY as they appear in the ENTITIES list, and focus on creating connections for the unconnected entities listed above!`;

interface EntityBatch {
	entities: Array<{
		uuid: string;
		finalName: string;
		summary?: string;
		nodeType: string;
	}>;
	startIndex: number;
	endIndex: number;
}

export class FactExtractionFlowV2 {
	constructor(private services: AllServices) {}

	async extractFacts(
		state: KnowledgeGraphState,
	): Promise<Partial<KnowledgeGraphState>> {
		try {
			const llm = this.services.llm;

			if (!llm.isReady()) {
				throw new Error("LLM service is not ready");
			}

			logInfo("[FACT_EXTRACTION_V2] Starting fact extraction");

			const maxModelTokens = await llm.getMaxModelTokens();
			const maxResponseTokens = await llm.getMaxResponseTokens();

			// Determine batch size based on model context window
			const entityBatchSize = this.calculateEntityBatchSize(maxModelTokens);

			logInfo(
				`[FACT_EXTRACTION_V2] Model context: ${maxModelTokens}, batch size: ${entityBatchSize}`,
			);

			// Create entity batches
			const entityBatches = this.createEntityBatches(
				state.resolvedEntities,
				entityBatchSize,
			);

			logInfo(
				`[FACT_EXTRACTION_V2] Processing ${state.resolvedEntities.length} entities in ${entityBatches.length} batches`,
			);

			// Format content
			const formattedContent = this.formatContent(state);

			// Create entity name to ID mapping
			const nameToId = this.createNameToIdMap(state.resolvedEntities);

			// Process each entity batch
			let allFacts: ExtractedFact[] = [];

			for (let batchIdx = 0; batchIdx < entityBatches.length; batchIdx++) {
				const batch = entityBatches[batchIdx];
				logInfo(
					`[FACT_EXTRACTION_V2] Processing batch ${batchIdx + 1}/${entityBatches.length} (entities ${batch.startIndex + 1}-${batch.endIndex + 1})`,
				);

				const batchFacts = await this.extractFactsForEntityBatch(
					batch,
					state.resolvedEntities,
					formattedContent,
					nameToId,
					llm,
					maxModelTokens,
					maxResponseTokens,
				);

				allFacts.push(...batchFacts);

				logInfo(
					`[FACT_EXTRACTION_V2] Batch ${batchIdx + 1} extracted ${batchFacts.length} facts (total: ${allFacts.length})`,
				);
			}

			// Find unconnected entities
			const connectedEntityIds = new Set<string>();
			allFacts.forEach((fact) => {
				connectedEntityIds.add(fact.sourceEntityId);
				connectedEntityIds.add(fact.destinationEntityId);
			});

			const unconnectedEntities = state.resolvedEntities.filter(
				(entity) => !connectedEntityIds.has(entity.uuid),
			);

			logInfo(
				`[FACT_EXTRACTION_V2] Found ${unconnectedEntities.length} unconnected entities`,
				unconnectedEntities.map((e) => e.finalName),
			);

			// Process unconnected entities
			let additionalFacts: ExtractedFact[] = [];
			if (unconnectedEntities.length > 0) {
				additionalFacts = await this.generateFactsForUnconnectedEntities(
					unconnectedEntities,
					state.resolvedEntities,
					formattedContent,
					nameToId,
					llm,
					maxModelTokens,
					maxResponseTokens,
				);

				allFacts.push(...additionalFacts);

				logInfo(
					`[FACT_EXTRACTION_V2] Generated ${additionalFacts.length} facts for unconnected entities`,
				);
			}

			const totalFacts = allFacts.length;
			logInfo(
				`[FACT_EXTRACTION_V2] Extraction complete: ${totalFacts} total facts`,
			);

			return {
				extractedFacts: allFacts,
				processingStage: "fact_resolution",
				actions: [
					{
						id: crypto.randomUUID(),
						name: "Fact Extraction Complete (V2)",
						description: `Extracted ${totalFacts} facts using entity-batching strategy`,
						metadata: {
							factCount: totalFacts,
							entityBatches: entityBatches.length,
							batchSize: entityBatchSize,
							unconnectedEntitiesFound: unconnectedEntities.length,
							additionalFacts: additionalFacts.length,
						},
					},
				],
			};
		} catch (error) {
			logError("[FACT_EXTRACTION_V2] Error:", error);

			return {
				errors: [
					error instanceof Error ? error.message : "Fact extraction failed",
				],
				actions: [
					{
						id: crypto.randomUUID(),
						name: "Fact Extraction Failed (V2)",
						description:
							error instanceof Error ? error.message : "Unknown error",
						metadata: {},
					},
				],
			};
		}
	}

	private calculateEntityBatchSize(maxModelTokens: number): number {
		// Conservative batch sizes based on context window
		if (maxModelTokens <= 4096) return 3;
		if (maxModelTokens <= 8192) return 5;
		if (maxModelTokens <= 16384) return 8;
		if (maxModelTokens <= 32768) return 12;
		return 15; // For larger models
	}

	private createEntityBatches(
		entities: Array<{
			uuid: string;
			finalName: string;
			summary?: string;
			nodeType: string;
		}>,
		batchSize: number,
	): EntityBatch[] {
		const batches: EntityBatch[] = [];

		for (let i = 0; i < entities.length; i += batchSize) {
			const endIndex = Math.min(i + batchSize, entities.length);
			batches.push({
				entities: entities.slice(i, endIndex),
				startIndex: i,
				endIndex: endIndex - 1,
			});
		}

		return batches;
	}

	private formatContent(state: KnowledgeGraphState): string {
		// Format content with proper context
		let formattedContent = `<CONTENT>\n${state.currentMessage}\n</CONTENT>`;

		// Add context if available
		if (state.previousMessages && state.previousMessages.trim().length > 0) {
			formattedContent = `<CONTEXT>\n${state.previousMessages}\n</CONTEXT>\n\n${formattedContent}`;
		}

		// Add metadata
		if (state.url || state.title) {
			const metadata = [];
			if (state.title) metadata.push(`Title: ${state.title}`);
			if (state.url) metadata.push(`Source: ${state.url}`);
			formattedContent = `<METADATA>\n${metadata.join("\n")}\n</METADATA>\n\n${formattedContent}`;
		}

		return formattedContent;
	}

	private createNameToIdMap(
		entities: Array<{
			uuid: string;
			finalName: string;
			name: string;
		}>,
	): Map<string, string> {
		const nameToId = new Map<string, string>();

		for (const entity of entities) {
			const finalNameKey = entity.finalName.toLowerCase();
			const originalNameKey = entity.name.toLowerCase();

			nameToId.set(finalNameKey, entity.uuid);

			// Add original name if different
			if (originalNameKey !== finalNameKey && !nameToId.has(originalNameKey)) {
				nameToId.set(originalNameKey, entity.uuid);
			}

			// Add trimmed variations
			const trimmedFinal = entity.finalName.trim().toLowerCase();
			const trimmedOriginal = entity.name.trim().toLowerCase();

			if (trimmedFinal !== finalNameKey && !nameToId.has(trimmedFinal)) {
				nameToId.set(trimmedFinal, entity.uuid);
			}
			if (
				trimmedOriginal !== originalNameKey &&
				!nameToId.has(trimmedOriginal)
			) {
				nameToId.set(trimmedOriginal, entity.uuid);
			}
		}

		return nameToId;
	}

	private async extractFactsForEntityBatch(
		batch: EntityBatch,
		allEntities: Array<{
			uuid: string;
			finalName: string;
			summary?: string;
			nodeType: string;
		}>,
		formattedContent: string,
		nameToId: Map<string, string>,
		llm: ILLMService,
		maxModelTokens: number,
		maxResponseTokens: number,
	): Promise<ExtractedFact[]> {
		// Format ALL entities list (for reference)
		const allEntitiesText = allEntities
			.map(
				(entity) =>
					`- ${entity.finalName}: ${entity.summary || "No description"}`,
			)
			.join("\n");

		// Format TARGET entities (focus entities for this batch)
		const targetEntitiesText = batch.entities
			.map(
				(entity) =>
					`- ${entity.finalName}: ${entity.summary || "No description"}`,
			)
			.join("\n");

		interface ParsedFact {
			source_entity?: string;
			destination_entity?: string;
			relation_type?: string;
			fact_text?: string;
			attributes?: Record<string, unknown>;
		}

		let allAccumulatedFacts: ExtractedFact[] = [];

		const parseFacts = (content: string): ExtractedFact[] => {
			let cleaned = content.trim();
			if (cleaned.startsWith("```json"))
				cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
			else if (cleaned.startsWith("```"))
				cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/i, "");

			try {
				const parsed: unknown = JSON.parse(cleaned);
				if (Array.isArray(parsed)) {
					const newFacts = parsed
						.map((f): ExtractedFact | null => {
							const pf = f as ParsedFact;
							const src = nameToId.get((pf.source_entity ?? "").toLowerCase());
							const dst = nameToId.get(
								(pf.destination_entity ?? "").toLowerCase(),
							);

							if (!src || !dst) return null;

							const relation = pf.relation_type ?? "RELATED_TO";
							const factText =
								pf.fact_text ??
								`${pf.source_entity} ${relation} ${pf.destination_entity}`;

							// Check for duplicates
							const existingFactIndex = allAccumulatedFacts.findIndex(
								(existing) =>
									existing.sourceEntityId === src &&
									existing.destinationEntityId === dst &&
									existing.relationType === relation,
							);

							if (existingFactIndex >= 0) {
								// Merge with existing
								const existing = allAccumulatedFacts[existingFactIndex];
								const mergedFactText = existing.factText.includes(factText)
									? existing.factText
									: `${existing.factText}. ${factText}`;

								allAccumulatedFacts[existingFactIndex] = {
									...existing,
									factText: mergedFactText,
									attributes: {
										...existing.attributes,
										...(pf.attributes ?? {}),
									},
								};
								return null;
							}

							return {
								uuid: crypto.randomUUID(),
								sourceEntityId: src,
								destinationEntityId: dst,
								relationType: relation,
								factText,
								attributes: pf.attributes ?? {},
							};
						})
						.filter((f): f is ExtractedFact => f !== null);

					allAccumulatedFacts.push(...newFacts);
					return [...allAccumulatedFacts];
				}
			} catch (error) {
				logWarn("[FACT_EXTRACTION_V2] JSON parse failed, trying fallback", {
					error,
					content: content.substring(0, 200),
				});
			}

			return [];
		};

		const extractedFacts = await mapRefine<ExtractedFact>(
			llm,
			FACT_EXTRACTION_SYSTEM_PROMPT,
			(chunk, prev, errorContext) => {
				const prevSummary = prev
					.map((p) => {
						const sourceEntity =
							allEntities.find((e) => e.uuid === p.sourceEntityId)?.finalName ??
							"";
						const destEntity =
							allEntities.find((e) => e.uuid === p.destinationEntityId)
								?.finalName ?? "";
						return `${sourceEntity} ${p.relationType} ${destEntity}`;
					})
					.join(", ");

				let prompt = `<PREVIOUS RESULT>\n${prevSummary}\n</PREVIOUS RESULT>\n<CHUNK>\n${chunk}\n</CHUNK>\n\n<ENTITIES>\n${allEntitiesText}\n</ENTITIES>\n\nFOCUS: Prioritize extracting relationships for these entities: ${batch.entities.map((e) => e.finalName).join(", ")}\n\nREMINDER: Use entity names EXACTLY as they appear in the ENTITIES list above. Extract as many relationships as possible between these entities.`;

				if (errorContext) {
					prompt += `\n\n<ERROR_CONTEXT>\n${errorContext}\nPlease fix the JSON format and ensure all facts are properly extracted with EXACT entity name matching from the ENTITIES list.\n</ERROR_CONTEXT>`;
				}

				return prompt;
			},
			parseFacts,
			formattedContent,
			{
				maxModelTokens,
				maxResponseTokens,
				temperature: 0.1,
				maxRetries: 2,
				overlapTokens: 64,
				dedupeBy: (f) =>
					`${f.sourceEntityId}|${f.relationType}|${f.destinationEntityId}|${f.factText.toLowerCase()}`,
				onError: (error, attempt) => {
					if (
						error.message.includes("JSON") ||
						error.message.includes("parse")
					) {
						return `JSON parsing failed: ${error.message}. Please ensure the response is a valid JSON array with source_entity, destination_entity, relation_type, and fact_text fields.`;
					}
					return `Fact extraction failed on attempt ${attempt}: ${error.message}. Please retry with correct JSON format.`;
				},
			},
		);

		return extractedFacts;
	}

	private async generateFactsForUnconnectedEntities(
		unconnectedEntities: Array<{
			uuid: string;
			finalName: string;
			summary?: string;
			nodeType: string;
		}>,
		allEntities: Array<{
			uuid: string;
			finalName: string;
			summary?: string;
			nodeType: string;
		}>,
		formattedContent: string,
		nameToId: Map<string, string>,
		llm: ILLMService,
		maxModelTokens: number,
		maxResponseTokens: number,
	): Promise<ExtractedFact[]> {
		if (unconnectedEntities.length === 0) return [];

		// Process unconnected entities in smaller batches
		const batchSize = Math.max(3, Math.min(5, unconnectedEntities.length));
		const batches = this.createEntityBatches(unconnectedEntities, batchSize);

		let allAdditionalFacts: ExtractedFact[] = [];

		for (let i = 0; i < batches.length; i++) {
			const batch = batches[i];
			logInfo(
				`[FACT_EXTRACTION_V2] Processing unconnected batch ${i + 1}/${batches.length}`,
			);

			const batchFacts = await this.extractUnconnectedBatch(
				batch,
				allEntities,
				formattedContent,
				nameToId,
				llm,
				maxModelTokens,
				maxResponseTokens,
			);

			allAdditionalFacts.push(...batchFacts);
		}

		return allAdditionalFacts;
	}

	private async extractUnconnectedBatch(
		batch: EntityBatch,
		allEntities: Array<{
			uuid: string;
			finalName: string;
			summary?: string;
			nodeType: string;
		}>,
		formattedContent: string,
		nameToId: Map<string, string>,
		llm: ILLMService,
		maxModelTokens: number,
		maxResponseTokens: number,
	): Promise<ExtractedFact[]> {
		const allEntitiesText = allEntities
			.map(
				(entity) =>
					`- ${entity.finalName}: ${entity.summary || "No description"}`,
			)
			.join("\n");

		const targetEntitiesText = batch.entities
			.map(
				(entity) =>
					`- ${entity.finalName}: ${entity.summary || "No description"}`,
			)
			.join("\n");

		const targetEntityIds = new Set(batch.entities.map((e) => e.uuid));

		interface ParsedFact {
			source_entity?: string;
			destination_entity?: string;
			relation_type?: string;
			fact_text?: string;
			attributes?: Record<string, unknown>;
		}

		const parseFacts = (content: string): ExtractedFact[] => {
			let cleaned = content.trim();
			if (cleaned.startsWith("```json"))
				cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
			else if (cleaned.startsWith("```"))
				cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/i, "");

			try {
				const parsed: unknown = JSON.parse(cleaned);
				if (Array.isArray(parsed)) {
					return parsed
						.map((f): ExtractedFact | null => {
							const pf = f as ParsedFact;
							const src = nameToId.get((pf.source_entity ?? "").toLowerCase());
							const dst = nameToId.get(
								(pf.destination_entity ?? "").toLowerCase(),
							);

							if (!src || !dst) return null;

							// Must involve at least one target entity
							if (!targetEntityIds.has(src) && !targetEntityIds.has(dst)) {
								return null;
							}

							return {
								uuid: crypto.randomUUID(),
								sourceEntityId: src,
								destinationEntityId: dst,
								relationType: pf.relation_type ?? "RELATED_TO",
								factText:
									pf.fact_text ??
									`${pf.source_entity} ${pf.relation_type} ${pf.destination_entity}`,
								attributes: pf.attributes ?? {},
							};
						})
						.filter((f): f is ExtractedFact => f !== null);
				}
			} catch (error) {
				logWarn(
					"[FACT_EXTRACTION_V2] Unconnected parse failed",
					error instanceof Error ? error.message : String(error),
				);
			}

			return [];
		};

		const adaptiveResponseTokens = Math.min(
			maxResponseTokens,
			Math.floor(maxModelTokens * 0.2),
		);

		const unconnectedNames = batch.entities.map((e) => e.finalName).join(", ");

		try {
			const facts = await mapRefine<ExtractedFact>(
				llm,
				UNCONNECTED_EXTRACTION_PROMPT.replace("{{nodes}}", targetEntitiesText),
				(chunk, prev, errorContext) => {
					let prompt = `Focus on finding relationships for these unconnected entities: ${unconnectedNames}\n\n<CONTENT>\n${chunk}\n</CONTENT>\n\n<ENTITIES>\n${allEntitiesText}\n</ENTITIES>\n\nREMINDER: Create connections specifically for the unconnected entities listed above using EXACT entity names.`;

					if (errorContext) {
						prompt += `\n\n<ERROR_CONTEXT>\n${errorContext}\nPlease fix the JSON format and focus on the unconnected entities.\n</ERROR_CONTEXT>`;
					}

					return prompt;
				},
				parseFacts,
				formattedContent,
				{
					maxModelTokens: Math.floor(maxModelTokens * 0.8),
					maxResponseTokens,
					temperature: 0.2, // Slightly higher creativity for finding implicit relationships
					maxRetries: 2,
					dedupeBy: (f) =>
						`${f.sourceEntityId}|${f.relationType}|${f.destinationEntityId}`,
					onError: (error, attempt) => {
						logError(
							`[UNCONNECTED_EXTRACTION] Parse error on attempt ${attempt}:`,
							error,
						);
						return `Extraction failed: ${error.message}. Please ensure valid JSON format and focus on unconnected entities.`;
					},
				},
			);

			return facts;
		} catch (error) {
			logError(
				"[FACT_EXTRACTION_V2] Error in unconnected batch extraction:",
				error,
			);
			return [];
		}
	}
}
