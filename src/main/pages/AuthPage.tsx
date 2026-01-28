import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	CardFooter,
} from "@/main/components/ui/card";
import { Input } from "@/main/components/ui/input";
import { Button } from "@/main/components/ui/button";
import { Label } from "@/main/components/ui/label";
import { useAuth, useAuthActions } from "@/main/modules/supabase";
import { logError } from "@/utils/logger";

type AuthMode = "signin" | "signup" | "configure";

export const AuthPage: React.FC = () => {
	const navigate = useNavigate();
	const { isConfigured, user } = useAuth();
	const { signIn, signUp, configure, error: authError } = useAuthActions();
	const { t } = useTranslation("auth");

	// Always start with signin mode (configuration is done via .env)
	const [mode, setMode] = useState<AuthMode>("signin");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [supabaseUrl, setSupabaseUrl] = useState("");
	const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [localError, setLocalError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	// Redirect if already logged in
	React.useEffect(() => {
		if (user) {
			navigate("/");
		}
	}, [user, navigate]);

	const handleConfigure = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocalError(null);
		setSuccessMessage(null);

		if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
			setLocalError(t("errors.missingSupabaseConfig"));
			return;
		}

		try {
			setIsSubmitting(true);
			await configure({
				supabaseUrl: supabaseUrl.trim(),
				supabaseAnonKey: supabaseAnonKey.trim(),
			});
			setSuccessMessage("Supabase configured successfully!");
			setMode("signin");
		} catch (err) {
			logError("Configuration failed:", err);
			setLocalError(
				err instanceof Error ? err.message : t("errors.configureFailed"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSignIn = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocalError(null);
		setSuccessMessage(null);

		if (!email.trim() || !password.trim()) {
			setLocalError(t("errors.missingEmailOrPassword"));
			return;
		}

		try {
			setIsSubmitting(true);
			await signIn({
				email: email.trim(),
				password: password.trim(),
			});
			// Navigation will happen automatically via useEffect when user state changes
		} catch (err) {
			logError("Sign in failed:", err);
			setLocalError(
				err instanceof Error ? err.message : t("errors.signInFailed"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		setLocalError(null);
		setSuccessMessage(null);

		if (!email.trim() || !password.trim()) {
			setLocalError("Please provide both email and password");
			return;
		}

		if (password.length < 6) {
			setLocalError(t("errors.passwordTooShort"));
			return;
		}

		try {
			setIsSubmitting(true);
			await signUp({
				email: email.trim(),
				password: password.trim(),
			});
			setSuccessMessage(t("messages.accountCreated"));
			setMode("signin");
		} catch (err) {
			logError("Sign up failed:", err);
			setLocalError(
				err instanceof Error ? err.message : t("errors.signUpFailed"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSkip = () => {
		navigate("/");
	};

	const displayError = authError || localError;

	// If Supabase is not configured in .env, show message
	if (!isConfigured) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-background p-4">
				<Card className="w-full max-w-md">
					<CardHeader>
						<CardTitle>{t("notConfigured.title")}</CardTitle>
						<CardDescription>{t("notConfigured.description")}</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground mb-4">
							{t("notConfigured.helpText")}
						</p>
					</CardContent>
					<CardFooter>
						<Button onClick={handleSkip} variant="outline" className="w-full">
							{t("actions.continueWithoutAccount")}
						</Button>
					</CardFooter>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>
						{mode === "signin" ? t("titles.signIn") : t("titles.signUp")}
					</CardTitle>
					<CardDescription>
						{mode === "signin"
							? t("descriptions.signIn")
							: t("descriptions.signUp")}
					</CardDescription>
				</CardHeader>

				<CardContent>
					{displayError && (
						<div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
							<AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
							<p className="text-sm text-destructive">{displayError}</p>
						</div>
					)}

					{successMessage && (
						<div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md flex items-start gap-2">
							<CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
							<p className="text-sm text-green-600 dark:text-green-400">
								{successMessage}
							</p>
						</div>
					)}

					{mode === "signin" && (
						<form onSubmit={handleSignIn} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="email">{t("fields.email.label")}</Label>
								<Input
									id="email"
									type="email"
									placeholder={t("fields.email.placeholder")}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={isSubmitting}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="password">{t("fields.password.label")}</Label>
								<Input
									id="password"
									type="password"
									placeholder={t("fields.password.placeholder")}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={isSubmitting}
									required
								/>
							</div>
							<Button type="submit" className="w-full" disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										{t("actions.signingIn")}
									</>
								) : (
									t("actions.signIn")
								)}
							</Button>
						</form>
					)}

					{mode === "signup" && (
						<form onSubmit={handleSignUp} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="signup-email">{t("fields.email.label")}</Label>
								<Input
									id="signup-email"
									type="email"
									placeholder={t("fields.email.placeholder")}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									disabled={isSubmitting}
									required
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="signup-password">
									{t("fields.password.label")}
								</Label>
								<Input
									id="signup-password"
									type="password"
									placeholder={t("fields.password.signupPlaceholder")}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={isSubmitting}
									required
									minLength={6}
								/>
							</div>
							<Button type="submit" className="w-full" disabled={isSubmitting}>
								{isSubmitting ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										{t("actions.creatingAccount")}
									</>
								) : (
									t("actions.signUp")
								)}
							</Button>
						</form>
					)}
				</CardContent>

				<CardFooter className="flex flex-col gap-2">
					{mode === "signin" && (
						<Button
							variant="ghost"
							className="w-full"
							onClick={() => setMode("signup")}
							disabled={isSubmitting}
						>
							{t("actions.goToSignUp")}
						</Button>
					)}

					{mode === "signup" && (
						<Button
							variant="ghost"
							className="w-full"
							onClick={() => setMode("signin")}
							disabled={isSubmitting}
						>
							{t("actions.goToSignIn")}
						</Button>
					)}

					<div className="w-full border-t my-2" />

					<Button
						variant="outline"
						className="w-full"
						onClick={handleSkip}
						disabled={isSubmitting}
					>
						{t("actions.skipLocalOnly")}
					</Button>
				</CardFooter>
			</Card>
		</div>
	);
};
