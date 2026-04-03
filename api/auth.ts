import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes, createHash } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = req.query.client_id as string | undefined;
  if (!clientId || !/^[a-f0-9]{32}$/.test(clientId)) {
    res.status(400).send("Invalid or missing client_id parameter.");
    return;
  }

  const redirectUri = `https://${req.headers.host}/api/callback`;

  const codeVerifier = base64url(randomBytes(32));
  const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());

  res.setHeader("Set-Cookie", [
    `code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    `redirect_uri=${encodeURIComponent(redirectUri)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
    `client_id=${clientId}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=600`,
  ]);

  const scopes = [
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-modify-playback-state",
    "user-read-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: scopes,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
