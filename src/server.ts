import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SpotifyClient } from "./services/spotify-client.js";
import { weatherToMood } from "./services/mood-mapper.js";

const server = new McpServer({
  name: "spotify-weather",
  version: "1.0.0",
});

const spotify = new SpotifyClient();

const NO_DEVICE_MSG =
  "Spotifyアプリで何か曲を再生してからもう一度お試しください。アクティブなデバイスが見つかりません。";

// --- get_my_playlists ---
server.tool(
  "get_my_playlists",
  "ユーザーのSpotifyプレイリスト一覧を取得します。プレイリスト名を確認したい時や、何を聴くか選びたい時に使います。",
  {},
  async () => {
    const playlists = await spotify.getMyPlaylists();
    const list = playlists
      .map((p, i) => `${i + 1}. ${p.name} (${p.tracks?.total ?? 0} tracks)`)
      .join("\n");
    return { content: [{ type: "text", text: list || "プレイリストが見つかりませんでした。" }] };
  }
);

// --- play_playlist ---
server.tool(
  "play_playlist",
  "指定した名前のプレイリストを再生します。プレイリスト名の一部だけでも検索できます。シャッフル再生も可能です。",
  {
    playlist_name: z.string().describe("再生したいプレイリストの名前（部分一致OK）"),
    shuffle: z.boolean().optional().describe("シャッフル再生するかどうか"),
  },
  async ({ playlist_name, shuffle }) => {
    const playlists = await spotify.getMyPlaylists();
    const query = playlist_name.toLowerCase();
    const match = playlists.find((p) => p.name.toLowerCase().includes(query));

    if (!match) {
      const names = playlists.map((p) => p.name).join(", ");
      return {
        content: [{ type: "text", text: `"${playlist_name}" に一致するプレイリストが見つかりませんでした。\n利用可能: ${names}` }],
      };
    }

    try {
      if (shuffle) await spotify.setShuffle(true);
      await spotify.startPlayback({ context_uri: match.uri });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
        return { content: [{ type: "text", text: NO_DEVICE_MSG }] };
      }
      throw err;
    }

    return {
      content: [{ type: "text", text: `"${match.name}" を${shuffle ? "シャッフル" : ""}再生中です。` }],
    };
  }
);

// --- play_music ---
server.tool(
  "play_music",
  "曲名、アーティスト名、ジャンルなどで検索して音楽を再生します。「ジャズをかけて」「〇〇の曲を再生して」のような指示に対応します。",
  {
    query: z.string().describe("曲名、アーティスト名、ジャンル等の検索クエリ"),
  },
  async ({ query }) => {
    const tracks = await spotify.searchTracks(query, 10);

    if (tracks.length === 0) {
      return { content: [{ type: "text", text: `"${query}" に一致する曲が見つかりませんでした。` }] };
    }

    const uris = tracks.map((t) => t.uri);
    try {
      await spotify.startPlayback({ uris });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
        return { content: [{ type: "text", text: NO_DEVICE_MSG }] };
      }
      throw err;
    }

    const first = tracks[0];
    const artistNames = first.artists.map((a) => a.name).join(", ");
    return {
      content: [{ type: "text", text: `"${first.name}" by ${artistNames} を再生中です（他${tracks.length - 1}曲もキューに追加）。` }],
    };
  }
);

// --- weather_music ---
server.tool(
  "weather_music",
  "天気に合った音楽を自動選曲して再生します。天気の状態（sunny, rainy, cloudy等）を指定してください。ユーザーのプレイリストから合うものを探し、なければSpotifyから検索します。",
  {
    weather: z.string().describe("天気の状態: sunny, clear, cloudy, overcast, foggy, rainy, drizzle, snowy, stormy, thunderstorm, windy, hot, cold"),
    temperature: z.number().optional().describe("気温（摂氏）。選曲の補助情報として使います"),
  },
  async ({ weather, temperature }) => {
    const mood = weatherToMood(weather, temperature);

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

    if (matchedPlaylist && bestScore >= 2) {
      try {
        await spotify.startPlayback({ context_uri: matchedPlaylist.uri });
      } catch (err: unknown) {
        if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
          return { content: [{ type: "text", text: NO_DEVICE_MSG }] };
        }
        throw err;
      }
      return {
        content: [{ type: "text", text: `天気: ${weatherText}\nプレイリスト "${matchedPlaylist.name}" が天気にぴったりなので再生中です。` }],
      };
    }

    const searchQuery = [...mood.keywords.slice(0, 2), ...mood.genres.slice(0, 1)].join(" ");
    const tracks = await spotify.searchTracks(searchQuery, 20);

    if (tracks.length === 0) {
      return {
        content: [{ type: "text", text: `天気: ${weatherText}\n天気に合う曲が見つかりませんでした。` }],
      };
    }

    const uris = tracks.map((t) => t.uri);
    try {
      await spotify.startPlayback({ uris });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NO_ACTIVE_DEVICE") {
        return { content: [{ type: "text", text: NO_DEVICE_MSG }] };
      }
      throw err;
    }

    const first = tracks[0];
    const artistNames = first.artists.map((a) => a.name).join(", ");
    return {
      content: [{ type: "text", text: `天気: ${weatherText}\n${weather}の気分に合わせて "${first.name}" by ${artistNames} など${tracks.length}曲を選曲しました。` }],
    };
  }
);

// --- control_playback ---
server.tool(
  "control_playback",
  "音楽の再生を制御します。一時停止、再開、次の曲、前の曲の操作ができます。",
  {
    action: z.enum(["pause", "resume", "next", "previous"]).describe("実行するアクション: pause(一時停止), resume(再開), next(次の曲), previous(前の曲)"),
  },
  async ({ action }) => {
    switch (action) {
      case "pause":
        await spotify.pausePlayback();
        return { content: [{ type: "text", text: "一時停止しました。" }] };
      case "resume":
        await spotify.resumePlayback();
        return { content: [{ type: "text", text: "再生を再開しました。" }] };
      case "next":
        await spotify.skipToNext();
        return { content: [{ type: "text", text: "次の曲にスキップしました。" }] };
      case "previous":
        await spotify.skipToPrevious();
        return { content: [{ type: "text", text: "前の曲に戻りました。" }] };
    }
  }
);

// --- now_playing ---
server.tool(
  "now_playing",
  "現在再生中の曲の情報を表示します。曲名、アーティスト、アルバム、再生デバイスなどがわかります。",
  {},
  async () => {
    const state = await spotify.getCurrentPlayback();

    if (!state || !state.item) {
      return { content: [{ type: "text", text: "現在再生中の曲はありません。" }] };
    }

    const track = state.item;
    const artists = track.artists.map((a) => a.name).join(", ");
    const totalSec = Math.floor(track.duration_ms / 1000);
    const dur = `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, "0")}`;
    const progSec = Math.floor((state.progress_ms ?? 0) / 1000);
    const prog = `${Math.floor(progSec / 60)}:${(progSec % 60).toString().padStart(2, "0")}`;
    const device = state.device ? `${state.device.name} (${state.device.type})` : "Unknown";
    const status = state.is_playing ? "再生中" : "一時停止中";

    return {
      content: [{
        type: "text",
        text: `${status}\n曲名: ${track.name}\nアーティスト: ${artists}\nアルバム: ${track.album.name}\n再生位置: ${prog} / ${dur}\nデバイス: ${device}`,
      }],
    };
  }
);

await server.connect(new StdioServerTransport());
console.error("Spotify Weather MCP server is running.");
