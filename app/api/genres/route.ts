import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getAvailableGenreSeeds } from "@/lib/spotify";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const genres = await getAvailableGenreSeeds(session.accessToken);
    return NextResponse.json({ genres }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch genre seeds", error);
    return NextResponse.json(
      { error: "Unable to load genre seeds from Spotify" },
      { status: 500 }
    );
  }
}

