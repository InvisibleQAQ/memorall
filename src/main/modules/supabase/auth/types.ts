import type { User, Session } from "@supabase/supabase-js";

export interface AuthState {
	user: User | null;
	session: Session | null;
	isLoading: boolean;
	isInitialized: boolean;
	isConfigured: boolean;
}

export interface AuthConfig {
	supabaseUrl: string;
	supabaseAnonKey: string;
}

export interface SignInCredentials {
	email: string;
	password: string;
}

export interface SignUpCredentials {
	email: string;
	password: string;
	metadata?: Record<string, unknown>;
}

export type { User, Session };
