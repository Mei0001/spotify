import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TOKEN_PATH = join(homedir(), ".spotify-mcp-tokens.json");

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  client_id: string;
}

export function loadTokens(): TokenData | null {
  try {
    const raw = readFileSync(TOKEN_PATH, "utf-8");
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

export function saveTokens(data: TokenData): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(data, null, 2));
  chmodSync(TOKEN_PATH, 0o600);
}

export function isExpired(tokens: TokenData): boolean {
  return Date.now() >= tokens.expires_at - 60_000;
}
