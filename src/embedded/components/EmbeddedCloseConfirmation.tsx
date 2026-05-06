import { useEmbeddedTranslation } from "@/embedded/hooks/use-embedded-language";

interface EmbeddedCloseConfirmationProps {
	onCancel: () => void;
	onConfirm: () => void;
}

export const EmbeddedCloseConfirmation = ({
	onCancel,
	onConfirm,
}: EmbeddedCloseConfirmationProps) => {
	const t = useEmbeddedTranslation("chat");
	return (
		<div
			className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200"
			onClick={onCancel}
		>
			<div
				className="bg-background border rounded-lg shadow-xl p-6 max-w-sm mx-4 animate-in zoom-in-95 duration-200"
				onClick={(event) => event.stopPropagation()}
				onKeyDown={(event) => {
					event.stopPropagation();
					if (event.key === "Escape") {
						onCancel();
					}
				}}
				onKeyUp={(event) => event.stopPropagation()}
				onKeyPress={(event) => event.stopPropagation()}
			>
				<div className="space-y-4">
					<div className="space-y-2">
						<h3 className="text-lg font-semibold text-foreground">
							{t("closeChat")}
						</h3>
						<p className="text-sm text-muted-foreground">
							{t("closeConfirmation")}
						</p>
					</div>
					<div className="flex gap-3 justify-end">
						<button
							onClick={onCancel}
							className="px-4 py-2 text-sm font-medium rounded-md border border-border bg-background hover:bg-accent text-foreground transition-colors"
							onKeyDown={(event) => event.stopPropagation()}
							onKeyUp={(event) => event.stopPropagation()}
							onKeyPress={(event) => event.stopPropagation()}
						>
							{t("cancel")}
						</button>
						<button
							onClick={onConfirm}
							className="px-4 py-2 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
							onKeyDown={(event) => event.stopPropagation()}
							onKeyUp={(event) => event.stopPropagation()}
							onKeyPress={(event) => event.stopPropagation()}
						>
							{t("closeAnyway")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
