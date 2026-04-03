import { loadTokens, saveTokens, isExpired, type TokenData } from "./token-store.js";

const API_BASE = "https://api.spotify.com/v1";

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  tracks: { total: number };
  uri: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { name: string }[];
  album: { name: string };
  duration_ms: number;
}

export interface PlaybackState {
  is_playing: boolean;
  item: SpotifyTrack | null;
  device: { name: string; type: string } | null;
  progress_ms: number | null;
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

export class SpotifyClient {
  private tokens: TokenData | null;

  constructor() {
    this.tokens = loadTokens();
  }

  private async ensureAuth(): Promise<string> {
    if (!this.tokens) {
      throw new Error(
        "Not authenticated. Run 'npm run auth' with SPOTIFY_CLIENT_ID set to authorize."
      );
    }

    if (isExpired(this.tokens)) {
      await this.refreshToken();
    }

    return this.tokens.access_token;
  }

  private async refreshToken(): Promise<void> {
    if (!this.tokens) throw new Error("No tokens to refresh");

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refresh_token,
        client_id: this.tokens.client_id,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token refresh failed: ${res.status} ${body}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    this.tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? this.tokens.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      client_id: this.tokens.client_id,
    };
    saveTokens(this.tokens);
  }

  private async apiRequest<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const token = await this.ensureAuth();
    const url = `${API_BASE}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") || "1", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      return this.apiRequest(method, path, body);
    }

    if (res.status === 401) {
      await this.refreshToken();
      return this.apiRequest(method, path, body);
    }

    if (res.status === 204) return undefined as T;

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Spotify API error: ${res.status} ${path} ${errBody}`);
    }

    return res.json() as T;
  }

  async getMyPlaylists(limit = 50): Promise<SpotifyPlaylist[]> {
    const data = await this.apiRequest<{ items: SpotifyPlaylist[] }>(
      "GET",
      `/me/playlists?limit=${limit}`
    );
    return data.items;
  }

  async getPlaylistTracks(
    playlistId: string,
    limit = 100
  ): Promise<{ track: SpotifyTrack }[]> {
    const data = await this.apiRequest<{ items: { track: SpotifyTrack }[] }>(
      "GET",
      `/playlists/${playlistId}/tracks?limit=${limit}`
    );
    return data.items;
  }

  async searchTracks(query: string, limit = 20): Promise<SpotifyTrack[]> {
    const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
    const data = await this.apiRequest<{ tracks: { items: SpotifyTrack[] } }>(
      "GET",
      `/search?${params}`
    );
    return data.tracks.items;
  }

  async ensureActiveDevice(): Promise<string | null> {
    const devices = await this.getDevices();
    const active = devices.find((d) => d.is_active);
    if (active) return active.id;
    if (devices.length > 0) return devices[0].id;
    return null;
  }

  async startPlayback(options: {
    uris?: string[];
    context_uri?: string;
    device_id?: string;
  }): Promise<void> {
    let deviceId = options.device_id;
    if (!deviceId) {
      deviceId = (await this.ensureActiveDevice()) ?? undefined;
    }
    if (!deviceId) {
      throw new Error("NO_ACTIVE_DEVICE");
    }
    const params = `?device_id=${deviceId}`;
    const body: Record<string, unknown> = {};
    if (options.uris) body.uris = options.uris;
    if (options.context_uri) body.context_uri = options.context_uri;
    await this.apiRequest("PUT", `/me/player/play${params}`, body);
  }

  async pausePlayback(): Promise<void> {
    await this.apiRequest("PUT", "/me/player/pause");
  }

  async resumePlayback(): Promise<void> {
    await this.apiRequest("PUT", "/me/player/play");
  }

  async skipToNext(): Promise<void> {
    await this.apiRequest("POST", "/me/player/next");
  }

  async skipToPrevious(): Promise<void> {
    await this.apiRequest("POST", "/me/player/previous");
  }

  async getCurrentPlayback(): Promise<PlaybackState | null> {
    try {
      return await this.apiRequest<PlaybackState>("GET", "/me/player");
    } catch {
      return null;
    }
  }

  async getDevices(): Promise<SpotifyDevice[]> {
    const data = await this.apiRequest<{ devices: SpotifyDevice[] }>(
      "GET",
      "/me/player/devices"
    );
    return data.devices;
  }

  async setShuffle(state: boolean): Promise<void> {
    await this.apiRequest("PUT", `/me/player/shuffle?state=${state}`);
  }
}
