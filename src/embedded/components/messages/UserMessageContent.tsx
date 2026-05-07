import React, { useState } from "react";
import type { ChatMessage } from "@/embedded/types";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import { logWarn } from "@/utils/logger";
import {
	getTextContent,
	getCoAgentHoverAnchor,
	parseContextSections,
} from "./utils";
import { CoAgentHoverContextCard } from "./CoAgentHoverContextCard";

export const UserMessageContent: React.FC<{ message: ChatMessage }> = ({
	message,
}) => {
	const t = useEmbeddedTranslation("messageRenderer");
	const [expandedSections, setExpandedSections] = useState<Set<string>>(
		new Set(),
	);
	const [copiedSection, setCopiedSection] = useState<string | null>(null);

	const textContent = getTextContent(message.content);
	const parsed = parseContextSections(textContent);
	const hoverAnchor = getCoAgentHoverAnchor(message.metadata);

	const toggleSection = (label: string) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(label)) {
				next.delete(label);
			} else {
				next.add(label);
			}
			return next;
		});
	};

	const copySection = async (
		label: string,
		content: string,
		e: React.MouseEvent,
	) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(content);
			setCopiedSection(label);
			setTimeout(() => setCopiedSection(null), 2000);
		} catch (error) {
			logWarn("Failed to copy content:", error);
		}
	};

	const imageList =
		typeof message.content !== "string"
			? message.content.filter((part) => part.type === "image_url")
			: [];

	if (!parsed.hasContext) {
		return (
			<>
				<pre
					className="memorall-user-text whitespace-pre-wrap font-sans text-sm max-w-full"
					style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
				>
					{textContent}
				</pre>
				{hoverAnchor ? <CoAgentHoverContextCard anchor={hoverAnchor} /> : null}
				{imageList.length > 0 && (
					<div className="mt-3 grid grid-cols-1 gap-3">
						{imageList.map((part, idx) => (
							<div
								key={idx}
								className="rounded-lg border border-border overflow-hidden bg-card shadow-sm"
							>
								<img
									src={part.image_url.url}
									alt={t("imageAlt", { index: idx + 1 })}
									className="w-full"
								/>
							</div>
						))}
					</div>
				)}
			</>
		);
	}

	return (
		<div className="memorall-user-context space-y-3">
			{parsed.userMessage && (
				<div className="memorall-user-text memorall-user-text--with-context text-sm">
					{parsed.userMessage}
				</div>
			)}
			{hoverAnchor ? <CoAgentHoverContextCard anchor={hoverAnchor} /> : null}

			<div className="space-y-2">
				{parsed.websiteInfo && (
					<div className="memorall-user-context-card flex items-start gap-2.5 rounded-lg px-3 py-2.5 border border-border transition-colors">
						<svg
							className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
							/>
						</svg>
						<div className="flex-1 min-w-0">
							<div className="memorall-user-context-card-title text-sm truncate">
								{parsed.websiteInfo.title}
							</div>
							<div className="memorall-user-context-card-subtitle truncate text-xs mt-0.5">
								{parsed.websiteInfo.url}
							</div>
						</div>
					</div>
				)}

				{parsed.sections.map((section, idx) => {
					const isExpanded = expandedSections.has(section.label);
					const isScreenshot = section.type === "screenshot";
					const isHtml = section.type === "html";
					const isCopied = copiedSection === section.label;

					return (
						<div
							key={idx}
							className="memorall-user-context-card border border-border rounded-lg overflow-hidden"
						>
							<div className="memorall-user-context-card-header w-full px-3 py-2 flex items-center justify-between text-xs font-medium transition-colors">
								<button
									onClick={() => toggleSection(section.label)}
									className="flex-1 flex items-center justify-between text-left"
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
								>
									<span className="memorall-user-context-card-title">
										{section.label}
									</span>
									<svg
										className={`memorall-user-context-card-icon w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M19 9l-7 7-7-7"
										/>
									</svg>
								</button>
								<button
									onClick={(e) =>
										copySection(section.label, section.content, e)
									}
									className="memorall-user-context-icon-button ml-2 p-1 rounded transition-colors"
									title={isCopied ? t("copiedTitle") : t("copyContent")}
									onKeyDown={(e) => e.stopPropagation()}
									onKeyUp={(e) => e.stopPropagation()}
									onKeyPress={(e) => e.stopPropagation()}
								>
									{isCopied ? (
										<svg
											className="w-4 h-4 text-green-500"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									) : (
										<svg
											className="memorall-user-context-card-icon w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
											/>
										</svg>
									)}
								</button>
							</div>

							{isExpanded && (
								<div className="memorall-user-context-expanded px-3 py-2 border-t border-border">
									{isScreenshot ? (
										<div className="memorall-user-context-card-subtitle text-xs italic">
											{section.content}
										</div>
									) : isHtml ? (
										<pre className="memorall-user-context-pre whitespace-pre-wrap font-mono text-xs max-h-96 overflow-y-auto overflow-x-auto">
											{section.content}
										</pre>
									) : (
										<pre className="memorall-user-context-pre whitespace-pre-wrap font-sans text-xs max-h-96 overflow-y-auto">
											{section.content}
										</pre>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{imageList.length > 0 && (
				<div className="grid grid-cols-1 gap-3">
					{imageList.map((part, idx) => (
						<div
							key={idx}
							className="rounded-lg border border-border overflow-hidden bg-card shadow-sm"
						>
							<img
								src={part.image_url.url}
								alt={t("imageAlt", { index: idx + 1 })}
								className="w-full"
							/>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
