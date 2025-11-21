import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { createPlaylistWithTracks } from "@/lib/spotify";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const trackUris: string[] = Array.isArray(body.trackUris) ? body.trackUris : [];
  const playlistName: string =
    body.name ?? `Moodwave • ${new Date().toLocaleDateString()}`;
  const description: string =
    body.description ??
    `Custom playlist generated from the ${body.mood ?? "mood"} preset.`;

  if (trackUris.length === 0) {
    return NextResponse.json(
      { error: "No tracks provided to save." },
      { status: 400 }
    );
  }

  try {
    const playlistId = await createPlaylistWithTracks(session.accessToken, {
      name: playlistName,
      description,
      trackUris,
      isPublic: false,
    });
    return NextResponse.json({ playlistId }, { status: 201 });
  } catch (error) {
    console.error("Unable to save playlist", error);
    return NextResponse.json(
      { error: "Spotify playlist creation failed." },
      { status: 500 }
    );
  }
}

