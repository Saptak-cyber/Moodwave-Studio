## Moodwave · Spotify Mood Playlist Generator

Next.js 16 + NextAuth + Tailwind CSS app that recreates Spotify’s dark UI to build mood-based playlists. Users connect their Spotify account, pick a mood (happy, sad, chill, energetic, focus, romantic), and the app converts those moods into Spotify audio features (valence, energy, tempo, danceability). Recommendations are fetched through `/api/mood-playlist`, previews play inline, and users can save the generated playlist to their Spotify profile.

### Features
- **Secure Spotify auth** – Authorization Code flow via NextAuth with automatic token refresh and JWT storage.
- **Mood → audio mapping** – Central `lib/moods.ts` ties each mood to valence/energy/tempo ranges and default genres.
- **Server-backed API routes** – `/api/mood-playlist` for recommendations, `/api/save-playlist` for playlist creation; secrets stay server-side.
- **Spotify-inspired UI** – App Router, Tailwind v4, and Client Components for mood selectors, preview player, and playlist cards.
- **Preview player** – Plays 30-second samples via the `preview_url` without leaving the app.

### Prerequisites
1. Create a Spotify Developer application.
2. Add the redirect URI: `http://localhost:3000/api/auth/callback/spotify`.
3. Capture the Client ID + Client Secret.

### Environment variables
Create a `.env.local` and provide:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=any_long_random_string
NEXTAUTH_URL=http://localhost:3000
```

### Development
```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and click “Connect Spotify” to start generating playlists.

### Architecture
- `app/api/auth/[...nextauth]` – NextAuth route configured for Spotify, JWT strategy, and refresh tokens.
- `lib/spotify.ts` – Helper utilities for refreshing tokens, fetching recommendations, and saving playlists.
- `lib/moods.ts` – Mood presets and helpers shared by server and client.
- `components/mood-playlist-client.tsx` – Client component that manages mood selection, preview audio, and save/regenerate actions.

### Spotify scopes used
`user-read-email user-read-private user-top-read playlist-read-private playlist-modify-private playlist-modify-public user-library-read`
