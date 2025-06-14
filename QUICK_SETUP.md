# 🚀 Quick Setup Guide

## Problem: "Continue with Google" Not Working

The app needs Supabase configuration to enable authentication. Here's how to fix it:

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new project
4. Wait for it to initialize (~2 minutes)

## Step 2: Get Your Credentials

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 3: Create .env File

Create a file called `.env` in your project root with:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace the values with your actual credentials from Step 2.

## Step 4: Set Up Database

1. In Supabase, go to **SQL Editor**
2. Copy the contents of `supabase_schema.sql`
3. Paste and run it

## Step 5: Enable Google OAuth

1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and toggle it on
3. You'll need Google OAuth credentials:

### Google Setup (Fixed for Expo Go):

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **Google+ API** (or **Google Identity API**)
4. Go to **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
5. **Important**: Choose **Web application** (not mobile)
6. Add **both** redirect URIs:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   https://auth.expo.io/@your-username/ambagan
   ```
   - Replace `your-project-ref` with your Supabase project reference
   - Replace `your-username` with your Expo username (check your Expo account)
7. Copy **Client ID** and **Client Secret**
8. Paste them in Supabase Google provider settings

### Supabase OAuth Settings:

In your Supabase **Authentication** → **URL Configuration**:

- **Site URL**: `https://auth.expo.io/@your-username/ambagan`
- **Redirect URLs**: Add this line:
  ```
  https://auth.expo.io/@your-username/ambagan
  ```

## Step 6: Find Your Expo Username

Run this command to see your Expo username:

```bash
npx expo whoami
```

Or check your Expo account at [expo.dev](https://expo.dev)

## Step 7: Test

1. Try "Continue with Google" again
2. Check console logs for "Generated redirect URI" to see the exact URI being used
3. Make sure that URI is added to your Google OAuth settings
4. Should now work! 🎉

## How This Works Now:

✅ **Expo Go compatible**: Uses Expo's auth proxy service  
✅ **Proper redirect handling**: Redirects back to your app correctly  
✅ **Token parsing**: Extracts auth tokens from the callback URL  
✅ **Automatic session**: Sets up Supabase session automatically

## Troubleshooting

- **"localhost" error**: Make sure you're using the Expo auth proxy URL, not localhost
- **Redirect URI mismatch**: Check that the logged redirect URI matches what's in Google OAuth
- **Button does nothing**: Check if `.env` file exists and has correct credentials
- **OAuth error**: Make sure both redirect URIs are added to Google OAuth settings
- **Database error**: Make sure you ran the SQL schema
- **Still having issues**: Check console logs for the exact redirect URI being generated

## Quick Test

After setup, the "Continue with Google" button should:

1. Open Google sign-in in a browser
2. ✅ **Sign in with your Google account**
3. ✅ **Redirect to https://auth.expo.io/... URL**
4. ✅ **Return to Expo Go automatically**
5. Show "Session established successfully!" in console
6. Navigate to the main app

**Key fix**: Using Expo's auth proxy service instead of localhost!
