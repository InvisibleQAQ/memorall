import React from "react";

export interface EmbeddedMarkdownProps {
	content: string;
	isStreaming?: boolean;
}

// Helper function to parse tool calls from content
interface ToolCall {
	name: string;
	id: string;
	args: string;
}

const parseToolCalls = (
	text: string,
): { toolCalls: ToolCall[]; cleanText: string } => {
	const toolCalls: ToolCall[] = [];
	const toolCallRegex =
		/<jtr_tool_call><jtr_tool_name>(.*?)<\/jtr_tool_name><jtr_tool_call_id>(.*?)<\/jtr_tool_call_id><jtr_tool_call_args>(.*?)<\/jtr_tool_call_args><\/jtr_tool_call>/g;

	let match;
	while ((match = toolCallRegex.exec(text)) !== null) {
		toolCalls.push({
			name: match[1],
			id: match[2],
			args: match[3],
		});
	}

	// Remove tool calls from text
	const cleanText = text.replace(toolCallRegex, "").trim();

	return { toolCalls, cleanText };
};

// Render tool call as HTML
const renderToolCall = (toolCall: ToolCall): string => {
	// Decode URL-encoded args
	const decodedArgs = decodeURIComponent(toolCall.args);
	let parsedArgs: Record<string, unknown> = {};
	try {
		const parsed: unknown = JSON.parse(decodedArgs);
		parsedArgs =
			typeof parsed === "object" && parsed !== null
				? (parsed as Record<string, unknown>)
				: { raw: decodedArgs };
	} catch (e) {
		parsedArgs = { raw: decodedArgs };
	}

	const argsJson = JSON.stringify(parsedArgs, null, 2);

	return `
		<div style="margin-bottom: 1rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; overflow: hidden;">
			<div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem; background-color: hsl(var(--muted)/0.5);">
				<div style="display: flex; align-items: center; gap: 0.5rem;">
					<svg style="width: 1rem; height: 1rem; color: hsl(var(--muted-foreground));" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z" />
					</svg>
					<span style="font-weight: 500; font-size: 0.875rem;">${toolCall.name}</span>
					<span style="display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; background-color: hsl(var(--muted)); border: 1px solid hsl(var(--border));">
						<svg style="width: 1rem; height: 1rem; color: rgb(22, 163, 74);" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<circle cx="12" cy="12" r="10" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" />
						</svg>
						Completed
					</span>
				</div>
			</div>
			<div style="padding: 1rem;">
				<h4 style="font-weight: 500; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: hsl(var(--muted-foreground)); margin-bottom: 0.5rem;">Parameters</h4>
				<div style="background-color: hsl(var(--muted)/0.5); border-radius: 0.375rem; padding: 0.75rem; overflow-x: auto;">
					<pre style="margin: 0; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Fira Mono', 'Droid Sans Mono', 'Consolas', monospace; font-size: 0.75rem; line-height: 1.5;">${argsJson}</pre>
				</div>
			</div>
		</div>
	`;
};

