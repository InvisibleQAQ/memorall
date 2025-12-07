# Supabase Module Documentation

Complete Supabase integration for Memorall, providing optional authentication and cloud sync capabilities.

## Documentation

- **[Quick Start](./quickstart.md)** - Get up and running in 5 minutes
- **[Setup Guide](./setup.md)** - Detailed configuration and setup instructions
- **[Implementation](./implementation.md)** - Architecture and usage documentation

## Quick Links

- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Module Source](../../src/modules/supabase/)

## Features

- ✅ Optional authentication (users can skip and use local mode)
- ✅ Email/password sign up and sign in
- ✅ Session persistence via Chrome storage
- ✅ Automatic token refresh
- ✅ Type-safe TypeScript implementation
- ✅ Zustand state management
- ✅ Pre-built UI components

## Getting Started

### For Developers

1. Read the [Quick Start](./quickstart.md) guide
2. Set up `.env` with your Supabase credentials
3. See [Implementation](./implementation.md) for usage examples

### For End Users

1. Navigate to `/auth` in the app
2. Configure Supabase or skip to use local mode
3. Sign up or sign in if using cloud sync

## Module Structure

```
src/modules/supabase/
├── config/          # Supabase client configuration
├── auth/            # Authentication module
│   ├── types.ts
│   ├── store.ts
│   ├── service.ts
│   ├── hooks.ts
│   └── components/
└── index.ts
```

## Usage Example

```typescript
import { useAuth, useAuthActions } from "@/modules/supabase";

function MyComponent() {
  const { user, isLoading } = useAuth();
  const { signOut } = useAuthActions();

  if (user) {
    return <div>Welcome {user.email}! <button onClick={signOut}>Sign Out</button></div>;
  }

  return <div>Not signed in</div>;
}
```
