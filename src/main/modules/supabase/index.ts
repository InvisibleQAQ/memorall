// Config
export {
	getSupabaseClient,
	updateSupabaseConfig,
	clearSupabaseConfig,
	isSupabaseConfigured,
} from "./config/client";

// Auth types
export type {
	AuthState,
	AuthConfig,
	SignInCredentials,
	SignUpCredentials,
	User,
	Session,
} from "./auth/types";

// Auth store
export { useAuthStore } from "./auth/store";

// Auth service
export { authService } from "./auth/service";

// Auth hooks
export { useAuth, useAuthActions, useAuthInit } from "./auth/hooks";

// Auth components
export { AuthStatus, AuthCard } from "./auth/components";
