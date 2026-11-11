

https://github.com/user-attachments/assets/69c21825-52ca-4ac0-b62e-3af16f933599

# Meshidoko (メシどこ)

Meshidoko is a web app for finding nearby restaurants by swiping cards left or right. Place data comes from Google Places, and restaurants you like can be saved to a Google account.

You can start swiping without signing in. After the free daily swipes run out, signing in lets you open the places you saved in your collection. This app does not store a password.

## Tech stack

- Node.js 22
- TypeScript 5
- Next.js 15 (App Router and Route Handlers)
- React 19
- Tailwind CSS 4
- Supabase (Google sign-in and Postgres)
- Google Places API (New)
- Leaflet (map for choosing a place)
- Zod (request validation)
- Vitest (tests)
- Vercel (hosting)

## Features

- Show restaurant cards near your current location, or near a point you pick on the map
- Swipe right to save a place, swipe left to skip it
- Allow 10 swipes per day, in Japan time, without signing in
- Save right-swipes to a collection after Google sign-in
- Filter places by themes such as budget and mood
- Show photos, ratings, and opening hours on the card and in the details
- Publish a how-to page, privacy policy, terms, and a feedback form
- Give the operator an admin screen for headcount and place-card checks

## How to use

1. Open the site and allow location access. If you deny it, pick a place on the map.
2. Swipe a card right to keep it, or left to skip it.
3. Without an account, swiping stops for the day after 10 free swipes. The count resets at midnight in Japan time.
4. Sign in with Google to keep right-swiped places in your collection.
5. Use the bottom navigation to open the collection, themes, and settings.
6. From settings, open the how-to page (`/lp`), the privacy policy, and the terms.

## Setup

```bash
# Clone the repository
git clone https://github.com/nobu0903/tinder-googlemap.git
cd tinder-googlemap

# Install dependencies
npm install

# Create the env file
cp .env.local.example .env.local
```

Fill `.env.local` with values from your own project. Do not commit those values.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_PLACES_API_KEY`

In the Supabase SQL Editor, run `src/lib/supabase/schema.sql` first. Then run these files, which are not included in that schema:

```bash
src/lib/supabase/migrations/003_add_booking_fields.sql
src/lib/supabase/migrations/009_admin_passkeys.sql
src/lib/supabase/migrations/010_guest_swipe_days.sql
```

In Supabase Authentication, enable the Google provider and add `http://localhost:3000/auth/confirm` as a redirect URL.

```bash
# Start the dev server
npm run dev
```

Open `http://localhost:3000` in a browser.

```bash
# Tests
npm test

# Production build
npm run build
npm start
```

## Directory layout

```bash
tinder-googlemap/
├── public/                          # Public images and ads.txt
├── src/
│   ├── app/                         # Pages and API routes
│   │   ├── page.tsx                 # Swipe screen (home)
│   │   ├── collection/              # Saved places
│   │   ├── explore/                 # Places by theme
│   │   ├── settings/                # Settings, sign-in, remaining swipes
│   │   ├── lp/                      # How to use the app
│   │   ├── privacy/                 # Privacy policy
│   │   ├── terms/                   # Terms of use
│   │   ├── feedback/                # Feedback form
│   │   └── api/                     # Route Handlers for swipe, photos, collection
│   ├── components/                  # UI pieces
│   │   ├── swipe/                   # Cards and swipe gestures
│   │   ├── collection/
│   │   ├── explore/
│   │   ├── auth/
│   │   └── admin/                   # Operator screen
│   └── lib/
│       ├── feed/                    # Card ordering
│       ├── places/                  # Google Places fetch and cache
│       ├── supabase/                # Database schema and client
│       ├── admin/                   # Admin authorization
│       └── hooks/                   # Location, sign-in, and swipe quota
├── package.json
├── next.config.ts
└── vercel.json
```
