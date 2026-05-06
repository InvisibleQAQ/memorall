import React from "react";
import { Send } from "lucide-react";
import { AgentIcon } from "@/components/AgentIcon";
import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";
import type { CoAgentContextAnchor } from "@/embedded/utils/co-agent/context-anchor";
import { CO_AGENT_CONTEXT_SHORTCUT_LABEL } from "./useCoAgentContextAnchor";

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

const getAnchorPosition = (
	anchor: CoAgentContextAnchor,
	variant: "trigger" | "prompt",
): React.CSSProperties => {
	const width = variant === "prompt" ? 340 : 46;
	const height = variant === "prompt" ? 58 : 42;
	const gap = 10;
	const maxLeft = Math.max(12, window.innerWidth - width - 12);
	const maxTop = Math.max(12, window.innerHeight - height - 12);
	let left = anchor.rect.x + anchor.rect.width + gap;
	if (left + width > window.innerWidth - 12) {
		left = anchor.rect.x - width - gap;
	}
	let top = anchor.rect.y + Math.min(anchor.rect.height, 42);
	if (top + height > window.innerHeight - 12) {
		top = anchor.rect.y - height - gap;
	}
	return {
		left: `${clamp(left, 12, maxLeft)}px`,
		top: `${clamp(top, 12, maxTop)}px`,
	};
};

interface AnchorTriggerProps {
	anchor: CoAgentContextAnchor;
	onOpen: () => void;
}

export const CoAgentAnchorTrigger: React.FC<AnchorTriggerProps> = ({
	anchor,
	onOpen,
}) => {
	const t = useEmbeddedTranslation("coAgent");
	const label = t("askAboutThisShortcut", {
		shortcut: CO_AGENT_CONTEXT_SHORTCUT_LABEL,
	});
	return (
		<button
			type="button"
			className="memorall-co-agent-anchor-trigger"
			style={getAnchorPosition(anchor, "trigger")}
			aria-label={label}
			title={label}
			onClick={onOpen}
		>
			<AgentIcon size={34} animation="happy" reactive={false} />
		</button>
	);
};

interface AnchorPromptProps {
	anchor: CoAgentContextAnchor;
	value: string;
	inputRef: React.RefObject<HTMLTextAreaElement | null>;
	modelAvailable: boolean;
	isSubmitting: boolean;
	onChange: (value: string) => void;
	onClose: () => void;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export const CoAgentAnchorPrompt: React.FC<AnchorPromptProps> = ({
	anchor,
	value,
	inputRef,
	modelAvailable,
	isSubmitting,
	onChange,
	onClose,
	onSubmit,
}) => {
	const t = useEmbeddedTranslation("coAgent");
	return (
		<form
			className="memorall-co-agent-anchor-prompt"
			style={getAnchorPosition(anchor, "prompt")}
			onSubmit={onSubmit}
		>
			<textarea
				ref={inputRef}
				value={value}
				onChange={(event) => onChange(event.currentTarget.value)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onClose();
						return;
					}
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						event.currentTarget.form?.requestSubmit();
					}
				}}
				placeholder={
					modelAvailable ? t("askAboutThisPlaceholder") : t("noModelAvailable")
				}
				disabled={!modelAvailable || isSubmitting}
				rows={1}
			/>
			<button
				type="submit"
				aria-label={t("send")}
				disabled={!value.trim() || !modelAvailable || isSubmitting}
			>
				<Send size={15} strokeWidth={2.2} />
			</button>
		</form>
	);
};
