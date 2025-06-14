# Ambagan - Bill Splitting Calculator Setup

## Prerequisites

- Node.js 18+ (update from your current v16.17.1)
- Expo CLI
- Supabase account

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL script from `supabase_schema.sql` in your Supabase SQL Editor
3. Enable Google OAuth provider in Supabase Dashboard:
   - Go to Authentication → Providers
   - Enable Google provider
   - Add your Google OAuth credentials

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://your-project-ref.supabase.co/auth/v1/callback`

### 5. Run the App

```bash
# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## App Features

### ✅ Implemented

- **Authentication**: Google OAuth sign-in
- **Dashboard**: Session list with create/join options
- **Profile Management**: User profile and payment methods
- **Responsive Design**: Light/dark mode support
- **Database Schema**: Complete Supabase schema with RLS policies

### 🚧 Next Steps (Not Yet Implemented)

- **QR Code Scanner**: Join sessions via QR code
- **Session Management**:
  - Members section
  - Orders section
  - Summary and payment calculation
- **Real-time Sync**: Live updates across devices
- **Payment Integration**: QR code generation for payments
- **Advanced Features**:
  - Custom split ratios
  - Receipt photo uploads
  - Payment tracking

## Database Schema

The app uses the following main tables:

- `sessions` - Potluck sessions
- `members` - Session participants
- `orders` - Items to be split
- `order_payers` - Who paid for each order
- `order_consumers` - Who will split each order

## Technologies Used

- **React Native** with Expo
- **TypeScript** for type safety
- **NativeWind** for styling (Tailwind CSS)
- **Supabase** for backend and authentication
- **Expo Router** for navigation

## Color Scheme

The app uses a custom color palette:

- **Primary**: #519e8a (teal)
- **Secondary**: #22333B (dark blue-gray)
- **Tertiary**: #5E503F (brown)
- **Success**: #22c55e (green)
- **Error**: #ef4444 (red)

Colors are defined in `tailwind.config.js` and support both light and dark modes.

## Project Structure

```
app/
├── (tabs)/           # Tab navigation screens
│   ├── index.tsx     # Dashboard/Sessions list
│   └── profile.tsx   # User profile
├── auth/
│   └── login.tsx     # Authentication screen
├── session/
│   └── [id].tsx      # Session details (placeholder)
├── _layout.tsx       # Root layout with auth logic
└── index.tsx         # App entry point

components/
├── ui/               # Reusable UI components
└── ...

lib/
└── supabase.ts       # Supabase client configuration
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Node.js Version

Update to Node.js 18+ to resolve version warnings:

```bash
# Using nvm
nvm install 18
nvm use 18
```

### Metro/Expo Issues

Clear cache and restart:

```bash
npx expo start --clear
```

### Database Connection

Verify your Supabase URL and anon key in `.env` file.