// Helper function to process citation formats:
// 1. [name](/jitera/entities?id=[id])
// 2. [name](/jitera/attrs?id=[id])
// 3. [name](citation:/entities?id=[id])
// 4. [name](citation:/attrs?id=[id])
// 5. [name](citation:/entities/[id])
// 6. [name](citation:/attrs/[id])
// 7. [citation:/entities/id] (no name)
// 8. [citation:/attrs/id] (no name)
const processCitations = (text: string): string => {
	// Helper to create citation badge HTML
	const createCitationBadge = (
		name: string,
		type: "entities" | "attrs",
		id: string,
	): string => {
		const escapedDisplayName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		return `<span style="display: inline-flex; align-items: center; gap: 0.25rem; margin-left: 0.25rem; padding: 0.15rem 0.5rem; border-radius: 0.375rem; font-size: 0.7rem; font-weight: 600; cursor: pointer; background-color: #dbeafe; color: #1e40af; border: none; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); text-decoration: none; transition: all 0.15s ease-in-out;" title="Source: ${type}/${id}" onmouseover="this.style.backgroundColor='#bfdbfe'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 4px 0 rgba(0, 0, 0, 0.1)'" onmouseout="this.style.backgroundColor='#dbeafe'; this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)'"><svg style="width: 0.7rem; height: 0.7rem; flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"></path></svg>${escapedDisplayName}</span>`;
	};

	// Process format: [citation:/entities/id] (no display name)
	let result = text.replace(
		/\[citation:\/entities\/([^\]]+)\]/g,
		(_match, id) => createCitationBadge(id, "entities", id),
	);

	// Process format: [citation:/attrs/id] (no display name)
	result = result.replace(/\[citation:\/attrs\/([^\]]+)\]/g, (_match, id) =>
		createCitationBadge(id, "attrs", id),
	);

	// Process format: [name](/jitera/entities?id=[id]) or [name](/jitera/entities?id=id)
	result = result.replace(
		/\[([^\]]+)\]\(\/jitera\/entities\?id=\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "entities", id),
	);

	// Process format: [name](/jitera/attrs?id=[id]) or [name](/jitera/attrs?id=id)
	result = result.replace(
		/\[([^\]]+)\]\(\/jitera\/attrs\?id=\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "attrs", id),
	);

	// Process format: [name](citation:/entities?id=[id]) or [name](citation:/entities?id=id)
	result = result.replace(
		/\[([^\]]+)\]\(citation:\/entities\?id=\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "entities", id),
	);

	// Process format: [name](citation:/attrs?id=[id]) or [name](citation:/attrs?id=id)
	result = result.replace(
		/\[([^\]]+)\]\(citation:\/attrs\?id=\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "attrs", id),
	);

	// Process format: [name](citation:/entities/[id]) or [name](citation:/entities/id)
	result = result.replace(
		/\[([^\]]+)\]\(citation:\/entities\/\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "entities", id),
	);

	// Process format: [name](citation:/attrs/[id]) or [name](citation:/attrs/id)
	result = result.replace(
		/\[([^\]]+)\]\(citation:\/attrs\/\[?([^\])]+)\]?\)/g,
		(_match, name, id) => createCitationBadge(name, "attrs", id),
	);

	return result;
};

