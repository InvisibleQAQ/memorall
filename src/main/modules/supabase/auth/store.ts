import { create } from "zustand";
import type { AuthState, User, Session } from "./types";

interface AuthStore extends AuthState {
	// Actions
	setUser: (user: User | null) => void;
	setSession: (session: Session | null) => void;
	setLoading: (loading: boolean) => void;
	setInitialized: (initialized: boolean) => void;
	setConfigured: (configured: boolean) => void;
	reset: () => void;
}

const initialState: AuthState = {
	user: null,
	session: null,
	isLoading: true,
	isInitialized: false,
	isConfigured: false,
};

export const useAuthStore = create<AuthStore>((set) => ({
	...initialState,

	setUser: (user) => set({ user }),

	setSession: (session) => set({ session }),

	setLoading: (isLoading) => set({ isLoading }),

	setInitialized: (isInitialized) => set({ isInitialized }),

	setConfigured: (isConfigured) => set({ isConfigured }),

	reset: () => set(initialState),
}));
