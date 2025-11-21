import { DEFAULT_MOOD, MOOD_PRESETS, MoodKey, resolveMoodKey } from "@/lib/moods";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_BASE = "https://accounts.spotify.com";

const requiredEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export type SpotifyToken = {
  accessToken: string;
  accessTokenExpires: number;
  refreshToken: string;
  tokenType?: string;
  scope?: string;
  error?: string;
};

export type SimplifiedArtist = {
  id: string;
  name: string;
};

export type SimplifiedTrack = {
  id: string;
  name: string;
  uri: string;
  previewUrl: string | null;
  album: {
    id: string;
    name: string;
    image: string | null;
  };
  artists: SimplifiedArtist[];
  externalUrl?: string;
};

type SpotifyApiError = {
  error: {
    status: number;
    message: string;
  };
};

type SpotifyFetchError = Error & {
  status?: number;
};

const isSpotifyError = (payload: unknown): payload is SpotifyApiError => {
  return (
    typeof payload === "object" &&
    !!payload &&
    "error" in payload &&
    typeof (payload as SpotifyApiError).error?.status === "number"
  );
};

const basicAuthHeader = () => {
  const id = requiredEnv("SPOTIFY_CLIENT_ID");
  const secret = requiredEnv("SPOTIFY_CLIENT_SECRET");
  return Buffer.from(`${id}:${secret}`).toString("base64");
};

export const refreshAccessToken = async (
  token: SpotifyToken
): Promise<SpotifyToken> => {
  try {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/api/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuthHeader()}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      cache: "no-store",
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};

    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Failed to parse Spotify token response", text.substring(0, 200));
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }

    if (!response.ok) {
      const message = (data.error_description as string) ?? "Failed to refresh token";
      console.error("Spotify token refresh failed", message);
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }

    const expiresIn = Number(data.expires_in ?? 3600) * 1000;

    return {
      ...token,
      accessToken: String(data.access_token ?? token.accessToken),
      accessTokenExpires: Date.now() + expiresIn,
      refreshToken: String(data.refresh_token ?? token.refreshToken),
      tokenType: String(data.token_type ?? token.tokenType ?? "Bearer"),
      scope: String(data.scope ?? token.scope ?? ""),
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
};

const fetchSpotify = async <T>(
  url: string,
  accessToken: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await response.text();
  let payload: unknown = undefined;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      console.warn("Unable to parse Spotify response as JSON", error);
    }
  }

  if (!response.ok) {
    if (isSpotifyError(payload)) {
      const err = new Error(
        `Spotify API error ${payload.error.status}: ${payload.error.message}`
      ) as SpotifyFetchError;
      err.status = response.status;
      throw err;
    }
    const err = new Error(
      `Unexpected Spotify API response (${response.status} ${response.statusText})`
    ) as SpotifyFetchError;
    err.status = response.status;
    throw err;
  }

  return (payload ?? ({} as T)) as T;
};

type TopItemsResponse<T> = {
  items: T[];
};

type UserProfile = {
  id: string;
  display_name?: string;
};

type RecommendationsResponse = {
  tracks: Array<{
    id: string;
    name: string;
    preview_url: string | null;
    uri: string;
    external_urls: { spotify: string };
    artists: SimplifiedArtist[];
    album: {
      id: string;
      name: string;
      images: Array<{ url: string }>;
    };
  }>;
};

const firstImage = (images?: Array<{ url: string }>) =>
  images && images.length > 0 ? images[0].url : null;

export const formatTrack = (track: RecommendationsResponse["tracks"][number]): SimplifiedTrack => ({
  id: track.id,
  name: track.name,
  uri: track.uri,
  previewUrl: track.preview_url,
  album: {
    id: track.album.id,
    name: track.album.name,
    image: firstImage(track.album.images),
  },
  artists: track.artists,
  externalUrl: track.external_urls?.spotify,
});

const getPersonalSeeds = async (accessToken: string) => {
  try {
    const [artists, tracks] = await Promise.all([
      fetchSpotify<TopItemsResponse<{ id: string }>>(
        `${SPOTIFY_API_BASE}/me/top/artists?limit=3&time_range=medium_term`,
        accessToken
      ),
      fetchSpotify<TopItemsResponse<{ id: string }>>(
        `${SPOTIFY_API_BASE}/me/top/tracks?limit=2&time_range=medium_term`,
        accessToken
      ),
    ]);
    return {
      artistSeeds: artists.items.map((artist) => artist.id),
      trackSeeds: tracks.items.map((track) => track.id),
    };
  } catch (error) {
    console.warn("Unable to load personal seeds. Falling back to mood presets.", error);
    return {
      artistSeeds: [],
      trackSeeds: [],
    };
  }
};

