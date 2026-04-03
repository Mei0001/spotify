import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../services/spotify-client.js";

export function registerPlaylistTools(server: McpServer, spotify: SpotifyClient): void {
  server.registerTool(
    "get_my_playlists",
    {
      title: "Get My Playlists",
      description:
        "ユーザーのSpotifyプレイリスト一覧を取得します。プレイリスト名を確認したい時や、何を聴くか選びたい時に使います。",
      inputSchema: z.object({}),
    },
    async () => {
      const playlists = await spotify.getMyPlaylists();
      const list = playlists
        .map((p, i) => `${i + 1}. ${p.name} (${p.tracks?.total ?? 0} tracks)`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: list || "No playlists found.",
          },
        ],
      };
    }
  );

  server.registerTool(
    "play_playlist",
    {
      title: "Play Playlist",
      description:
        "指定した名前のプレイリストを再生します。プレイリスト名の一部だけでも検索できます。シャッフル再生も可能です。",
      inputSchema: z.object({
        playlist_name: z.string().describe("再生したいプレイリストの名前（部分一致OK）"),
        shuffle: z.boolean().optional().describe("シャッフル再生するかどうか"),
      }),
    },
    async ({ playlist_name, shuffle }) => {
      const playlists = await spotify.getMyPlaylists();
      const query = playlist_name.toLowerCase();
      const match = playlists.find((p) =>
        p.name.toLowerCase().includes(query)
      );

      if (!match) {
        const names = playlists.map((p) => p.name).join(", ");
        return {
          content: [
            {
              type: "text" as const,
              text: `"${playlist_name}" に一致するプレイリストが見つかりませんでした。\n利用可能: ${names}`,
            },
          ],
        };
      }

      try {
        if (shuffle) {
          await spotify.setShuffle(true);
        }
        await spotify.startPlayback({ context_uri: match.uri });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
          return {
            content: [{ type: "text" as const, text: "Spotifyアプリで何か曲を再生してからもう一度お試しください。アクティブなデバイスが見つかりません。" }],
          };
        }
        throw err;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `"${match.name}" を${shuffle ? "シャッフル" : ""}再生中です。`,
          },
        ],
      };
    }
  );
}
