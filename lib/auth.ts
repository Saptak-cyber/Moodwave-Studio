import type { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

import { refreshAccessToken, type SpotifyToken } from "@/lib/spotify";

const scopes = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-library-read",
].join(" ");

const authorizationUrl = `${"https://accounts.spotify.com/authorize"}?${new URLSearchParams(
  {
    scope: scopes,
  }
).toString()}`;

export const authOptions: NextAuthOptions = {
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID ?? "",
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET ?? "",
      authorization: authorizationUrl,
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + Number(account.expires_in ?? 0) * 1000,
          userId: account.providerAccountId,
        };
      }

      // Return previous token if the access token has not expired yet
      if (token.accessToken && typeof token.accessTokenExpires === "number") {
        if (Date.now() < token.accessTokenExpires) {
          return token;
        }
      }

      // Refresh token
      const updatedToken = await refreshAccessToken(token as SpotifyToken);
      return {
        ...token,
        ...updatedToken,
      };
    },
    async session({ session, token }) {
      session.user.id = String(token.userId ?? "");
      session.accessToken = String(token.accessToken ?? "");
      session.error = token.error;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
};

