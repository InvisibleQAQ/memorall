import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEmbeddedContextItem } from "@/embedded/context-items";
import {
	extractElementCleanHTML,
	extractElementOuterHTML,
	extractElementTextContent,
} from "@/embedded/content-extraction";
import type { EmbeddedContextItem } from "@/embedded/types";

interface SmartSelectOverlayTexts {
	smartSelect: string;
	smartSelectInstruction: string;
	smartSelectCancel: string;
	smartSelectChooseFormat: string;
	smartSelectText: string;
	smartSelectCleanHtml: string;
	smartSelectHtml: string;
}

interface SmartSelectOverlayProps {
	onSelectContext: (item: EmbeddedContextItem) => void;
	onCancel: () => void;
	texts: SmartSelectOverlayTexts;
}

const SMART_SELECT_CONTAINER_ID = "memorall-smart-select-container";
let activeOverlayCleanup: (() => void) | null = null;

const getIgnoredContainers = (): HTMLElement[] =>
	[
		document.getElementById("memorall-embedded-chat-modal"),
		document.getElementById("memorall-image-selector-container"),
		document.getElementById(SMART_SELECT_CONTAINER_ID),
	].filter((node): node is HTMLElement => Boolean(node));

const isIgnoredNode = (target: EventTarget | null): boolean => {
	if (!(target instanceof Node)) {
		return false;
	}

	return getIgnoredContainers().some((container) => container.contains(target));
};

const getTargetElement = (clientX: number, clientY: number): Element | null => {
	const element = document.elementFromPoint(clientX, clientY);
	if (!element || isIgnoredNode(element)) {
		return null;
	}

	return element;
};

const describeElement = (element: Element): string => {
	const tagName = element.tagName.toLowerCase();
	const textCandidate =
		extractElementTextContent(element) ||
		element.getAttribute("aria-label") ||
		element.getAttribute("title") ||
		element.getAttribute("alt") ||
		"";
	const normalizedText = textCandidate.replace(/\s+/g, " ").trim();
	return normalizedText
		? `<${tagName}> ${normalizedText.slice(0, 48)}`
		: `<${tagName}>`;
};

const describeElementText = (element: Element): string => {
	const textCandidate =
		extractElementTextContent(element) ||
		element.getAttribute("aria-label") ||
		element.getAttribute("title") ||
		element.getAttribute("alt") ||
		element.tagName.toLowerCase();

	return textCandidate.replace(/\s+/g, " ").trim().slice(0, 48);
};

