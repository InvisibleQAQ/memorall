import { desc, eq, like, and, or } from "drizzle-orm";
import { logError, logInfo } from "@/utils/logger";
import { logger } from "@/utils/logger";
import { serviceManager } from "@/services";
import type { RememberedContent, Source } from "@/services/database/db";
import type {
	PageMetadata,
	ReadabilityArticle,
	RememberThisResponse,
	SelectionMetadata,
	UserInputMetadata,
} from "@/types/remember-this";
import type { KnowledgeGraphState } from "@/services/flows/graph/knowledge/state";

export interface SavePageData {
	html: string;
	url: string;
	title: string;
	metadata: PageMetadata;
	article: ReadabilityArticle;
	topicId?: string;
}

export interface SaveContentData {
	sourceType:
		| "webpage"
		| "selection"
		| "user_input"
		| "user"
		| "raw_text"
		| "file_upload";
	sourceUrl?: string;
	originalUrl?: string;
	title: string;
	rawContent: string;
	cleanContent: string;
	textContent: string;
	sourceMetadata: PageMetadata | SelectionMetadata | UserInputMetadata;
	extractionMetadata: ReadabilityArticle | Record<string, unknown>;
	topicId?: string;
}

export interface SearchOptions {
	query?: string;
	tags?: string[];
	isArchived?: boolean;
	isFavorite?: boolean;
	limit?: number;
	offset?: number;
	sortBy?: "createdAt" | "updatedAt" | "title" | "contentLength";
	sortOrder?: "asc" | "desc";
}

export interface SearchResult {
	pages: RememberedContent[];
	total: number;
	hasMore: boolean;
}

export class RememberService {
	private static instance: RememberService;
	private initialized = false;

	private constructor() {}

