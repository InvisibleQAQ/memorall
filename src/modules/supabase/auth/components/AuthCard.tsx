import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth, useAuthActions } from "../hooks";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export const AuthCard: React.FC = () => {
	const navigate = useNavigate();
	const { user, isLoading, isConfigured } = useAuth();
	const { signOut } = useAuthActions();
	const { t } = useTranslation("auth");

	// Don't show anything if Supabase is not configured in .env
	if (!isConfigured) {
		return null;
	}

	if (isLoading) {
		return null;
	}

	const handleSignOut = async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out failed:", error);
		}
	};

	// User is logged in
	if (user) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">
						{t("card.accountTitle")}
					</CardTitle>
					<CardDescription>
						{t("card.accountDescription")}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-center gap-2 p-2 bg-muted rounded-md">
						<UserIcon className="h-4 w-4" />
						<span className="text-sm truncate">{user.email}</span>
					</div>
					<Button onClick={handleSignOut} className="w-full" variant="outline">
						<LogOut className="mr-2 h-4 w-4" />
						{t("actions.signOut")}
					</Button>
				</CardContent>
			</Card>
		);
	}

	// User is not logged in
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">
					{t("card.signInTitle")}
				</CardTitle>
				<CardDescription>
					{t("card.signInDescription")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button onClick={() => navigate("/auth")} className="w-full">
					<LogIn className="mr-2 h-4 w-4" />
					{t("actions.signInOrSignUp")}
				</Button>
			</CardContent>
		</Card>
	);
};