const SmartSelectOverlay: React.FC<SmartSelectOverlayProps> = ({
	onSelectContext,
	onCancel,
	texts,
}) => {
	const [hoveredElement, setHoveredElement] = useState<Element | null>(null);
	const [selectedElement, setSelectedElement] = useState<Element | null>(null);
	const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
	const [chooserPoint, setChooserPoint] = useState<{
		x: number;
		y: number;
	} | null>(null);

	const updateHighlight = useCallback((element: Element | null) => {
		setHighlightRect(element ? element.getBoundingClientRect() : null);
	}, []);

	useEffect(() => {
		const chatContainer = document.getElementById(
			"memorall-embedded-chat-modal",
		);
		if (!chatContainer) {
			return;
		}

		const previousPointerEvents = chatContainer.style.pointerEvents;
		chatContainer.style.pointerEvents = "none";

		return () => {
			chatContainer.style.pointerEvents = previousPointerEvents;
		};
	}, []);

	useEffect(() => {
		const handleMouseMove = (event: MouseEvent) => {
			if (selectedElement || isIgnoredNode(event.target)) {
				return;
			}

			const nextElement = getTargetElement(event.clientX, event.clientY);
			if (nextElement === hoveredElement) {
				return;
			}

			setHoveredElement(nextElement);
			updateHighlight(nextElement);
		};

		const handleClick = (event: MouseEvent) => {
			if (isIgnoredNode(event.target)) {
				return;
			}

			const nextElement = getTargetElement(event.clientX, event.clientY);
			if (!nextElement) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			setSelectedElement(nextElement);
			setHoveredElement(null);
			updateHighlight(nextElement);
			setChooserPoint({ x: event.clientX, y: event.clientY });
		};

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onCancel();
			}
		};

		document.addEventListener("mousemove", handleMouseMove, true);
		document.addEventListener("click", handleClick, true);
		window.addEventListener("keydown", handleKeyDown, true);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove, true);
			document.removeEventListener("click", handleClick, true);
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, [hoveredElement, onCancel, selectedElement, updateHighlight]);

	useEffect(() => {
		const trackedElement = selectedElement ?? hoveredElement;
		if (!trackedElement) {
			return;
		}

		const refreshRect = () => {
			updateHighlight(trackedElement);
		};

		window.addEventListener("scroll", refreshRect, true);
		window.addEventListener("resize", refreshRect, true);

		return () => {
			window.removeEventListener("scroll", refreshRect, true);
			window.removeEventListener("resize", refreshRect, true);
		};
	}, [hoveredElement, selectedElement, updateHighlight]);

	const chooserStyle = useMemo(() => {
		if (!chooserPoint) {
			return null;
		}

		const width = 220;
		const margin = 16;
		const left = Math.min(
			Math.max(chooserPoint.x, margin),
			window.innerWidth - width - margin,
		);
		const top = Math.min(
			Math.max(chooserPoint.y + 12, margin),
			window.innerHeight - 210,
		);

		return { left, top };
	}, [chooserPoint]);

	const handleChoose = useCallback(
		(mode: "text" | "clean_html" | "html") => {
			if (!selectedElement) {
				return;
			}

			const descriptor = describeElement(selectedElement);

			if (mode === "text") {
				onSelectContext(
					createEmbeddedContextItem({
						kind: "smart_text",
						label: `${texts.smartSelectText}: ${describeElementText(selectedElement)}`,
						content: extractElementTextContent(selectedElement),
					}),
				);
				return;
			}

			if (mode === "clean_html") {
				onSelectContext(
					createEmbeddedContextItem({
						kind: "smart_clean_html",
						label: `${texts.smartSelectCleanHtml}: ${descriptor}`,
						content: extractElementCleanHTML(selectedElement),
					}),
				);
				return;
			}

			onSelectContext(
				createEmbeddedContextItem({
					kind: "smart_html",
					label: `${texts.smartSelectHtml}: ${descriptor}`,
					content: extractElementOuterHTML(selectedElement),
				}),
			);
		},
		[onSelectContext, selectedElement, texts],
	);

	return (
		<div
			id="memorall-smart-select-overlay"
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 2147483646,
				pointerEvents: "none",
				fontFamily: "system-ui, -apple-system, sans-serif",
			}}
		>
			{highlightRect && (
				<div
					style={{
						position: "fixed",
						left: highlightRect.left,
						top: highlightRect.top,
						width: highlightRect.width,
						height: highlightRect.height,
						border: selectedElement
							? "2px solid rgba(59, 130, 246, 0.95)"
							: "2px solid rgba(16, 185, 129, 0.95)",
						backgroundColor: selectedElement
							? "rgba(59, 130, 246, 0.12)"
							: "rgba(16, 185, 129, 0.10)",
						boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.12)",
						borderRadius: "6px",
						transition: "all 120ms ease-out",
					}}
				/>
			)}

			<div
				style={{
					position: "fixed",
					top: 16,
					left: "50%",
					transform: "translateX(-50%)",
					backgroundColor: "rgba(15, 23, 42, 0.96)",
					color: "#fff",
					padding: "10px 14px",
					borderRadius: "10px",
					boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
					fontSize: "13px",
					maxWidth: "min(420px, calc(100vw - 32px))",
					pointerEvents: "auto",
				}}
			>
				<div style={{ fontWeight: 600, marginBottom: 4 }}>
					{texts.smartSelect}
				</div>
				<div style={{ lineHeight: 1.4, color: "rgba(255,255,255,0.85)" }}>
					{texts.smartSelectInstruction}
				</div>
			</div>

			<button
				type="button"
				onClick={onCancel}
				style={{
					position: "fixed",
					top: 18,
					right: 18,
					border: "none",
					borderRadius: "999px",
					backgroundColor: "rgba(220, 38, 38, 0.96)",
					color: "#fff",
					padding: "8px 14px",
					fontSize: "13px",
					fontWeight: 600,
					boxShadow: "0 10px 24px rgba(0, 0, 0, 0.28)",
					cursor: "pointer",
					pointerEvents: "auto",
				}}
			>
				{texts.smartSelectCancel}
			</button>

			{selectedElement && chooserStyle && (
				<div
					style={{
						position: "fixed",
						left: chooserStyle.left,
						top: chooserStyle.top,
						width: 220,
						backgroundColor: "#fff",
						color: "#111827",
						borderRadius: "12px",
						boxShadow: "0 18px 48px rgba(15, 23, 42, 0.32)",
						border: "1px solid rgba(148, 163, 184, 0.35)",
						padding: "10px",
						pointerEvents: "auto",
					}}
				>
					<div
						style={{
							fontSize: "12px",
							fontWeight: 700,
							color: "#475569",
							marginBottom: "8px",
						}}
					>
						{texts.smartSelectChooseFormat}
					</div>
					<div
						style={{
							fontSize: "12px",
							color: "#0f172a",
							backgroundColor: "#f8fafc",
							borderRadius: "8px",
							padding: "8px 10px",
							marginBottom: "8px",
							wordBreak: "break-word",
						}}
					>
						{describeElement(selectedElement)}
					</div>
					<div style={{ display: "grid", gap: "8px" }}>
						<button
							type="button"
							onClick={() => handleChoose("text")}
							style={choiceButtonStyle}
						>
							{texts.smartSelectText}
						</button>
						<button
							type="button"
							onClick={() => handleChoose("clean_html")}
							style={choiceButtonStyle}
						>
							{texts.smartSelectCleanHtml}
						</button>
						<button
							type="button"
							onClick={() => handleChoose("html")}
							style={choiceButtonStyle}
						>
							{texts.smartSelectHtml}
						</button>
						<button
							type="button"
							onClick={onCancel}
							style={{
								...choiceButtonStyle,
								backgroundColor: "#fee2e2",
								color: "#991b1b",
							}}
						>
							{texts.smartSelectCancel}
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

const choiceButtonStyle: React.CSSProperties = {
	border: "none",
	borderRadius: "8px",
	backgroundColor: "#eff6ff",
	color: "#1d4ed8",
	padding: "9px 12px",
	fontSize: "13px",
	fontWeight: 600,
	cursor: "pointer",
	textAlign: "left",
};

export function createSmartSelectOverlay(
	onSelectContext: (item: EmbeddedContextItem) => void,
	onCancel: () => void,
	texts: SmartSelectOverlayTexts,
): () => void {
	activeOverlayCleanup?.();

	const container = document.createElement("div");
	container.id = SMART_SELECT_CONTAINER_ID;
	document.body.appendChild(container);

	const root = createRoot(container);
	const cleanup = () => {
		root.unmount();
		container.remove();
		if (activeOverlayCleanup === cleanup) {
			activeOverlayCleanup = null;
		}
	};

	activeOverlayCleanup = cleanup;
	root.render(
		<SmartSelectOverlay
			texts={texts}
			onSelectContext={(item) => {
				onSelectContext(item);
				cleanup();
			}}
			onCancel={() => {
				onCancel();
				cleanup();
			}}
		/>,
	);

	return cleanup;
}
