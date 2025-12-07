# Supabase Setup Guide

This guide will help you set up Supabase authentication for Memorall.

## Overview

Supabase authentication is **completely optional**. Users can:
- ✅ Configure Supabase to sync data across devices
- ✅ Skip and use local-only mode (no account needed)

## Setup Options

There are two ways to configure Supabase:

### Option 1: Environment Variables (For Developers)

This pre-configures Supabase for all users of your build.

#### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in project details:
   - **Name**: `memorall` (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
5. Click **"Create new project"**
6. Wait for the project to be provisioned (~2 minutes)

#### Step 2: Get Your Supabase Credentials

1. In your Supabase dashboard, click **"Settings"** (gear icon)
2. Click **"API"** in the sidebar
3. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

#### Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   CHROME_PATH=

   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Important**: Never commit `.env` to version control!

#### Step 4: Restart Development Server

```bash
npm run dev
```

Your app will now use Supabase automatically!

---

### Option 2: UI Configuration (For End Users)

This allows each user to configure their own Supabase instance.

#### Step 1: Users Create Their Own Supabase Project

Each user follows the same steps above to create their own project.

#### Step 2: Configure in the App

1. Open the app and navigate to `/auth`
2. Click **"Configure Supabase"**
3. Enter:
   - **Supabase URL**: Their project URL
   - **Anon Key**: Their anon public key
4. Click **"Configure"**
5. Now they can sign up or sign in

#### Step 3: Or Skip Entirely

Users can click **"Skip - Use Local Only"** to use the app without any account.

---

## Setting Up Authentication (Supabase Dashboard)

Once your Supabase project is created, configure authentication:

### Enable Email Authentication

1. In Supabase dashboard, go to **"Authentication"** → **"Providers"**
2. Make sure **"Email"** is enabled
3. Configure email settings:
   - **Enable email confirmations**: Recommended for production
   - **Disable** for testing to skip email verification

### (Optional) Configure Email Templates

1. Go to **"Authentication"** → **"Email Templates"**
2. Customize:
   - Confirmation email
   - Password reset email
   - Magic link email

### (Optional) Add OAuth Providers

You can also enable social login:

1. Go to **"Authentication"** → **"Providers"**
2. Enable providers like:
   - Google
   - GitHub
   - Discord
   - etc.
3. Follow Supabase docs for each provider's setup

---

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_SUPABASE_URL` | No | Your Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | No | Your Supabase anon public key | `eyJhbGciOiJIUzI1...` |

**Note**: If not set, users configure via UI.

---

## Security Best Practices

### ✅ Safe to Share
- **Supabase URL**: Public, safe to share
- **Anon Key**: Public, safe to share (it's called "anon" for a reason!)

### ❌ Never Share
- **Service Role Key**: Keep this secret! Never expose in client code
- **Database Password**: Keep this secret!
- **JWT Secret**: Keep this secret!

### For Production

1. **Enable RLS (Row Level Security)**:
   - Go to **"Database"** → **"Tables"**
   - Enable RLS on all tables
   - Create policies to restrict access

2. **Email Confirmations**:
   - Enable email confirmation for new signups
   - Prevents spam accounts

3. **Rate Limiting**:
   - Configure in **"Authentication"** → **"Rate Limits"**
   - Prevents brute force attacks

---

## Testing Your Setup

### Test Environment Variables

```bash
# Check if variables are loaded
npm run dev

# Open browser console and test
console.log(import.meta.env.VITE_SUPABASE_URL)
```

### Test Authentication

1. Navigate to `/auth`
2. Try signing up with a test email
3. Check Supabase dashboard → **"Authentication"** → **"Users"**
4. Your test user should appear

---

## Troubleshooting

### "Supabase is not configured"

- Check `.env` file exists and has correct values
- Restart dev server after adding variables
- Or configure via UI at `/auth`

### "Invalid API key"

- Double-check you copied the **anon public** key (not service role)
- Make sure no extra spaces or line breaks in `.env`

### "Email not confirmed"

- Disable email confirmation in Supabase dashboard for testing
- Or check spam folder for confirmation email
- Or check Supabase logs for email delivery

### "CORS Error"

- Should not happen with Supabase
- If it does, check your Supabase project URL is correct

---

## Example .env File

```env
# Chrome path for development
CHROME_PATH=

# Supabase Configuration (Optional)
# Get these from: https://app.supabase.com → Your Project → Settings → API
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxMDAwMDAwMCwiZXhwIjoxOTI1NTc2MDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
```

---

## Next Steps

After setup:

1. **Create Database Schema**: Design tables for your data
2. **Enable RLS**: Secure your tables with row-level security
3. **Sync Data**: Implement data sync in your app
4. **Add Storage**: Use Supabase storage for files
5. **Add Realtime**: Subscribe to database changes

Check `docs/supabase/implementation.md` for details.

---

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Dashboard](https://app.supabase.com)
