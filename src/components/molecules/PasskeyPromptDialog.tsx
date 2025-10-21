import React, { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Key, AlertCircle, Loader2 } from "lucide-react";

interface PasskeyPromptDialogProps {
	open: boolean;
	provider: "openai" | "openrouter";
	onPasskeySubmit: (passkey: string) => Promise<void>;
	onCancel: () => void;
}

export const PasskeyPromptDialog: React.FC<PasskeyPromptDialogProps> = ({
	open,
	provider,
	onPasskeySubmit,
	onCancel,
}) => {
	const [passkey, setPasskey] = useState("");
	const [showPasskey, setShowPasskey] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const providerLabel = provider === "openai" ? "OpenAI" : "OpenRouter";

	const handleSubmit = async () => {
		if (passkey.length !== 6) {
			setError("Passkey must be exactly 6 characters");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			await onPasskeySubmit(passkey);
			// Success - dialog will be closed by parent
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to decrypt";
			setError(msg);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && passkey.length === 6 && !isLoading) {
			handleSubmit();
		}
	};

	const handleCancelClick = () => {
		const confirmed = window.confirm(
			`Are you sure you want to cancel?\n\nThis will clear the selected ${providerLabel} model. You'll need to select a different model to continue.`,
		);

		if (confirmed) {
			onCancel();
		}
	};

	return (
		<Dialog open={open} onOpenChange={() => {}}>
			<DialogContent
				className="sm:max-w-md w-[calc(100%-20px)]"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Key className="w-5 h-5 text-primary" />
						{providerLabel} Authentication Required
					</DialogTitle>
					<DialogDescription>
						You have a {providerLabel} model configured. Please enter your
						6-character passkey to decrypt and load the configuration.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label className="text-sm text-muted-foreground mb-2 block">
							Encryption Passkey <span className="text-destructive">*</span>
						</label>
						<div className="relative">
							<Input
								type={showPasskey ? "text" : "password"}
								placeholder="6 characters"
								value={passkey}
								onChange={(e) => setPasskey(e.target.value.slice(0, 6))}
								onKeyDown={handleKeyDown}
								disabled={isLoading}
								className="pr-10"
								maxLength={6}
								autoFocus
							/>
							<button
								type="button"
								onClick={() => setShowPasskey(!showPasskey)}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
								disabled={isLoading}
							>
								{showPasskey ? (
									<EyeOff className="w-4 h-4 text-muted-foreground" />
								) : (
									<Eye className="w-4 h-4 text-muted-foreground" />
								)}
							</button>
						</div>
						{passkey.length > 0 && passkey.length !== 6 && (
							<div className="flex items-center gap-2 p-2 mt-2 border rounded bg-muted/50 border-border">
								<AlertCircle className="w-4 h-4 text-muted-foreground" />
								<span className="text-xs text-muted-foreground">
									Passkey must be exactly 6 characters ({passkey.length}/6)
								</span>
							</div>
						)}
					</div>

					{error && (
						<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">
							<AlertCircle className="w-4 h-4" />
							{error}
						</div>
					)}

					<div className="flex gap-2">
						<Button
							onClick={handleSubmit}
							disabled={isLoading || passkey.length !== 6}
							className="flex-1"
						>
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Decrypting...
								</>
							) : (
								<>
									<Key className="w-4 h-4 mr-2" />
									Unlock
								</>
							)}
						</Button>
						<Button
							onClick={handleCancelClick}
							disabled={isLoading}
							variant="outline"
							className="flex-1"
						>
							Cancel
						</Button>
					</div>

					<div className="text-xs text-muted-foreground text-center pt-2 border-t">
						This passkey was set when you first configured {providerLabel}. If
						you've forgotten it, you'll need to reconfigure the provider.
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
