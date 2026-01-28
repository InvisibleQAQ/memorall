import type {
	SignInCredentials,
	SignUpCredentials,
	AuthConfig,
	User,
	Session,
} from "./types";
import {
	getSupabaseClient,
	updateSupabaseConfig,
	clearSupabaseConfig,
	isSupabaseConfigured,
} from "../config/client";
import { logInfo, logError } from "@/utils/logger";

export class AuthService {
	/**
	 * Configure Supabase connection
	 */
	async configure(config: AuthConfig): Promise<void> {
		try {
			await updateSupabaseConfig(config.supabaseUrl, config.supabaseAnonKey);
			logInfo("Supabase configuration updated");
		} catch (error) {
			logError("Failed to configure Supabase:", error);
			throw error;
		}
	}

	/**
	 * Check if Supabase is configured
	 */
	async isConfigured(): Promise<boolean> {
		return await isSupabaseConfigured();
	}

	/**
	 * Clear Supabase configuration
	 */
	async clearConfig(): Promise<void> {
		try {
			await clearSupabaseConfig();
			logInfo("Supabase configuration cleared");
		} catch (error) {
			logError("Failed to clear Supabase config:", error);
			throw error;
		}
	}

	/**
	 * Sign in with email and password
	 */
	async signIn(credentials: SignInCredentials): Promise<{
		user: User | null;
		session: Session | null;
	}> {
		const client = await getSupabaseClient();
		if (!client) {
			throw new Error("Supabase is not configured. Please configure it first.");
		}

		const { data, error } = await client.auth.signInWithPassword({
			email: credentials.email,
			password: credentials.password,
		});

		if (error) {
			logError("Sign in failed:", error);
			throw error;
		}

		// Ensure only verified users can sign in
		const user = data.user as User | null;
		if (user && !user.email_confirmed_at) {
			// Immediately sign out any unverified session and block login
			try {
				await client.auth.signOut();
			} catch (signOutError) {
				logError(
					"Failed to sign out unverified user after sign in:",
					signOutError,
				);
			}
			throw new Error("Please verify your email before signing in.");
		}

		logInfo("User signed in successfully");
		return {
			user: data.user,
			session: data.session,
		};
	}

	/**
	 * Sign up with email and password
	 */
	async signUp(credentials: SignUpCredentials): Promise<{
		user: User | null;
		session: Session | null;
	}> {
		const client = await getSupabaseClient();
		if (!client) {
			throw new Error("Supabase is not configured. Please configure it first.");
		}

		const { data, error } = await client.auth.signUp({
			email: credentials.email,
			password: credentials.password,
			options: {
				data: credentials.metadata || {},
			},
		});

		if (error) {
			logError("Sign up failed:", error);
			throw error;
		}

		logInfo(
			"User signed up successfully; verification email sent if required.",
		);

		// After signup, do not keep the user logged in. Require explicit login after verification.
		try {
			await client.auth.signOut();
		} catch (signOutError) {
			logError("Failed to sign out after sign up:", signOutError);
		}
		return {
			user: data.user,
			// Ensure no active session is returned after signup
			session: null,
		};
	}

	/**
	 * Sign out current user
	 */
	async signOut(): Promise<void> {
		const client = await getSupabaseClient();
		if (!client) {
			return;
		}

		const { error } = await client.auth.signOut();

		if (error) {
			logError("Sign out failed:", error);
			throw error;
		}

		logInfo("User signed out successfully");
	}

	/**
	 * Get current session
	 */
	async getSession(): Promise<Session | null> {
		const client = await getSupabaseClient();
		if (!client) {
			return null;
		}

		const { data, error } = await client.auth.getSession();

		if (error) {
			logError("Failed to get session:", error);
			return null;
		}

		const session = data.session as Session | null;
		const user = session?.user as User | null | undefined;
		if (session && user && !user.email_confirmed_at) {
			// Guard against any existing unverified sessions
			try {
				await client.auth.signOut();
			} catch (signOutError) {
				logError(
					"Failed to sign out unverified user when getting session:",
					signOutError,
				);
			}
			return null;
		}

		return session;
	}

	/**
	 * Get current user
	 */
	async getUser(): Promise<User | null> {
		const client = await getSupabaseClient();
		if (!client) {
			return null;
		}

		const { data, error } = await client.auth.getUser();

		if (error) {
			logError("Failed to get user:", error);
			return null;
		}

		return data.user;
	}

	/**
	 * Refresh session
	 */
	async refreshSession(): Promise<Session | null> {
		const client = await getSupabaseClient();
		if (!client) {
			return null;
		}

		const { data, error } = await client.auth.refreshSession();

		if (error) {
			logError("Failed to refresh session:", error);
			return null;
		}

		return data.session;
	}

	/**
	 * Setup auth state listener
	 */
	async onAuthStateChange(
		callback: (user: User | null, session: Session | null) => void,
	): Promise<() => void> {
		const client = await getSupabaseClient();
		if (!client) {
			return () => {};
		}

		const {
			data: { subscription },
		} = client.auth.onAuthStateChange((_event, session) => {
			callback(session?.user || null, session);
		});

		return () => {
			subscription.unsubscribe();
		};
	}
}

// Export singleton instance
export const authService = new AuthService();
