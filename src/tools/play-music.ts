import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../services/spotify-client.js";

export function registerPlayMusicTool(server: McpServer, spotify: SpotifyClient): void {
  server.registerTool(
    "play_music",
    {
      title: "Play Music",
      description:
        "曲名、アーティスト名、ジャンルなどで検索して音楽を再生します。「ジャズをかけて」「〇〇の曲を再生して」のような指示に対応します。",
      inputSchema: z.object({
        query: z.string().describe("曲名、アーティスト名、ジャンル等の検索クエリ"),
      }),
    },
    async ({ query }) => {
      const tracks = await spotify.searchTracks(query, 10);

      if (tracks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `"${query}" に一致する曲が見つかりませんでした。`,
            },
          ],
        };
      }

      const uris = tracks.map((t) => t.uri);
      try {
        await spotify.startPlayback({ uris });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
          return {
            content: [{ type: "text" as const, text: "Spotifyアプリで何か曲を再生してからもう一度お試しください。アクティブなデバイスが見つかりません。" }],
          };
        }
        throw err;
      }

      const first = tracks[0];
      const artistNames = first.artists.map((a) => a.name).join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `"${first.name}" by ${artistNames} を再生中です（他${tracks.length - 1}曲もキューに追加）。`,
          },
        ],
      };
    }
  );
}
