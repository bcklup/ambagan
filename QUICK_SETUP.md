# 🚀 Quick Setup Guide

## Phone Number + OTP Authentication 📱

Simple, fast, and perfect for bill-splitting apps! Now with international support, defaulting to Philippines 🇵🇭

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

## Step 5: Enable Phone Authentication

### Enable Phone Auth in Supabase:

1. In Supabase, go to **Authentication** → **Settings**
2. Scroll down to **Phone Auth**
3. Toggle **Enable phone confirmations** to ON
4. Choose an SMS provider (see next step)

### Configure SMS Provider:

**For Development/Testing** - Use Supabase's test provider:

1. In **Authentication** → **Settings** → **SMS Provider**
2. Select **Supabase Test Provider** (free for testing)
3. **Note**: Test provider only works with specific test numbers

**For Production** - Set up Twilio (recommended):

1. Create account at [twilio.com](https://twilio.com)
2. Get your **Account SID** and **Auth Token**
3. Buy a phone number ($1/month)
4. In Supabase, select **Twilio** as SMS provider
5. Enter your credentials
6. **Cost**: ~$0.0075 per SMS

## Step 6: Test the App!

1. Try the app - you should see a clean phone number form with country selector
2. **Default is set to Philippines 🇵🇭** (+63)
3. **Tap the country selector** to change to any other country
4. **Enter your phone number** (with your real number for testing)
5. **Tap "Send Verification Code"**
6. **Check your phone** for SMS (should arrive in seconds)
7. **Enter the 6-digit code**
8. **Verify & Sign In** - you should be logged into the app! 🎉

## How This Works:

✅ **Super simple**: Just phone number → OTP → logged in  
✅ **No passwords**: Nothing to remember or forget  
✅ **Mobile-first**: Perfect for a social bill-splitting app  
✅ **International support**: Works with any country 🌍  
✅ **Smart formatting**: Phone numbers format per country  
✅ **Philippines default**: Perfect for local users 🇵🇭

## Features:

### International Support:

- 🌍 **195+ countries** - Full international support
- 🇵🇭 **Philippines default** - Starts with +63 country code
- 🎨 **Country picker** - Beautiful flag selector with search
- 📱 **Smart formatting** - Numbers format per country (PH: 917 123 4567, US: (555) 123-4567)
- 🔄 **Auto-detection** - Handles various number formats

### Authentication Features:

- 🔢 **6-digit OTP input** - Large, easy-to-read code entry
- 📲 **Resend code** - If user doesn't receive SMS
- ↩️ **Change phone number** - Easy to go back and fix
- 🏷️ **Optional name** - Personalize the experience
- 🎨 **Beautiful UI** - Clean, focused interface

## Troubleshooting

### Setup Issues:

- **Button does nothing**: Check if `.env` file exists and has correct credentials
- **"Configuration Error"**: Make sure your Supabase URL and key are correct
- **Phone auth not enabled**: Make sure you enabled phone confirmations in Supabase

### SMS Issues:

- **Code not received**:
  - Check if phone number is correct
  - Try resending the code
  - Check if SMS provider is configured properly
  - Make sure country code is correct
- **Test provider not working**: Test provider only works with specific test numbers
- **Production SMS issues**: Check Twilio balance and phone number setup
- **International numbers**: Make sure your SMS provider supports the target country

### Code Issues:

- **"Invalid code"**: Make sure you entered all 6 digits correctly
- **Code expired**: Request a new code (they expire after 10 minutes)
- **Database error**: Make sure you ran the SQL schema

## Country-Specific Notes

### Philippines 🇵🇭 (Default):

- **Format**: 917 123 4567 or 0917 123 4567
- **Code**: +63
- **Mobile prefixes**: 9xx series (Globe, Smart, etc.)

### United States 🇺🇸:

- **Format**: (555) 123-4567
- **Code**: +1

### Others:

- **Generic formatting**: 123 456 7890
- **All country codes supported**

## Cost Breakdown

**Development**: FREE with test provider  
**Production**: ~$0.01 per user signup + Twilio phone number ($1/month)  
**International SMS**: Rates vary by country (~$0.01-0.05)

**Much cheaper than email services** and better user experience!

## Quick Test Flow

The app should work like this:

1. 📱 **Phone screen**: Clean form with country selector (🇵🇭 default) + phone number
2. 🌍 **Country selection**: Tap flag to change country, search supported
3. ✅ **Auto-formatting**: Phone formats per country as you type
4. 📲 **Send code**: Tap button → SMS sent in seconds
5. 🔢 **OTP screen**: Enter 6-digit code with large input
6. ✅ **Verify**: Automatic login on correct code
7. 🎯 **Main app**: Seamless redirect to dashboard

**Perfect for bill-splitting apps** - users can easily find friends by phone number! 🚀

## Next Steps

Once phone auth is working:

1. ✅ **Test with different countries** - Try US, PH, and others
2. 🎯 **Build your main app features**
3. 👥 **Use phone numbers for friend finding**
4. 📱 **Add contact sync later** (optional enhancement)

International support makes your app ready for global users! 🌍📱✨
