import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../services/spotify-client.js";
import { weatherToMood } from "../services/mood-mapper.js";

export function registerWeatherMusicTool(server: McpServer, spotify: SpotifyClient): void {
  server.registerTool(
    "weather_music",
    {
      title: "Play Weather Music",
      description:
        "天気に合った音楽を自動選曲して再生します。天気の状態（sunny, rainy, cloudy等）を指定してください。ユーザーのプレイリストから合うものを探し、なければSpotifyから検索します。",
      inputSchema: z.object({
        weather: z
          .string()
          .describe(
            "天気の状態: sunny, clear, cloudy, overcast, foggy, rainy, drizzle, snowy, stormy, thunderstorm, windy, hot, cold"
          ),
        temperature: z.number().optional().describe("気温（摂氏）。選曲の補助情報として使います"),
      }),
    },
    async ({ weather, temperature }) => {
      const mood = weatherToMood(weather, temperature);

      // Strategy A: ユーザーのプレイリストから天気に合うものを探す
      const playlists = await spotify.getMyPlaylists();
      let matchedPlaylist = null;
      let bestScore = 0;

      for (const playlist of playlists) {
        const name = playlist.name.toLowerCase();
        const desc = (playlist.description || "").toLowerCase();
        let score = 0;

        for (const term of mood.playlistSearchTerms) {
          if (name.includes(term)) score += 2;
          if (desc.includes(term)) score += 1;
        }

        if (score > bestScore) {
          bestScore = score;
          matchedPlaylist = playlist;
        }
      }

      const tempText = temperature !== undefined ? `${temperature}°C` : "";
      const weatherText = `${weather}${tempText ? ` (${tempText})` : ""}`;

      const noDeviceMsg = "Spotifyアプリで何か曲を再生してからもう一度お試しください。アクティブなデバイスが見つかりません。";

      if (matchedPlaylist && bestScore >= 2) {
        try {
          await spotify.startPlayback({ context_uri: matchedPlaylist.uri });
        } catch (err: unknown) {
          if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
            return { content: [{ type: "text" as const, text: noDeviceMsg }] };
          }
          throw err;
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `天気: ${weatherText}\nプレイリスト "${matchedPlaylist.name}" が天気にぴったりなので再生中です。`,
            },
          ],
        };
      }

      // Strategy B: Spotify検索でムードに合う曲を探す
      const searchQuery = [
        ...mood.keywords.slice(0, 2),
        ...mood.genres.slice(0, 1),
      ].join(" ");

      const tracks = await spotify.searchTracks(searchQuery, 20);

      if (tracks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `天気: ${weatherText}\n天気に合う曲が見つかりませんでした。"${searchQuery}" で検索しました。`,
            },
          ],
        };
      }

      const uris = tracks.map((t) => t.uri);
      try {
        await spotify.startPlayback({ uris });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
          return { content: [{ type: "text" as const, text: noDeviceMsg }] };
        }
        throw err;
      }

      const first = tracks[0];
      const artistNames = first.artists.map((a) => a.name).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `天気: ${weatherText}\n${weather}の気分に合わせて "${first.name}" by ${artistNames} など${tracks.length}曲を選曲しました。`,
          },
        ],
      };
    }
  );
}
