"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

import {
  DEFAULT_MOOD,
  MOOD_LIST,
  type MoodKey,
  type MoodPreset,
} from "@/lib/moods";
import type { SimplifiedTrack } from "@/lib/spotify";

type MoodResponse = {
  mood: MoodKey;
  tracks: SimplifiedTrack[];
};

const moodAccentClass = (preset: MoodPreset, isActive: boolean) =>
  isActive
    ? `border-white/80 bg-white/5`
    : `border-white/5 hover:border-white/20`;

const Spinner = () => (
  <span className="flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
);

export const MoodPlaylistClient = () => {
  const { data: session, status } = useSession();
  const [selectedMood, setSelectedMood] = useState<MoodKey>(DEFAULT_MOOD);
  const [tracks, setTracks] = useState<SimplifiedTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bootstrappedRef = useRef(false);

  const authenticated = status === "authenticated" && !!session?.accessToken;

  const loadPlaylist = useCallback(
    async (mood: MoodKey, showLoading = true) => {
      if (!authenticated) return;

      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await fetch(`/api/mood-playlist?mood=${mood}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Spotify rejected the request. Try again.");
        }

        const payload = (await response.json()) as MoodResponse;
        setTracks(payload.tracks);
        setPlayingTrackId(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "We could not refresh that playlist."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [authenticated]
  );

  useEffect(() => {
    if (!authenticated) {
      bootstrappedRef.current = false;
      setTracks([]);
      return;
    }

    const showSpinner = bootstrappedRef.current;
    bootstrappedRef.current = true;
    void loadPlaylist(selectedMood, showSpinner);
  }, [authenticated, loadPlaylist, selectedMood]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (!playingTrackId) {
      audioEl.pause();
      audioEl.currentTime = 0;
      return;
    }

    const nextTrack = tracks.find((track) => track.id === playingTrackId);

    if (!nextTrack?.previewUrl) {
      setPlayingTrackId(null);
      return;
    }

    audioEl.src = nextTrack.previewUrl;
    audioEl.currentTime = 0;

    audioEl
      .play()
      .catch(() => {
        setPlayingTrackId(null);
      });
  }, [playingTrackId, tracks]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const handleEnded = () => setPlayingTrackId(null);
    const handlePause = () => {
      if (audioEl.currentTime >= audioEl.duration - 0.25) {
        setPlayingTrackId(null);
      }
    };
    audioEl.addEventListener("ended", handleEnded);
    audioEl.addEventListener("pause", handlePause);
    return () => {
      audioEl.removeEventListener("ended", handleEnded);
      audioEl.removeEventListener("pause", handlePause);
    };
  }, []);

  const handleMoodSelect = (mood: MoodKey) => {
    setSelectedMood(mood);
  };

  const handleSavePlaylist = async () => {
    if (!authenticated || tracks.length === 0) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/save-playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood: selectedMood,
          name: `${MOOD_LIST.find((m) => m.key === selectedMood)?.label ?? "Mood"} Mix`,
          trackUris: tracks.map((track) => track.uri),
        }),
      });

      if (!response.ok) {
        throw new Error("Spotify could not create that playlist.");
      }

      const data = (await response.json()) as { playlistId: string };
      setSaveSuccess(
        `Playlist saved to Spotify${data.playlistId ? ` (#${data.playlistId.slice(-6)})` : ""}`
      );
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save playlist to Spotify."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewToggle = (trackId: string) => {
    setPlayingTrackId((current) => (current === trackId ? null : trackId));
  };

  const heroCta = useMemo(() => {
    if (authenticated) {
      return (
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-green-400"
        >
          Sign out
        </button>
      );
    }
    return (
      <button
        onClick={() => signIn("spotify")}
        className="rounded-full bg-[#1db954] px-6 py-3 text-sm font-semibold text-black transition hover:bg-white"
      >
        Connect Spotify
      </button>
    );
  }, [authenticated]);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-[#1ed760]/20 via-[#121212] to-[#0b090c] p-8 text-white shadow-[0_30px_120px_-40px_rgba(0,0,0,0.9)] lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">
            Moodwave
          </p>
          <h1 className="text-4xl font-bold md:text-5xl">
            Mood-based playlists that feel like Spotify made them.
          </h1>
          <p className="text-white/70">
            Choose a mood, let Spotify&apos;s audio features work their magic, and
            play 30-second previews without leaving the app.
          </p>
        </div>
        {heroCta}
      </div>

      <div className="rounded-3xl border border-white/5 bg-[#181818] p-6 shadow-2xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Choose your mood</h2>
            <p className="text-sm text-white/60">
              We transform mood into valence, energy, and tempo to ask Spotify for
              perfect matches.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => loadPlaylist(selectedMood)}
              disabled={!authenticated || isLoading}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLoading ? <Spinner /> : null}
              Regenerate
            </button>
            <button
              onClick={handleSavePlaylist}
              disabled={!authenticated || tracks.length === 0 || isSaving}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? <Spinner /> : null}
              Save to Spotify
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {MOOD_LIST.map((preset) => {
            const isActive = preset.key === selectedMood;
            return (
              <button
                key={preset.key}
                onClick={() => handleMoodSelect(preset.key)}
                className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${moodAccentClass(
                  preset,
                  isActive
                )} ${isActive ? "bg-gradient-to-br from-white/10 to-transparent" : ""}`}
              >
                <span className="text-xs uppercase tracking-widest text-white/60">
                  {preset.label}
                </span>
                <p className="text-sm text-white/80">{preset.description}</p>
              </button>
            );
          })}
        </div>

        {!authenticated ? (
          <div className="mt-10 rounded-2xl border border-dashed border-white/20 bg-black/30 p-6 text-center text-white/70">
            <p className="text-lg font-semibold">Connect Spotify to begin.</p>
            <p className="text-sm text-white/50">
              We use your top artists to seed each mood so it feels personal.
            </p>
            <button
              onClick={() => signIn("spotify")}
              className="mt-4 rounded-full bg-[#1db954] px-6 py-2 text-sm font-semibold text-black transition hover:bg-white"
            >
              Sign in with Spotify
            </button>
          </div>
        ) : (
          <div className="mt-10 space-y-4">
            {error ? (
              <div className="rounded-xl border border-red-400/30 bg-red-900/20 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            {saveSuccess ? (
              <div className="rounded-xl border border-green-400/30 bg-green-900/20 p-4 text-sm text-green-200">
                {saveSuccess}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {isLoading && tracks.length === 0 ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="animate-pulse rounded-2xl border border-white/5 bg-white/5 p-4"
                  >
                    <div className="h-40 rounded-xl bg-white/10" />
                  </div>
                ))
              ) : tracks.length ? (
                tracks.map((track) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    isPlaying={playingTrackId === track.id}
                    onToggle={() => handlePreviewToggle(track.id)}
                  />
                ))
              ) : (
                <p className="col-span-2 text-center text-white/60">
                  Select a mood to generate your first playlist.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
      <audio ref={audioRef} className="hidden" />
    </section>
  );
};

type TrackCardProps = {
  track: SimplifiedTrack;
  isPlaying: boolean;
  onToggle: () => void;
};

const TrackCard = ({ track, isPlaying, onToggle }: TrackCardProps) => {
  const canPreview = Boolean(track.previewUrl);

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-[#0f0f0f] p-4 shadow-xl transition hover:border-white/20">
      <div className="relative overflow-hidden rounded-2xl">
        {track.album.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.album.image}
            alt={track.album.name}
            className={`h-48 w-full rounded-2xl object-cover transition ${isPlaying ? "opacity-80" : ""}`}
          />
        ) : (
          <div className="flex h-48 items-center justify-center rounded-2xl bg-white/5 text-white/40">
            No artwork
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-sm">
          <div>
            <p className="font-semibold text-white">{track.name}</p>
            <p className="text-white/70">{track.artists.map((a) => a.name).join(", ")}</p>
          </div>
          <button
            onClick={onToggle}
            disabled={!canPreview}
            className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isPlaying ? "Pause" : "Preview"}
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/50">
        <span>{track.album.name}</span>
        <span>{track.previewUrl ? "30s preview" : "Preview unavailable"}</span>
      </div>
    </article>
  );
};

export default MoodPlaylistClient;

