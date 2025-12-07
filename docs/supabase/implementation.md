# Supabase Implementation

## Overview

Complete Supabase authentication implementation for Memorall, providing optional cloud sync capabilities while maintaining full local-only functionality.

## Architecture

### Module Structure

```
src/modules/supabase/
├── config/
│   └── client.ts                    # Supabase client configuration
├── auth/
│   ├── types.ts                     # TypeScript types
│   ├── store.ts                     # Zustand store for state management
│   ├── service.ts                   # Auth service (sign in/up/out)
│   ├── hooks.ts                     # React hooks (useAuth, useAuthActions, useAuthInit)
│   └── components/
│       ├── AuthStatus.tsx           # Auth status component
│       └── index.ts
├── index.ts                         # Public exports
└── README.md                        # Module documentation
```

### Pages

```
src/pages/
└── AuthPage.tsx                     # Full authentication UI
```

## Features

### ✅ Type-Safe
- Full TypeScript support
- Strict type checking
- Well-defined interfaces

### ✅ State Management
- Zustand store following existing codebase patterns
- Persistent session using Chrome storage API
- Automatic token refresh

### ✅ Optional Authentication
- Users can skip entirely and use local mode
- Works with or without Supabase configuration
- Non-intrusive integration

### ✅ Secure Storage
- Supabase config stored in Chrome local storage
- Session managed by Supabase client
- Follows Chrome extension best practices

## Usage

### Hooks

#### useAuth

Get current authentication state:

```typescript
import { useAuth } from "@/modules/supabase";

function MyComponent() {
  const { user, session, isLoading, isConfigured, isInitialized } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isConfigured) {
    return <div>Supabase not configured</div>;
  }

  if (!user) {
    return <div>Please sign in</div>;
  }

  return <div>Welcome, {user.email}!</div>;
}
```

#### useAuthActions

Perform authentication actions:

```typescript
import { useAuthActions } from "@/modules/supabase";

function LoginForm() {
  const { signIn, signUp, signOut, configure, error } = useAuthActions();

  const handleSignIn = async () => {
    try {
      await signIn({
        email: "user@example.com",
        password: "password123"
      });
    } catch (err) {
      console.error("Sign in failed:", err);
    }
  };

  return (
    <div>
      <button onClick={handleSignIn}>Sign In</button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

#### useAuthInit

Initialize authentication (automatically called in App.tsx):

```typescript
import { useAuthInit } from "@/modules/supabase";

function App() {
  // Initialize auth on app start
  useAuthInit();

  return <div>App content</div>;
}
```

### Components

#### AuthStatus

Pre-built component showing authentication status:

```typescript
import { AuthStatus } from "@/modules/supabase";

function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <AuthStatus />
    </div>
  );
}
```

### Service

Direct service usage (lower-level API):

```typescript
import { authService } from "@/modules/supabase";

// Configure Supabase
await authService.configure({
  supabaseUrl: "https://xxx.supabase.co",
  supabaseAnonKey: "eyJ..."
});

// Check configuration
const isConfigured = await authService.isConfigured();

// Sign in
const { user, session } = await authService.signIn({
  email: "user@example.com",
  password: "password123"
});

// Sign up
const { user, session } = await authService.signUp({
  email: "user@example.com",
  password: "password123",
  metadata: { displayName: "John Doe" }
});

// Sign out
await authService.signOut();

// Get current user
const user = await authService.getUser();

// Get current session
const session = await authService.getSession();

// Refresh session
const newSession = await authService.refreshSession();

