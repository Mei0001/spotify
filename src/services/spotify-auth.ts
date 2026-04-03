import { createServer } from "node:http";
import { exec } from "node:child_process";
import { saveTokens, type TokenData } from "./token-store.js";

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || "https://spotify-blue-psi.vercel.app";

export async function authorize(): Promise<void> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const authPageUrl = clientId
    ? `${AUTH_SERVER_URL}/api/auth?client_id=${clientId}`
    : AUTH_SERVER_URL;

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url!, "http://localhost:8888");

      if (url.pathname === "/receive-token" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const tokenData = JSON.parse(body) as TokenData;

            if (!tokenData.access_token || !tokenData.refresh_token) {
              throw new Error("Invalid token data");
            }

            saveTokens(tokenData);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));

            console.error("\nTokens received and saved successfully!");
            console.error("You can now start the MCP server with: npm run dev");

            server.close();
            resolve();
          } catch (err) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid token data" }));
            console.error("Failed to parse token data:", err);
          }
        });
        return;
      }

      if (url.pathname === "/" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Spotify MCP auth receiver is running. Waiting for tokens...");
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    });

    server.listen(8888, () => {
      console.error("Spotify MCP Auth");
      console.error("================");
      console.error(`\nLocal token receiver listening on http://localhost:8888`);
      if (clientId) {
        console.error(`\nClient ID: ${clientId}`);
        console.error("Opening Spotify authorization...\n");
      } else {
        console.error("\nNo SPOTIFY_CLIENT_ID set. Opening setup page...");
        console.error("Enter your Client ID in the browser.\n");
      }
      exec(`open "${authPageUrl}"`);
    });

    setTimeout(() => {
      console.error("\nAuthorization timed out (5 minutes). Try again.");
      server.close();
      reject(new Error("Authorization timed out"));
    }, 5 * 60 * 1000);
  });
}

const isMain =
  process.argv[1]?.endsWith("spotify-auth.ts") ||
  process.argv[1]?.endsWith("spotify-auth.js");
if (isMain) {
  authorize().catch((err) => {
    console.error("Authorization error:", err);
    process.exit(1);
  });
}
