export type MoodKey =
  | "happy"
  | "sad"
  | "energetic"
  | "chill"
  | "focus"
  | "romantic";

type NumericRange = {
  min_valence?: number;
  max_valence?: number;
  min_energy?: number;
  max_energy?: number;
  min_danceability?: number;
  max_danceability?: number;
  min_tempo?: number;
  max_tempo?: number;
};

export type MoodPreset = {
  key: MoodKey;
  label: string;
  description: string;
  accent: string;
  background: string;
  seedGenres: string[];
  ranges: NumericRange;
};

const clamp = (value?: number) =>
  value === undefined
    ? undefined
    : Math.min(1, Math.max(0, Number.parseFloat(value.toFixed(2))));

const preset = (
  key: MoodKey,
  presetConfig: Omit<MoodPreset, "key">
): MoodPreset => ({
  key,
  ...presetConfig,
  ranges: Object.fromEntries(
    Object.entries(presetConfig.ranges).map(([rangeKey, value]) => [
      rangeKey,
      rangeKey.includes("tempo") ? value : clamp(value),
    ])
  ) as NumericRange,
});

export const MOOD_PRESETS: Record<MoodKey, MoodPreset> = {
  happy: preset("happy", {
    label: "Happy",
    description: "Feel-good pop and upbeat vibes.",
    accent: "#1ed760",
    background: "from-[#1ed7601a] to-transparent",
    seedGenres: ["pop", "dance", "disco"],
    ranges: {
      min_valence: 0.7,
      min_energy: 0.6,
      min_danceability: 0.6,
      min_tempo: 100,
      max_tempo: 140,
    },
  }),
  sad: preset("sad", {
    label: "Melancholic",
    description: "Moody ballads for reflective moments.",
    accent: "#af52de",
    background: "from-[#af52de1a] to-transparent",
    seedGenres: ["acoustic", "indie", "soul"],
    ranges: {
      max_valence: 0.45,
      max_energy: 0.5,
      min_tempo: 60,
      max_tempo: 100,
    },
  }),
  energetic: preset("energetic", {
    label: "Energize",
    description: "High-octane anthems for workouts.",
    accent: "#f15e6c",
    background: "from-[#f15e6c1a] to-transparent",
    seedGenres: ["edm", "rock", "hip-hop"],
    ranges: {
      min_energy: 0.75,
      min_danceability: 0.55,
      min_tempo: 120,
      max_tempo: 170,
    },
  }),
  chill: preset("chill", {
    label: "Chill",
    description: "Lo-fi beats and late-night textures.",
    accent: "#70a1ff",
    background: "from-[#70a1ff1a] to-transparent",
    seedGenres: ["chill", "ambient", "electronic"],
    ranges: {
      max_energy: 0.55,
      max_danceability: 0.65,
      min_tempo: 70,
      max_tempo: 110,
    },
  }),
  focus: preset("focus", {
    label: "Focus",
    description: "Deep work with minimal distractions.",
    accent: "#ffd166",
    background: "from-[#ffd1661a] to-transparent",
    seedGenres: ["classical", "piano", "ambient"],
    ranges: {
      max_energy: 0.55,
      min_danceability: 0.3,
      max_danceability: 0.55,
      min_tempo: 60,
      max_tempo: 120,
    },
  }),
  romantic: preset("romantic", {
    label: "Romance",
    description: "Smooth R&B and candlelight pop.",
    accent: "#ff7eb3",
    background: "from-[#ff7eb31a] to-transparent",
    seedGenres: ["r-n-b", "soul", "pop"],
    ranges: {
      min_valence: 0.5,
      max_valence: 0.85,
      min_energy: 0.4,
      max_energy: 0.75,
      min_tempo: 70,
      max_tempo: 120,
    },
  }),
};

export const DEFAULT_MOOD: MoodKey = "happy";

export const MOOD_LIST = Object.values(MOOD_PRESETS);

export const resolveMoodKey = (value?: string | null): MoodKey => {
  if (!value) return DEFAULT_MOOD;
  const normalized = value.toLowerCase() as MoodKey;
  return normalized in MOOD_PRESETS ? normalized : DEFAULT_MOOD;
};

