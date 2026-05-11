import React, { useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/main/components/ui/button";

type MessageError = {
	message: string;
	rawMessage?: string;
	statusCode?: number;
	code?: string | number;
	providerName?: string | null;
};

const parseInnerMessage = (message: string): string => {
	const jsonStart = message.indexOf("{");
	if (jsonStart === -1) return message;
	try {
		const parsed = JSON.parse(message.slice(jsonStart));
		if (
			typeof parsed?.error?.message === "string" &&
			parsed.error.message.length > 0
		) {
			return parsed.error.message;
		}
	} catch {}
	return message;
};

export const MessageErrorNotice: React.FC<{
	error: MessageError;
}> = ({ error }) => {
	const [expanded, setExpanded] = useState(false);
	const displayMessage = parseInnerMessage(error.message);
	const hasDetails = error.rawMessage
		? error.rawMessage !== displayMessage
		: error.message !== displayMessage;
	const fullDetails = error.rawMessage ?? error.message;

	return (
		<div className="my-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
			<div className="flex items-start gap-2">
				<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
				<div className="min-w-0 flex-1">
					<div className="whitespace-pre-wrap break-words">
						{displayMessage}
					</div>
					{hasDetails && (
						<>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setExpanded((v) => !v)}
								className="mt-1 h-auto px-1 py-0.5 text-xs text-destructive/75 hover:bg-destructive/10 hover:text-destructive"
							>
								<ChevronDown
									className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
								/>
								{expanded ? "Hide details" : "Show details"}
							</Button>
							{expanded && (
								<div className="mt-1 whitespace-pre-wrap break-all text-xs text-destructive/75">
									{fullDetails}
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
};
