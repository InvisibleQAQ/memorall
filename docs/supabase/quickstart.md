# Supabase Quick Start

## 🚀 5-Minute Setup

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up
2. Click **"New Project"**
3. Enter project name, password, and region
4. Wait ~2 minutes for provisioning

### 2. Get Your Credentials

1. In Supabase dashboard → **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### 3. Configure Your App

**Option A: Environment Variables (Recommended for Developers)**

```bash
# Copy example file
cp .env.example .env

# Edit .env and add:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Restart dev server
npm run dev
```

**Option B: UI Configuration (For End Users)**

1. Open app and go to `/auth`
2. Click "Configure Supabase"
3. Paste URL and key
4. Done!

### 4. Test It

1. Navigate to `/auth`
2. Sign up with a test email
3. Check Supabase dashboard → Authentication → Users
4. Your user should appear!

---

## ⚙️ Optional: Disable Email Confirmation (for testing)

1. Supabase dashboard → **Authentication** → **Providers**
2. Click **Email** provider
3. Disable **"Confirm email"**
4. Save

Now you can test without checking emails!

---

## 📚 Full Documentation

- **Detailed Setup**: `docs/supabase/setup.md`
- **Implementation Guide**: `docs/supabase/implementation.md`
- **Module Usage**: `src/modules/supabase/README.md`

---

## 🎯 Example .env

```env
CHROME_PATH=

# Supabase (optional - or configure via UI)
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...
```

---

## ❓ Common Issues

**"Supabase is not configured"**
→ Add to `.env` or configure via `/auth` page

**"Invalid API key"**
→ Make sure you copied the **anon public** key, not service role key

**"Email not confirmed"**
→ Disable email confirmation in Supabase settings (for testing)

---

## ✨ Remember

- **Optional**: Users can skip and use local mode
- **Safe**: anon key is public, safe to share
- **Flexible**: Configure via `.env` OR UI

That's it! 🎉
