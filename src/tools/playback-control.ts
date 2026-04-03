import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../services/spotify-client.js";

export function registerPlaybackTools(server: McpServer, spotify: SpotifyClient): void {
  server.registerTool(
    "control_playback",
    {
      title: "Control Playback",
      description:
        "音楽の再生を制御します。一時停止、再開、次の曲、前の曲の操作ができます。",
      inputSchema: z.object({
        action: z
          .enum(["pause", "resume", "next", "previous"])
          .describe("実行するアクション: pause(一時停止), resume(再開), next(次の曲), previous(前の曲)"),
      }),
    },
    async ({ action }) => {
      switch (action) {
        case "pause":
          await spotify.pausePlayback();
          return { content: [{ type: "text" as const, text: "一時停止しました。" }] };
        case "resume":
          await spotify.resumePlayback();
          return { content: [{ type: "text" as const, text: "再生を再開しました。" }] };
        case "next":
          await spotify.skipToNext();
          return { content: [{ type: "text" as const, text: "次の曲にスキップしました。" }] };
        case "previous":
          await spotify.skipToPrevious();
          return { content: [{ type: "text" as const, text: "前の曲に戻りました。" }] };
      }
    }
  );

  server.registerTool(
    "now_playing",
    {
      title: "Now Playing",
      description:
        "現在再生中の曲の情報を表示します。曲名、アーティスト、アルバム、再生デバイスなどがわかります。",
      inputSchema: z.object({}),
    },
    async () => {
      const state = await spotify.getCurrentPlayback();

      if (!state || !state.item) {
        return {
          content: [{ type: "text" as const, text: "現在再生中の曲はありません。" }],
        };
      }

      const track = state.item;
      const artists = track.artists.map((a) => a.name).join(", ");
      const progress = state.progress_ms
        ? formatTime(state.progress_ms)
        : "0:00";
      const duration = formatTime(track.duration_ms);
      const device = state.device
        ? `${state.device.name} (${state.device.type})`
        : "Unknown";

      const status = state.is_playing ? "再生中" : "一時停止中";

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `${status}`,
              `曲名: ${track.name}`,
              `アーティスト: ${artists}`,
              `アルバム: ${track.album.name}`,
              `再生位置: ${progress} / ${duration}`,
              `デバイス: ${device}`,
            ].join("\n"),
          },
        ],
      };
    }
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
