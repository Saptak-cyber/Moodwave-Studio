import { getServerSession } from "next-auth";

import MoodPlaylistClient from "@/components/mood-playlist-client";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-black text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:px-6 lg:px-0">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-[#121212] p-6 shadow-[0_20px_80px_-40px_rgba(0,0,0,0.9)] md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1db954] text-base font-black text-black">
              MW
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                Spotify Inspired
              </p>
              <h1 className="text-2xl font-semibold md:text-3xl">
                Moodwave Studio
          </h1>
            </div>
          </div>
          <div className="text-sm text-white/60">
            {session?.user?.name
              ? `Signed in as ${session.user.name}`
              : "Previewing as guest"}
        </div>
        </header>

        <MoodPlaylistClient />
        </div>
      </main>
  );
}
