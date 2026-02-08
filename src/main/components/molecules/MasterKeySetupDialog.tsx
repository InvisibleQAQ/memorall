import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/main/components/ui/dialog";
import { Button } from "@/main/components/ui/button";
import { Input } from "@/main/components/ui/input";
import {
	Eye,
	EyeOff,
	Key,
	Shield,
	AlertCircle,
	Loader2,
	CheckCircle,
} from "lucide-react";

interface MasterKeySetupDialogProps {
	open: boolean;
	onSetupComplete: (passkey: string) => Promise<void>;
	onCancel?: () => void;
}

export const MasterKeySetupDialog: React.FC<MasterKeySetupDialogProps> = ({
	open,
	onSetupComplete,
	onCancel,
}) => {
	const { t } = useTranslation("common");
	const [passkey, setPasskey] = useState("");
	const [confirmPasskey, setConfirmPasskey] = useState("");
	const [showPasskey, setShowPasskey] = useState(false);
	const [showConfirmPasskey, setShowConfirmPasskey] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const getStrengthLevel = (key: string) => {
		if (key.length < 6) return 0;
		if (key.length < 8) return 1;
		if (key.length < 12) return 2;
		return 3;
	};

	const strengthLevel = getStrengthLevel(passkey);
	const strengthLabels = [
		t("masterKeySetup.strength.weak"),
		t("masterKeySetup.strength.fair"),
		t("masterKeySetup.strength.good"),
		t("masterKeySetup.strength.strong"),
	];
	const strengthColors = [
		"bg-destructive",
		"bg-orange-500",
		"bg-yellow-500",
		"bg-green-500",
	];

	const isValidPasskey = passkey.length >= 6;
	const passkeysMatch = passkey === confirmPasskey;
	const canSubmit = isValidPasskey && passkeysMatch && confirmPasskey.length > 0;

	const handleSubmit = async () => {
		if (!canSubmit) {
			if (!isValidPasskey) {
				setError(t("masterKeySetup.errors.tooShort"));
			} else if (!passkeysMatch) {
				setError(t("masterKeySetup.errors.noMatch"));
			}
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			await onSetupComplete(passkey);
			// Success - dialog will be closed by parent
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : t("masterKeySetup.errors.failed");
			setError(msg);
		} finally {
			setIsLoading(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && canSubmit && !isLoading) {
			handleSubmit();
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
						<Shield className="w-5 h-5 text-primary" />
						{t("masterKeySetup.title")}
					</DialogTitle>
					<DialogDescription>
						{t("masterKeySetup.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Info box */}
					<div className="p-3 border rounded-lg bg-muted/20 border-border">
						<div className="flex items-start gap-2">
							<Key className="w-4 h-4 text-primary mt-0.5" />
							<div className="text-xs text-muted-foreground">
								{t("masterKeySetup.infoText")}
							</div>
						</div>
					</div>

					{/* Passkey input */}
					<div>
						<label className="text-sm text-muted-foreground mb-2 block">
							{t("masterKeySetup.passkeyLabel")}{" "}
							<span className="text-destructive">*</span>
						</label>
						<div className="relative">
							<Input
								type={showPasskey ? "text" : "password"}
								placeholder={t("masterKeySetup.passkeyPlaceholder")}
								value={passkey}
								onChange={(e) => setPasskey(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={isLoading}
								className="pr-10"
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

						{/* Strength indicator */}
						{passkey.length > 0 && (
							<div className="mt-2 space-y-1">
								<div className="flex gap-1">
									{[0, 1, 2, 3].map((level) => (
										<div
											key={level}
											className={`h-1 flex-1 rounded ${
												level <= strengthLevel
													? strengthColors[strengthLevel]
													: "bg-muted"
											}`}
										/>
									))}
								</div>
								<div className="flex justify-between items-center">
									<span className="text-xs text-muted-foreground">
										{strengthLabels[strengthLevel]}
									</span>
									{passkey.length < 6 && (
										<span className="text-xs text-muted-foreground">
											{t("masterKeySetup.minLength", { current: passkey.length })}
										</span>
									)}
								</div>
							</div>
						)}
					</div>

					{/* Confirm passkey input */}
					<div>
						<label className="text-sm text-muted-foreground mb-2 block">
							{t("masterKeySetup.confirmLabel")}{" "}
							<span className="text-destructive">*</span>
						</label>
						<div className="relative">
							<Input
								type={showConfirmPasskey ? "text" : "password"}
								placeholder={t("masterKeySetup.confirmPlaceholder")}
								value={confirmPasskey}
								onChange={(e) => setConfirmPasskey(e.target.value)}
								onKeyDown={handleKeyDown}
								disabled={isLoading}
								className="pr-10"
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPasskey(!showConfirmPasskey)}
								className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
								disabled={isLoading}
							>
								{showConfirmPasskey ? (
									<EyeOff className="w-4 h-4 text-muted-foreground" />
								) : (
									<Eye className="w-4 h-4 text-muted-foreground" />
								)}
							</button>
						</div>

						{/* Match indicator */}
						{confirmPasskey.length > 0 && (
							<div className="flex items-center gap-2 mt-2">
								{passkeysMatch ? (
									<>
										<CheckCircle className="w-4 h-4 text-green-500" />
										<span className="text-xs text-green-500">
											{t("masterKeySetup.passkeysMatch")}
										</span>
									</>
								) : (
									<>
										<AlertCircle className="w-4 h-4 text-destructive" />
										<span className="text-xs text-destructive">
											{t("masterKeySetup.passkeysNoMatch")}
										</span>
									</>
								)}
							</div>
						)}
					</div>

					{/* Error display */}
					{error && (
						<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded border border-destructive/20">
							<AlertCircle className="w-4 h-4" />
							{error}
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-2">
						<Button
							onClick={handleSubmit}
							disabled={isLoading || !canSubmit}
							className="flex-1"
						>
							{isLoading ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									{t("masterKeySetup.creating")}
								</>
							) : (
								<>
									<Shield className="w-4 h-4 mr-2" />
									{t("masterKeySetup.createButton")}
								</>
							)}
						</Button>
						{onCancel && (
							<Button
								onClick={onCancel}
								disabled={isLoading}
								variant="outline"
							>
								{t("buttons.cancel")}
							</Button>
						)}
					</div>

					{/* Help text */}
					<div className="text-xs text-muted-foreground text-center pt-2 border-t">
						{t("masterKeySetup.helpText")}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