// Listen to auth state changes
const unsubscribe = await authService.onAuthStateChange((user, session) => {
  console.log("Auth state changed:", user, session);
});
```

## Routes

### /auth

Authentication page with three modes:

1. **Configure Mode**: Enter Supabase URL and Anon Key
2. **Sign In Mode**: Email/password sign in
3. **Sign Up Mode**: Email/password registration

Features:
- Mode switching between configure/signin/signup
- Error handling with clear messages
- Success feedback
- Skip option for local-only mode
- Responsive design
- Loading states

## Storage

Uses Chrome's local storage API for:

### Configuration
- `supabaseUrl`: Supabase project URL
- `supabaseAnonKey`: Supabase anon public key

### Session
- Managed by Supabase client
- Automatic persistence and refresh
- Secure token storage

## State Management

### AuthStore (Zustand)

```typescript
interface AuthStore {
  // State
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConfigured: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setConfigured: (configured: boolean) => void;
  reset: () => void;
}
```

## Types

### Core Types

```typescript
interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  isConfigured: boolean;
}

interface AuthConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface SignInCredentials {
  email: string;
  password: string;
}

interface SignUpCredentials {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}
```

## Security

### Safe to Expose
- Supabase URL (public)
- Anon Key (public by design)

### Keep Secret
- Service Role Key (never expose in client)
- Database Password
- JWT Secret

### Best Practices
- Enable RLS (Row Level Security) on all tables
- Use email confirmation in production
- Configure rate limiting
- Implement proper auth policies

## Integration Example

### Adding to Settings Page

```typescript
import { AuthStatus } from "@/modules/supabase";

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1>Settings</h1>

      {/* Other settings */}

      {/* Auth section */}
      <section>
        <h2>Account</h2>
        <AuthStatus />
      </section>
    </div>
  );
};
```

### Protecting Routes

```typescript
import { useAuth } from "@/modules/supabase";
import { Navigate } from "react-router-dom";

function ProtectedPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <div>Protected content</div>;
}
```

### Syncing Data with Supabase

```typescript
import { useAuth } from "@/modules/supabase";
import { getSupabaseClient } from "@/modules/supabase";

function useSyncData() {
  const { user } = useAuth();

  const syncToSupabase = async (data: any) => {
    if (!user) return; // Skip if not authenticated

    const client = await getSupabaseClient();
    if (!client) return;

    const { error } = await client
      .from('user_data')
      .upsert({ user_id: user.id, ...data });

    if (error) {
      console.error("Sync failed:", error);
    }
  };

  return { syncToSupabase };
}
```

## Future Extensions

The module is structured to support:

### Database Module
```
src/modules/supabase/database/
├── types.ts
├── service.ts
└── hooks.ts
```

### Storage Module
```
src/modules/supabase/storage/
├── types.ts
├── service.ts
└── hooks.ts
```

### Realtime Module
```
src/modules/supabase/realtime/
├── types.ts
├── service.ts
└── hooks.ts
```

## Testing

### Manual Testing Checklist

- [ ] Configure Supabase via UI
- [ ] Configure Supabase via .env
- [ ] Sign up new user
- [ ] Sign in existing user
- [ ] Sign out
- [ ] Skip and use local mode
- [ ] Session persistence (refresh page)
- [ ] Auto token refresh
- [ ] Error handling
- [ ] Clear configuration

### Environment Variables Testing

```bash
# Test with env vars
VITE_SUPABASE_URL=https://xxx.supabase.co \
VITE_SUPABASE_ANON_KEY=eyJ... \
npm run dev

# Test without env vars (UI config)
npm run dev
```

## Troubleshooting

### Common Issues

**Issue**: "Supabase is not configured"
**Solution**: Add to `.env` or configure via `/auth` page

**Issue**: "Invalid API key"
**Solution**: Make sure you copied the **anon public** key, not service role key

**Issue**: Session not persisting
**Solution**: Check Chrome storage permissions

**Issue**: "Email not confirmed"
**Solution**: Disable email confirmation in Supabase dashboard for testing

## Dependencies

```json
{
  "@supabase/supabase-js": "latest"
}
```

Installed with `--legacy-peer-deps` due to existing peer dependency conflicts.

## Resources

- [Module README](../../../src/modules/supabase/README.md)
- [Setup Guide](./setup.md)
- [Quick Start](./quickstart.md)
- [Supabase Docs](https://supabase.com/docs)
