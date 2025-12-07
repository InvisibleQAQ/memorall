/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly EXTENSION_PUBLIC_LLM_RUNNER_URL?: string;
	readonly EXTENSION_PUBLIC_SUPABASE_URL?: string;
	readonly EXTENSION_PUBLIC_SUPABASE_ANON_KEY?: string;
	readonly VITE_SUPABASE_URL?: string;
	readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