// Enhanced Embedded Markdown Component with comprehensive markdown support
export const EmbeddedMarkdown: React.FC<EmbeddedMarkdownProps> = ({
	content,
	isStreaming = false,
}) => {
	// Helper function to process tables
	const processProcessTables = (text: string) => {
		// Match table patterns with more robust regex
		// This pattern looks for: header row, separator row, then body rows
		const tableRegex =
			/(\|.*?\|)\s*\n(\|[\s\-:]+?\|)\s*\n((?:\|.*?\|\s*\n?)+)/gm;

		return text.replace(
			tableRegex,
			(match, headerRow, separatorRow, bodyRows) => {
				// Process header
				const headers = headerRow
					.split("|")
					.map((h: string) => h.trim())
					.filter((h: string) => h !== ""); // Remove empty cells

				// Process alignment from separator row
				const alignments = separatorRow
					.split("|")
					.map((sep: string) => sep.trim())
					.filter((sep: string) => sep !== "")
					.map((sep: string) => {
						if (sep.startsWith(":") && sep.endsWith(":")) return "center";
						if (sep.endsWith(":")) return "right";
						return "left";
					});

				// Process body rows
				const rows = bodyRows
					.trim()
					.split("\n")
					.filter((row: string) => row.trim())
					.map((row: string) => {
						return row
							.split("|")
							.map((cell: string) => cell.trim())
							.filter((cell: string) => cell !== ""); // Remove empty cells
					})
					.filter((row: string[]) => row.length > 0);

				// Generate table HTML
				const tableStyle = `
				width: 100%;
				border-collapse: collapse;
				font-size: 0.875rem;
				border: 1px solid hsl(var(--border));
				border-radius: 0.375rem;
				overflow: hidden;
			`;

				const headerStyle = `
				background-color: hsl(var(--muted));
				padding: 0.5rem 0.75rem;
				text-align: left;
				font-weight: 600;
				border-bottom: 1px solid hsl(var(--border));
				color: hsl(var(--foreground));
			`;

				const cellStyle = `
				padding: 0.5rem 0.75rem;
				border-bottom: 1px solid hsl(var(--border));
				color: hsl(var(--foreground));
			`;

				let tableHtml = `<div style="overflow-x: auto;"><table style="${tableStyle}">`;

				// Ensure we have valid data
				if (headers.length === 0 || rows.length === 0) {
					return match; // Return original text if table parsing failed
				}

				// Add header
				tableHtml += "<thead><tr>";
				headers.forEach((header: string, i: number) => {
					const align = alignments[i] || "left";
					tableHtml += `<th style="${headerStyle} text-align: ${align};">${header}</th>`;
				});
				tableHtml += "</tr></thead>";

				// Add body
				tableHtml += "<tbody>";
				rows.forEach((row: string[], rowIndex: number) => {
					tableHtml += "<tr>";
					// Ensure each row has the same number of cells as headers
					const maxCells = Math.max(headers.length, row.length);
					for (let i = 0; i < maxCells; i++) {
						const cell = row[i] || ""; // Use empty string if cell is missing
						const align = alignments[i] || "left";
						const isLastRow = rowIndex === rows.length - 1;
						const cellStyleWithBorder = isLastRow
							? cellStyle.replace(
									"border-bottom: 1px solid hsl(var(--border));",
									"",
								)
							: cellStyle;
						tableHtml += `<td style="${cellStyleWithBorder} text-align: ${align};">${cell}</td>`;
					}
					tableHtml += "</tr>";
				});
				tableHtml += "</tbody></table></div>";

				return tableHtml;
			},
		);
	};

	// Enhanced markdown rendering for embedded context
	const renderContent = (text: string) => {
		if (!text) return text;

		// Parse and render tool calls first
		const { toolCalls, cleanText } = parseToolCalls(text);
		const toolCallsHtml = toolCalls.map(renderToolCall).join("");

		// Process citations
		text = processCitations(cleanText);

		// Split by code blocks first to avoid processing them
		const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
		const parts: Array<{
			type: "text" | "code";
			content: string;
			language?: string;
		}> = [];
		let lastIndex = 0;
		let match;

		while ((match = codeBlockRegex.exec(text)) !== null) {
			// Add text before code block
			if (match.index > lastIndex) {
				parts.push({
					type: "text",
					content: text.slice(lastIndex, match.index),
				});
			}
			// Add code block
			parts.push({
				type: "code",
				content: match[2] || "",
				language: match[1] || "text",
			});
			lastIndex = match.index + match[0].length;
		}

		// Add remaining text
		if (lastIndex < text.length) {
			parts.push({ type: "text", content: text.slice(lastIndex) });
		}

		// If no code blocks found, treat entire text as text
		if (parts.length === 0) {
			parts.push({ type: "text", content: text });
		}

		// Process each part
		const processedParts = parts.map((part) => {
			if (part.type === "code") {
				const codeStyle = `
					background-color: hsl(var(--muted));
					border: 1px solid hsl(var(--border));
					border-radius: 0.375rem;
					padding: 0.75rem;
					font-size: 0.875rem;
					line-height: 1.5;
					white-space: pre-wrap;
					word-break: break-word;
					overflow-wrap: break-word;
					overflow: scroll;
					display: block;
					max-width: 100%;
				`;
				return `<pre style="${codeStyle}"><code>${escapeHtml(part.content)}</code></pre>`;
			}

			let processedText = part.content;

			// Headers (### ## #)
			processedText = processedText.replace(
				/^### (.*$)/gm,
				'<h3 style="font-size: 1rem; font-weight: 600; color: hsl(var(--foreground)); margin-top: 1rem; margin-bottom: 0.5rem;">$1</h3>',
			);
			processedText = processedText.replace(
				/^## (.*$)/gm,
				'<h2 style="font-size: 1.125rem; font-weight: 600; color: hsl(var(--foreground)); margin-top: 1.25rem; margin-bottom: 0.5rem;">$1</h2>',
			);
			processedText = processedText.replace(
				/^# (.*$)/gm,
				'<h1 style="font-size: 1.25rem; font-weight: 700; color: hsl(var(--foreground)); margin-top: 1.5rem; margin-bottom: 0.75rem;">$1</h1>',
			);

			// Lists (handle before other processing)
			// Unordered lists
			processedText = processedText.replace(
				/^[\s]*[-*+] (.*)$/gm,
				'<li style="padding-left: 0.5rem;">$1</li>',
			);
			// Wrap consecutive <li> elements in <ul>
			processedText = processedText.replace(
				/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/gs,
				'<ul style="list-style-type: disc; padding-left: 1.5rem;">$1</ul>',
			);

			// Ordered lists
			processedText = processedText.replace(
				/^[\s]*\d+\. (.*)$/gm,
				'<li style="padding-left: 0.5rem;">$1</li>',
			);
			// Note: This is a simplified approach for ordered lists

			// Bold (**text** or __text__)
			processedText = processedText.replace(
				/\*\*(.*?)\*\*/g,
				'<strong style="font-weight: 600;">$1</strong>',
			);
			processedText = processedText.replace(
				/__(.*?)__/g,
				'<strong style="font-weight: 600;">$1</strong>',
			);

			// Italic (*text* or _text_) - be careful not to match inside words
			processedText = processedText.replace(
				/(?<!\w)\*([^*\n]+?)\*(?!\w)/g,
				'<em style="font-style: italic;">$1</em>',
			);
			processedText = processedText.replace(
				/(?<!\w)_([^_\n]+?)_(?!\w)/g,
				'<em style="font-style: italic;">$1</em>',
			);

			// Inline code (`code`)
			processedText = processedText.replace(
				/`([^`]+)`/g,
				'<code style="background-color: hsl(var(--muted)); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.875em;">$1</code>',
			);

			// Links [text](url)
			processedText = processedText.replace(
				/\[([^\]]+)\]\(([^)]+)\)/g,
				'<a href="$2" style="color: hsl(var(--primary)); text-decoration: underline;" target="_blank" rel="noopener noreferrer">$1</a>',
			);

			// Blockquotes (> text)
			processedText = processedText.replace(
				/^> (.*)$/gm,
				'<blockquote style="border-left: 4px solid hsl(var(--primary)); padding-left: 1rem; font-style: italic; color: hsl(var(--muted-foreground));">$1</blockquote>',
			);

			// Horizontal rules (--- or ***)
			processedText = processedText.replace(
				/^(?:---|\*\*\*)\s*$/gm,
				'<hr style="border: none; border-top: 1px solid hsl(var(--border));padding-top: 2px;padding-bottom: 2px">',
			);

			// Strikethrough (~~text~~)
			processedText = processedText.replace(
				/~~(.*?)~~/g,
				'<del style="text-decoration: line-through; opacity: 0.7;">$1</del>',
			);

			// Tables (GitHub Flavored Markdown style)
			processedText = processProcessTables(processedText);

			// Line breaks (double newlines become paragraph breaks, single newlines become <br>)
			processedText = processedText.replace(/\n\n/g, "</p><p>");
			processedText = processedText.replace(/\n/g, "<br>");

			// Wrap in paragraph if not empty and doesn't start with a block element
			if (
				processedText.trim() &&
				!processedText.match(/^<(?:h[1-6]|ul|ol|blockquote|hr|pre|div)/)
			) {
				processedText = `<p style="margin-top: 0.5rem; margin-bottom: 0.5rem;">${processedText}</p>`;
			}

			return processedText;
		});

		// Prepend tool calls HTML to the processed content
		return toolCallsHtml + processedParts.join("");
	};

	// Helper function to escape HTML in code blocks
	const escapeHtml = (text: string) => {
		const div = document.createElement("div");
		div.textContent = text;
		return div.innerHTML;
	};

	return (
		<div
			style={{
				fontSize: "14px",
				lineHeight: "1.5",
				color: "hsl(var(--foreground))",
			}}
			dangerouslySetInnerHTML={{
				__html: renderContent(content),
			}}
		/>
	);
};
