import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Loader2 } from "lucide-react";

interface ChatSectionProps {
	ready: boolean;
	prompt: string;
	setPrompt: (prompt: string) => void;
	loading: boolean;
	onGenerate: () => Promise<void>;
	output: string;
}

export const ChatSection: React.FC<ChatSectionProps> = ({
	ready,
	prompt,
	setPrompt,
	loading,
	onGenerate,
	output,
}) => {
	const { t } = useTranslation("llm");
	if (!ready) return null;

	return (
		<div className="space-y-3 pt-4 border-t">
			<h3 className="text-sm font-semibold flex items-center gap-2">
				<MessageSquare size={16} />
				{t("chat.title")}
			</h3>
			<div className="flex gap-2">
				<Input
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && onGenerate()}
					disabled={loading}
					placeholder={t("chat.placeholder")}
				/>
				<Button onClick={onGenerate} disabled={loading || !prompt.trim()}>
					{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("chat.generate")}
				</Button>
			</div>

			{output && (
				<div className="p-3 border rounded bg-muted/30 whitespace-pre-wrap text-sm">
					{output}
				</div>
			)}
		</div>
	);
};
