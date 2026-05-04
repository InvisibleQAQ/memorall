import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface EmbeddedMarkdownProps {
	content: string;
	isStreaming?: boolean;
}

const isSafeUrl = (href?: string): boolean => {
	if (!href) return false;
	const value = href.trim().toLowerCase();
	return (
		value.startsWith("http://") ||
		value.startsWith("https://") ||
		value.startsWith("mailto:") ||
		value.startsWith("#") ||
		value.startsWith("citation:") ||
		value.startsWith("/jitera/")
	);
};

export const EmbeddedMarkdown: React.FC<EmbeddedMarkdownProps> = ({
	content,
}) => {
	return (
		<div className="memorall-markdown">
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					a: ({ href, children, ...props }) => {
						if (!isSafeUrl(href)) {
							return <span>{children}</span>;
						}

						return (
							<a
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								{...props}
							>
								{children}
							</a>
						);
					},
					input: ({ checked, type }) => (
						<span
							className="memorall-markdown-checkbox"
							aria-label={
								type === "checkbox"
									? checked
										? "Checked"
										: "Unchecked"
									: "Input"
							}
						>
							{checked ? "✓" : ""}
						</span>
					),
					img: ({ src, alt }) => {
						if (!isSafeUrl(src)) {
							return null;
						}

						return <img src={src} alt={alt ?? ""} loading="lazy" />;
					},
					code: ({ children, className, ...props }) => {
						const match = /language-([\w-]+)/.exec(className || "");
						const isBlock = Boolean(match);

						if (!isBlock) {
							return (
								<code className="memorall-markdown-inline-code" {...props}>
									{children}
								</code>
							);
						}

						return (
							<pre className="memorall-markdown-codeblock">
								<code className={className} {...props}>
									{children}
								</code>
							</pre>
						);
					},
					table: ({ children }) => (
						<div className="memorall-markdown-table-wrap">
							<table>{children}</table>
						</div>
					),
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
};
