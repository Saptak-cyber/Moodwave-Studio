import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getRecommendationsForMood } from "@/lib/spotify";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized" },
      {
        status: 401,
      }
    );
  }

  const { searchParams } = new URL(request.url);
  const mood = searchParams.get("mood");
  const genresParam = searchParams.get("genres");
  const customGenres = genresParam ? genresParam.split(",") : undefined;

  try {
    const data = await getRecommendationsForMood(session.accessToken, mood, customGenres);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch recommendations", error);
    return NextResponse.json(
      {
        error: "Unable to load recommendations from Spotify",
      },
      { status: 500 }
    );
  }
}

