import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/popup/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/popup/components/ui/card";
import { useAuth, useAuthActions } from "../hooks";
import { LogIn, LogOut, User as UserIcon, Settings } from "lucide-react";

export const AuthStatus: React.FC = () => {
	const navigate = useNavigate();
	const { user, isConfigured, isLoading } = useAuth();
	const { signOut } = useAuthActions();

	const handleSignOut = async () => {
		try {
			await signOut();
		} catch (error) {
			console.error("Sign out failed:", error);
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Supabase Authentication</CardTitle>
					<CardDescription>Loading...</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	if (!isConfigured) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Supabase Authentication</CardTitle>
					<CardDescription>
						Configure Supabase to sync your data across devices
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						onClick={() => navigate("/auth")}
						className="w-full"
						variant="outline"
					>
						<Settings className="mr-2 h-4 w-4" />
						Configure Supabase
					</Button>
				</CardContent>
			</Card>
		);
	}

	if (!user) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Supabase Authentication</CardTitle>
					<CardDescription>Sign in to sync your data</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						onClick={() => navigate("/auth")}
						className="w-full"
						variant="outline"
					>
						<LogIn className="mr-2 h-4 w-4" />
						Sign In
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Supabase Authentication</CardTitle>
				<CardDescription>You are signed in</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-2 p-2 bg-muted rounded-md">
					<UserIcon className="h-4 w-4" />
					<span className="text-sm truncate">{user.email}</span>
				</div>
				<Button onClick={handleSignOut} className="w-full" variant="outline">
					<LogOut className="mr-2 h-4 w-4" />
					Sign Out
				</Button>
			</CardContent>
		</Card>
	);
};
