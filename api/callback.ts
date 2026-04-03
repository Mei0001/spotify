import type { VercelRequest, VercelResponse } from "@vercel/node";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query;

  if (error || !code) {
    res.setHeader("Content-Type", "text/plain");
    res.status(400).send(`Authorization failed: ${error || "no code received"}`);
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const codeVerifier = cookies.code_verifier;
  const redirectUri = cookies.redirect_uri ? decodeURIComponent(cookies.redirect_uri) : "";
  const clientId = cookies.client_id;

  if (!codeVerifier || !redirectUri || !clientId) {
    res.status(400).send("Session expired. Please start the authorization again.");
    return;
  }

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code as string,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    res.setHeader("Content-Type", "text/plain");
    res.status(500).send(`Token exchange failed: ${tokenRes.status} ${errBody}`);
    return;
  }

  const data = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    client_id: clientId,
  };

  // Clear cookies
  res.setHeader("Set-Cookie", [
    "code_verifier=; Path=/; Max-Age=0",
    "redirect_uri=; Path=/; Max-Age=0",
    "client_id=; Path=/; Max-Age=0",
  ]);

  const tokenJson = JSON.stringify(tokenData);
  const tokenJsonEscaped = tokenJson.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  res.setHeader("Content-Type", "text/html");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.send(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Spotify MCP - Authorization</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; background: #191414; color: #fff; }
    h1 { color: #1DB954; }
    .status { padding: 16px; border-radius: 8px; margin: 20px 0; }
    .success { background: #1a3a2a; border: 1px solid #1DB954; }
    .waiting { background: #3a3a1a; border: 1px solid #b9a81d; }
    .error { background: #3a1a1a; border: 1px solid #b91d1d; }
    button { background: #1DB954; color: #fff; border: none; padding: 12px 24px; border-radius: 24px; font-size: 16px; cursor: pointer; margin: 8px 4px; }
    button:hover { background: #1ed760; }
    pre { background: #282828; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; max-height: 200px; overflow-y: auto; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <h1>Spotify MCP Authorization</h1>

  <div id="auto-status" class="status waiting">
    <p>ローカルのCLIにトークンを送信中...</p>
  </div>

  <div id="manual-section" class="hidden">
    <div class="status error">
      <p>ローカルCLIへの自動送信に失敗しました。以下の手順で手動保存してください:</p>
    </div>
    <ol>
      <li>下のコマンドをコピー</li>
      <li>ターミナルで実行</li>
    </ol>
    <pre>echo '${tokenJsonEscaped}' > ~/.spotify-mcp-tokens.json && chmod 600 ~/.spotify-mcp-tokens.json</pre>
    <button onclick="copyCommand()">コマンドをコピー</button>
  </div>

  <div id="success-section" class="hidden">
    <div class="status success">
      <p>トークンがローカルに保存されました！このページを閉じてOKです。</p>
    </div>
  </div>

  <script>
    const tokenData = ${tokenJsonEscaped};

    async function sendToLocal() {
      try {
        const res = await fetch('http://localhost:8888/receive-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenData),
        });
        if (res.ok) {
          document.getElementById('auto-status').classList.add('hidden');
          document.getElementById('success-section').classList.remove('hidden');
        } else {
          throw new Error('Local server responded with error');
        }
      } catch (e) {
        document.getElementById('auto-status').classList.add('hidden');
        document.getElementById('manual-section').classList.remove('hidden');
      }
    }

    function copyCommand() {
      const cmd = "echo '" + JSON.stringify(tokenData) + "' > ~/.spotify-mcp-tokens.json && chmod 600 ~/.spotify-mcp-tokens.json";
      navigator.clipboard.writeText(cmd);
      event.target.textContent = 'Copied!';
      setTimeout(() => { event.target.textContent = 'コマンドをコピー'; }, 2000);
    }

    sendToLocal();
  </script>
</body>
</html>`);
}