const ensureSeeds = (
  mood: MoodKey,
  personalSeeds: Awaited<ReturnType<typeof getPersonalSeeds>>
) => {
  const moodPreset = MOOD_PRESETS[mood];
  const genres = moodPreset.seedGenres.slice(0, 5);
  const seedGenres = genres.length ? genres.join(",") : undefined;
  const seedArtists = personalSeeds.artistSeeds.slice(0, 2).join(",") || undefined;
  const seedTracks = personalSeeds.trackSeeds.slice(0, 2).join(",") || undefined;

  if (seedGenres || seedArtists || seedTracks) {
    return { seedGenres, seedArtists, seedTracks };
  }

  return {
    seedGenres: MOOD_PRESETS[DEFAULT_MOOD].seedGenres.slice(0, 5).join(","),
    seedArtists: undefined,
    seedTracks: undefined,
  };
};

export const getRecommendationsForMood = async (
  accessToken: string,
  moodParam?: string | null,
  customGenres?: string[]
): Promise<{ mood: MoodKey; tracks: SimplifiedTrack[] }> => {
  const mood = resolveMoodKey(moodParam);
  const preset = MOOD_PRESETS[mood];
  const personalSeeds = await getPersonalSeeds(accessToken);
  const seeds = ensureSeeds(mood, personalSeeds);

  const params = new URLSearchParams({
    limit: "12",
  });

  // Use custom genres if provided, otherwise use mood preset genres
  const genresToUse = customGenres && customGenres.length > 0
    ? customGenres.slice(0, 5).join(",")
    : seeds.seedGenres;

  if (genresToUse && genresToUse.length > 0) {
    params.set("seed_genres", genresToUse);
  }
  if (seeds.seedArtists && seeds.seedArtists.length > 0) {
    params.set("seed_artists", seeds.seedArtists);
  }
  if (seeds.seedTracks && seeds.seedTracks.length > 0) {
    params.set("seed_tracks", seeds.seedTracks);
  }

  Object.entries(preset.ranges).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, value.toString());
    }
  });

  try {
    const data = await fetchSpotify<RecommendationsResponse>(
      `${SPOTIFY_API_BASE}/recommendations?${params.toString()}`,
      accessToken
    );

    return {
      mood,
      tracks: data.tracks.map(formatTrack),
    };
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 && customGenres && customGenres.length > 0) {
      console.warn(
        "Custom genres produced no results. Falling back to mood preset.",
        customGenres
      );
      return getRecommendationsForMood(accessToken, moodParam, undefined);
    }
    throw error;
  }
};

export const getCurrentUserProfile = (accessToken: string) =>
  fetchSpotify<UserProfile>(`${SPOTIFY_API_BASE}/me`, accessToken);

// Hardcoded list of valid Spotify genre seeds (as of Nov 2024)
// The /recommendations/available-genre-seeds endpoint has been deprecated
const SPOTIFY_GENRE_SEEDS = [
  "acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal",
  "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop",
  "chicago-house", "children", "chill", "classical", "club", "comedy", "country",
  "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco",
  "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic",
  "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth",
  "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore",
  "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house",
  "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance",
  "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino",
  "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno",
  "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party",
  "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop",
  "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day",
  "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly",
  "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter",
  "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study",
  "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop",
  "turkish", "work-out", "world-music"
];

export const getAvailableGenreSeeds = async (accessToken: string): Promise<string[]> => {
  // Return the hardcoded list since the API endpoint has been deprecated
  return SPOTIFY_GENRE_SEEDS;
};

export const createPlaylistWithTracks = async (
  accessToken: string,
  options: {
    name: string;
    description?: string;
    trackUris: string[];
    isPublic?: boolean;
  }
) => {
  const profile = await getCurrentUserProfile(accessToken);
  const playlist = await fetchSpotify<{ id: string }>(
    `${SPOTIFY_API_BASE}/users/${profile.id}/playlists`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        name: options.name,
        description: options.description ?? "Generated with Moodwave",
        public: options.isPublic ?? false,
      }),
    }
  );

  if (options.trackUris.length) {
    await fetchSpotify(
      `${SPOTIFY_API_BASE}/playlists/${playlist.id}/tracks`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          uris: options.trackUris,
        }),
      }
    );
  }

  return playlist.id;
};

export const logoutSpotifyUrl = "https://accounts.spotify.com/en/logout";

