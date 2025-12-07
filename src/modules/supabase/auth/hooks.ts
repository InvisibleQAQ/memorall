import { useEffect, useState } from "react";
import { useAuthStore } from "./store";
import { authService } from "./service";
import type { SignInCredentials, SignUpCredentials } from "./types";
import { logError } from "@/utils/logger";

/**
 * Hook to initialize authentication
 */
export const useAuthInit = () => {
	const { setUser, setSession, setLoading, setInitialized, setConfigured } =
		useAuthStore();

	useEffect(() => {
		let unsubscribe: (() => void) | null = null;

		const initAuth = async () => {
			try {
				setLoading(true);

				// Check if Supabase is configured
				const configured = await authService.isConfigured();
				setConfigured(configured);

				if (!configured) {
					setLoading(false);
					setInitialized(true);
					return;
				}

				// Get current session
				const session = await authService.getSession();
				if (session) {
					setSession(session);
					setUser(session.user);
				}

				// Setup auth state listener
				unsubscribe = await authService.onAuthStateChange((user, session) => {
					setUser(user);
					setSession(session);
				});

				setInitialized(true);
			} catch (error) {
				logError("Failed to initialize auth:", error);
			} finally {
				setLoading(false);
			}
		};

		initAuth();

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [setUser, setSession, setLoading, setInitialized, setConfigured]);
};

/**
 * Hook to get current auth state
 */
export const useAuth = () => {
	const store = useAuthStore();
	return store;
};

/**
 * Hook for authentication actions
 */
export const useAuthActions = () => {
	const { setUser, setSession, setLoading, reset, setConfigured } =
		useAuthStore();
	const [error, setError] = useState<string | null>(null);

	const signIn = async (credentials: SignInCredentials) => {
		try {
			setError(null);
			setLoading(true);
			const { user, session } = await authService.signIn(credentials);
			setUser(user);
			setSession(session);
			return { user, session };
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to sign in";
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const signUp = async (credentials: SignUpCredentials) => {
		try {
			setError(null);
			setLoading(true);
			const { user, session } = await authService.signUp(credentials);
			// Do not log the user in immediately after signup; they must verify email and then sign in.
			return { user, session };
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to sign up";
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const signOut = async () => {
		try {
			setError(null);
			setLoading(true);
			await authService.signOut();
			reset();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to sign out";
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const configure = async (config: { supabaseUrl: string; supabaseAnonKey: string }) => {
		try {
			setError(null);
			setLoading(true);
			await authService.configure(config);
			setConfigured(true);

			// After configuring, try to get session
			const session = await authService.getSession();
			if (session) {
				setSession(session);
				setUser(session.user);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to configure";
			setError(message);
			throw err;
		} finally {
			setLoading(false);
		}
	};

	const clearConfig = async () => {
		try {
			setError(null);
			await authService.clearConfig();
			reset();
			setConfigured(false);
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to clear config";
			setError(message);
			throw err;
		}
	};

	return {
		signIn,
		signUp,
		signOut,
		configure,
		clearConfig,
		error,
	};
};