	static getInstance(): RememberService {
		if (!RememberService.instance) {
			RememberService.instance = new RememberService();
		}
		return RememberService.instance;
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			this.initialized = true;
			logInfo("✅ RememberService initialized successfully");
		} catch (error) {
			logError("❌ RememberService initialization failed:", error);
			throw error;
		}
	}

	/**
	 * Save a remembered page to the database with knowledge graph processing
	 */
	async savePage(data: SavePageData): Promise<RememberThisResponse> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			logInfo("🔄 Saving page to database:", data.url);

			// Only save the page content - knowledge graph processing is separate
			const response = await this.savePageBasic(data);

			logInfo("✅ Page saved successfully:", data.url);

			return response;
		} catch (error) {
			logError("❌ Failed to save page:", error);
			return {
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to save page to database",
			};
		}
	}

	/**
	 * Save content directly (for selections, user input, etc.)
	 */
	async saveContentDirect(
		data: SaveContentData,
	): Promise<RememberThisResponse> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			logInfo(
				"🔄 Saving content directly with topicId:",
				data.topicId,
				"sourceType:",
				data.sourceType,
			);

			// Prepare data for insertion using new schema
			const newContent = {
				sourceType: data.sourceType,
				sourceUrl: data.sourceUrl,
				originalUrl: data.originalUrl,
				title: data.title,
				content: data.textContent,
				sourceMetadata: data.sourceMetadata as unknown,
				extractionMetadata: data.extractionMetadata as unknown,
				tags: [],
				isArchived: false,
				isFavorite: false,
				topicId: data.topicId,
			};

			// Save content to database - ONLY save content, nothing else
			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const [savedContent] = await db
						.insert(schema.rememberedContent)
						.values(newContent)
						.returning();

					logInfo("✅ Content saved successfully:", savedContent.id);

					return savedContent;
				},
			);

			return {
				success: true,
				pageId: result.id,
			};
		} catch (error) {
			logError("❌ Failed to save content directly:", error);
			return {
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to save content",
			};
		}
	}

	/**
	 * Transform legacy SavePageData to new SaveContentData format
	 */
	private transformLegacyData(data: SavePageData): SaveContentData {
		return {
			sourceType: "webpage",
			sourceUrl: data.url,
			originalUrl: undefined,
			title: data.title,
			rawContent: data.html,
			cleanContent: data.article.content,
			textContent: data.article.textContent,
			sourceMetadata: data.metadata,
			extractionMetadata: data.article,
			topicId: data.topicId,
		};
	}

	/**
	 * Save a remembered page to the database (basic functionality without knowledge graph)
	 */
	async savePageBasic(data: SavePageData): Promise<RememberThisResponse> {
		try {
			logInfo("🔍 savePageBasic received topicId:", data.topicId);
			// Transform legacy data to new format and delegate to saveContentDirect
			const contentData = this.transformLegacyData(data);
			logInfo("🔍 savePageBasic after transform topicId:", contentData.topicId);
			return await this.saveContentDirect(contentData);
		} catch (error) {
			logError("❌ Failed to save remembered page:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to save page",
			};
		}
	}

	/**
	 * Update an existing remembered page
	 */
	async updatePage(
		pageId: string,
		data: SavePageData,
	): Promise<RememberThisResponse> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			// Transform legacy data to new format
			const contentData = this.transformLegacyData(data);

			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const [updatedPage] = await db
						.update(schema.rememberedContent)
						.set({
							sourceType: contentData.sourceType,
							sourceUrl: contentData.sourceUrl,
							originalUrl: contentData.originalUrl,
							title: contentData.title,
							content: contentData.textContent,
							sourceMetadata: contentData.sourceMetadata as unknown,
							extractionMetadata: contentData.extractionMetadata as unknown,
							updatedAt: new Date(),
						})
						.where(eq(schema.rememberedContent.id, pageId))
						.returning();
					return updatedPage;
				},
			);

			logInfo("✅ Page updated successfully:", pageId);

			return {
				success: true,
				pageId,
			};
		} catch (error) {
			logError("❌ Failed to update remembered page:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Failed to update page",
			};
		}
	}

	/**
	 * Find a page by URL
	 */
	async findByUrl(url: string): Promise<RememberedContent | null> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const pages = await db
						.select()
						.from(schema.rememberedContent)
						.where(eq(schema.rememberedContent.sourceUrl, url))
						.limit(1);
					return pages[0] || null;
				},
			);

			return result;
		} catch (error) {
			logError("❌ Failed to find page by URL:", error);
			return null;
		}
	}

	/**
	 * Search remembered pages
	 */
	async searchPages(options: SearchOptions = {}): Promise<SearchResult> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const {
				query = "",
				tags = [],
				isArchived,
				isFavorite,
				limit = 20,
				offset = 0,
				sortBy = "createdAt",
				sortOrder = "desc",
			} = options;

			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					// Build where conditions
					const conditions = [];

					if (query.trim()) {
						conditions.push(
							or(
								like(schema.rememberedContent.title, `%${query}%`),
								like(schema.rememberedContent.content, `%${query}%`),
							),
						);
					}

					if (tags.length > 0) {
						// PostgreSQL JSONB array contains check
						conditions.push(
							// This would need proper JSONB query syntax in production
							like(schema.rememberedContent.tags, `%${tags[0]}%`),
						);
					}

					if (isArchived !== undefined) {
						conditions.push(
							eq(schema.rememberedContent.isArchived, isArchived),
						);
					}

					if (isFavorite !== undefined) {
						conditions.push(
							eq(schema.rememberedContent.isFavorite, isFavorite),
						);
					}

					const whereClause =
						conditions.length > 0 ? and(...conditions) : undefined;

					// Build order by
					const column =
						schema.rememberedContent[sortBy as keyof RememberedContent];
					const orderBy = sortOrder === "desc" ? desc(column) : column;

					// Get total count
					const totalQuery = db
						.select({ count: schema.rememberedContent.id })
						.from(schema.rememberedContent);
					if (whereClause) {
						totalQuery.where(whereClause);
					}

					// Get pages
					const pagesQuery = db.select().from(schema.rememberedContent);

					if (whereClause) {
						pagesQuery.where(whereClause);
					}
					pagesQuery.orderBy(orderBy).limit(limit).offset(offset);

					const [totalResult, pages] = await Promise.all([
						totalQuery,
						pagesQuery,
					]);

					const total = totalResult.length;
					const hasMore = offset + limit < total;

					return { pages, total, hasMore };
				},
			);

			return result;
		} catch (error) {
			logError("❌ Failed to search pages:", error);
			return { pages: [], total: 0, hasMore: false };
		}
	}

	async getTopicForContent(topicId: string) {
		try {
			if (!topicId) return null;

			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const topics = await db
						.select()
						.from(schema.topics)
						.where(eq(schema.topics.id, topicId))
						.limit(1);

					return topics[0] || null;
				},
			);

			return result;
		} catch (error) {
			logError("❌ Failed to get topic:", error);
			return null;
		}
	}

	/**
	 * Get a page by ID
	 */
	async getPageById(id: string): Promise<RememberedContent | null> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const result = await serviceManager.databaseService.use(
				async ({ db, schema }) => {
					const pages = await db
						.select()
						.from(schema.rememberedContent)
						.where(eq(schema.rememberedContent.id, id))
						.limit(1);
					return pages[0] || null;
				},
			);

			return result;
		} catch (error) {
			logError("❌ Failed to get page by ID:", error);
			return null;
		}
	}

	/**
	 * Delete a page
	 */
	async deletePage(id: string): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.delete(schema.rememberedContent)
					.where(eq(schema.rememberedContent.id, id));
			});

			logInfo("✅ Page deleted successfully:", id);
			return true;
		} catch (error) {
			logError("❌ Failed to delete page:", error);
			return false;
		}
	}

	/**
	 * Toggle favorite status
	 */
	async toggleFavorite(id: string): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const page = await this.getPageById(id);
			if (!page) return false;

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.update(schema.rememberedContent)
					.set({
						isFavorite: !page.isFavorite,
						updatedAt: new Date(),
					})
					.where(eq(schema.rememberedContent.id, id));
			});

			return true;
		} catch (error) {
			logError("❌ Failed to toggle favorite:", error);
			return false;
		}
	}

	/**
	 * Toggle archive status
	 */
	async toggleArchive(id: string): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const page = await this.getPageById(id);
			if (!page) return false;

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.update(schema.rememberedContent)
					.set({
						isArchived: !page.isArchived,
						updatedAt: new Date(),
					})
					.where(eq(schema.rememberedContent.id, id));
			});

			return true;
		} catch (error) {
			logError("❌ Failed to toggle archive:", error);
			return false;
		}
	}

	/**
	 * Add tags to a page
	 */
	async addTags(id: string, newTags: string[]): Promise<boolean> {
		try {
			if (!this.initialized) {
				await this.initialize();
			}

			const page = await this.getPageById(id);
			if (!page) return false;

			const currentTags = Array.isArray(page.tags) ? page.tags : [];
			const updatedTags = [...new Set([...currentTags, ...newTags])];

			await serviceManager.databaseService.use(async ({ db, schema }) => {
				await db
					.update(schema.rememberedContent)
					.set({
						tags: updatedTags,
						updatedAt: new Date(),
					})
					.where(eq(schema.rememberedContent.id, id));
			});

			return true;
		} catch (error) {
			logError("❌ Failed to add tags:", error);
			return false;
		}
	}
}

// Export singleton instance
export const rememberService = RememberService.getInstance();
