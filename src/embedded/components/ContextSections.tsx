import React, { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { nanoid } from "nanoid";
import type { ChatMessage } from "../types";
import { Loader } from "./Icons";
import { captureScreenshotWithFallback } from "../utils/screenshot-helpers";

// Translation map for context sections
export const CONTEXT_SECTIONS_TEXTS = {
	en: {
		selectContext: "Select context:",
		clearAll: "Clear all",
		hideContextSection: "Hide context section",
		showContextSection: "Show context section",
		sendWithContext: "Send with context",
	},
	vn: {
		selectContext: "Chọn ngữ cảnh:",
		clearAll: "Xóa tất cả",
		hideContextSection: "Ẩn phần ngữ cảnh",
		showContextSection: "Hiển thị phần ngữ cảnh",
		sendWithContext: "Gửi với ngữ cảnh",
	},
};

export const ShadcnEmbeddedContextSections: React.FC<{
	pageUrl: string;
	pageTitle: string;
	contextOptions?: Array<{ type: string; label: string; content: string }>;
	setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
	selectedContexts: Array<{ type: string; label: string; content: string }>;
	setSelectedContexts: React.Dispatch<
		React.SetStateAction<
			Array<{ type: string; label: string; content: string }>
		>
	>;
	showContextSection: boolean;
	onToggleContextSection: () => void;
	texts?: typeof CONTEXT_SECTIONS_TEXTS.en;
}> = ({
	pageUrl,
	pageTitle,
	contextOptions,
	setMessages,
	selectedContexts,
	setSelectedContexts,
	showContextSection,
	onToggleContextSection,
	texts = CONTEXT_SECTIONS_TEXTS.en,
}) => {
	const [availableContexts, setAvailableContexts] = useState<
		Array<{ type: string; label: string; content: string }>
	>(contextOptions || []);

	// Track screenshot capture status
	const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

	// Auto-select selected_image context when present
	React.useEffect(() => {
		if (contextOptions) {
			const selectedImage = contextOptions.find(
				(ctx) => ctx.type === "selected_image",
			);
			if (selectedImage && selectedContexts.length === 0) {
				setSelectedContexts([selectedImage]);
			}
		}
	}, [contextOptions]);

	// Reset availableContexts when selectedContexts is cleared (e.g., delete chat or after sending)
	React.useEffect(() => {
		if (selectedContexts.length === 0 && contextOptions) {
			setAvailableContexts(contextOptions);
		}
	}, [selectedContexts, contextOptions]);

	// Handle context selection click - toggle selection
	const handleContextSelection = useCallback(
		async (contextItem: { type: string; label: string; content: string }) => {
			const isAlreadySelected = selectedContexts.some(
				(s) => s.type === contextItem.type,
			);

			if (isAlreadySelected) {
				// Remove from selected
				setSelectedContexts((prev) =>
					prev.filter((item) => item.type !== contextItem.type),
				);
			} else {
				// If screenshot (viewport or full page) and not yet captured, capture it first
				if (
					(contextItem.type === "screenshot" ||
						contextItem.type === "viewport_screenshot") &&
					!contextItem.content
				) {
					// Force synchronous update to show loading immediately
					flushSync(() => {
						setIsCapturingScreenshot(true);
					});
					try {
						if (contextItem.type === "viewport_screenshot") {
							console.log("Capturing viewport screenshot...");
							// Capture only visible viewport - use current scroll position
							const canvas = await captureScreenshotWithFallback(
								document.documentElement,
								{
									x: window.scrollX,
									y: window.scrollY,
									width: window.innerWidth,
									height: window.innerHeight,
									scrollX: 0,
									scrollY: 0,
								},
							);
							const base64Image = canvas.toDataURL("image/png");

							// Update the context item with captured screenshot
							const updatedContextItem = {
								...contextItem,
								content: base64Image,
							};

							// Update availableContexts with the captured screenshot
							setAvailableContexts((prev) =>
								prev.map((ctx) =>
									ctx.type === contextItem.type ? updatedContextItem : ctx,
								),
							);

							// Add to selected with the captured screenshot
							setSelectedContexts((prev) => [...prev, updatedContextItem]);
						} else {
							console.log("Capturing full page screenshot...");
							// Capture full page in chunks of 1500px height
							const fullHeight = document.documentElement.scrollHeight;
							const fullWidth = document.documentElement.scrollWidth;
							const chunkHeight = 1500;
							const screenshots: string[] = [];

							// Calculate number of chunks needed
							const numChunks = Math.ceil(fullHeight / chunkHeight);

							for (let i = 0; i < numChunks; i++) {
								const yOffset = i * chunkHeight;
								const captureHeight = Math.min(
									chunkHeight,
									fullHeight - yOffset,
								);

								const canvas = await captureScreenshotWithFallback(
									document.documentElement,
									{
										x: 0,
										y: yOffset,
										width: fullWidth,
										height: captureHeight,
										scrollX: 0,
										scrollY: 0,
									},
								);

								const base64Image = canvas.toDataURL("image/png");
								screenshots.push(base64Image);
							}

							// Join all screenshots with a delimiter
							const combinedContent = screenshots.join("|||CHUNK|||");

							// Update the context item with captured screenshots
							const updatedContextItem = {
								...contextItem,
								content: combinedContent,
							};

							// Update availableContexts with the captured screenshot
							setAvailableContexts((prev) =>
								prev.map((ctx) =>
									ctx.type === contextItem.type ? updatedContextItem : ctx,
								),
							);

							// Add to selected with the captured screenshots
							setSelectedContexts((prev) => [...prev, updatedContextItem]);
						}
					} catch (e) {
						console.error("Failed to capture screenshot:", e);
					} finally {
						setIsCapturingScreenshot(false);
					}
				} else {
					// Add to selected
					setSelectedContexts((prev) => [...prev, contextItem]);
				}
			}
		},
		[selectedContexts],
	);

	// Build combined context message from all selected contexts
	const buildContextMessage = useCallback(
		(contexts: Array<{ type: string; label: string; content: string }>) => {
			if (contexts.length === 0) return [];

			// Separate text contexts and screenshots
			let contextParts: string[] = [];
			const contentArray: Array<
				| { type: "text"; text: string }
				| {
						type: "image_url";
						image_url: { url: string; detail?: "low" | "high" | "auto" };
				  }
			> = [];

			contexts.forEach((ctx) => {
				switch (ctx.type) {
					case "selection":
						contextParts.push(`<selected_text>
${ctx.content}
</selected_text>`);
						break;
					case "viewport":
						contextParts.push(`<viewport_content>
${ctx.content}
</viewport_content>`);
						break;
					case "viewport_html":
						contextParts.push(`<viewport_html_structure>
${ctx.content}
</viewport_html_structure>`);
						break;
					case "full_page":
						contextParts.push(`<full_page_content>
${ctx.content}
</full_page_content>`);
						break;
					case "full_page_html":
						contextParts.push(`<full_page_html_structure>
${ctx.content}
</full_page_html_structure>`);
						break;
					case "viewport_screenshot":
						contentArray.push({
							type: "image_url",
							image_url: { url: ctx.content, detail: "high" },
						});
						contextParts.push(`<viewport_screenshot>
Screenshot of the visible portion of the page is attached as an image.
</viewport_screenshot>`);
						break;
					case "screenshot":
						// Full page screenshot may be chunked
						const chunks = ctx.content.split("|||CHUNK|||");
						chunks.forEach((chunk) => {
							contentArray.push({
								type: "image_url",
								image_url: { url: chunk, detail: "high" },
							});
						});
						contextParts.push(`<screenshot>
Screenshot of the full page is attached as ${chunks.length} image${chunks.length > 1 ? "s" : ""} (split into chunks for readability).
</screenshot>`);
						break;
					case "selected_image":
						contentArray.push({
							type: "image_url",
							image_url: { url: ctx.content, detail: "high" },
						});
						contextParts.push(`<selected_image>
A selected region from the page is attached as an image.
</selected_image>`);
						break;
					default:
						contextParts.push(`<content type="${ctx.type}">
${ctx.content}
</content>`);
				}
			});

			const text = `<context>
<website>
  <title>${pageTitle}</title>
  <url>${pageUrl}</url>
</website>
${contextParts.join("\n")}
</context>`;

			// Add text content first
			contentArray.unshift({ type: "text", text });

			return contentArray;
		},
		[pageTitle, pageUrl],
	);

	// Add all selected contexts as a single user message
	const handleAddContextsAsMessage = useCallback(() => {
		if (selectedContexts.length === 0) return;

		const content = buildContextMessage(selectedContexts);

		const userMessage: ChatMessage = {
			id: nanoid(),
			role: "user",
			content,
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);

		// Clear all contexts after sending
		setSelectedContexts([]);
		setAvailableContexts([]);
	}, [selectedContexts, buildContextMessage]);

	return (
		<>
			{(availableContexts.length > 0 || selectedContexts.length > 0) && (
				<div className="border-t px-4 py-3 flex-shrink-0 bg-muted/30 space-y-2.5">
					{/* Header */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<button
								onClick={onToggleContextSection}
								className="flex items-center justify-center p-1 text-muted-foreground hover:text-foreground transition-colors"
								title={
									showContextSection
										? texts.hideContextSection
										: texts.showContextSection
								}
								onKeyDown={(e) => e.stopPropagation()}
								onKeyUp={(e) => e.stopPropagation()}
								onKeyPress={(e) => e.stopPropagation()}
							>
								<svg
									className="w-3.5 h-3.5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d={showContextSection ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"}
									/>
								</svg>
							</button>
							<div className="text-xs font-medium text-muted-foreground">
								{texts.selectContext}
							</div>
						</div>
						{selectedContexts.length > 0 && (
							<button
								onClick={() => {
									setSelectedContexts([]);
									setAvailableContexts(contextOptions || []);
								}}
								className="text-xs text-muted-foreground hover:text-foreground transition-colors"
								onKeyDown={(e) => e.stopPropagation()}
								onKeyUp={(e) => e.stopPropagation()}
								onKeyPress={(e) => e.stopPropagation()}
							>
								{texts.clearAll}
							</button>
						)}
					</div>

					{/* Available contexts - compact badges */}
					{availableContexts.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{availableContexts.map((ctx) => {
								const isSelected = selectedContexts.some(
									(s) => s.type === ctx.type,
								);
								const isImage =
									ctx.type === "screenshot" ||
									ctx.type === "viewport_screenshot";
								const isCapturingThis = isCapturingScreenshot && isImage;
								return (
									<button
										key={ctx.type}
										onClick={() => handleContextSelection(ctx)}
										disabled={isCapturingThis}
										className={`inline-flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
											isSelected
												? "bg-primary text-primary-foreground"
												: "bg-muted hover:bg-accent text-foreground border border-border"
										} ${isCapturingThis ? "opacity-50 cursor-wait" : ""}`}
										onKeyDown={(e) => e.stopPropagation()}
										onKeyUp={(e) => e.stopPropagation()}
										onKeyPress={(e) => e.stopPropagation()}
									>
										<span className="font-medium">{ctx.label}</span>
										{isCapturingThis ? (
											<Loader size={14} />
										) : isImage ? (
											<svg
												className="w-3.5 h-3.5 opacity-70"
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
												/>
											</svg>
										) : (
											<span className="opacity-70 text-[10px]">
												{ctx.content.length.toLocaleString()} chars
											</span>
										)}
									</button>
								);
							})}
						</div>
					)}

					{/* Send button - only show when contexts selected */}
					{selectedContexts.length > 0 && (
						<button
							onClick={handleAddContextsAsMessage}
							className="w-full px-4 py-2.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
							onKeyDown={(e) => e.stopPropagation()}
							onKeyUp={(e) => e.stopPropagation()}
							onKeyPress={(e) => e.stopPropagation()}
						>
							<svg
								className="w-4 h-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
								/>
							</svg>
							Send {selectedContexts.length} context
							{selectedContexts.length > 1 ? "s" : ""}
						</button>
					)}
				</div>
			)}
		</>
	);
};
