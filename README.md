# Spotify Weather MCP

「今日の気分、音楽にしてくれない？」— それだけでOK。

曲名もアーティスト名も覚えてなくていい。天気も、気分も、チャットの文脈も、全部BGMに変わる。

VoiceOS 向け MCP サーバー。Spotify API を使って、自然言語で音楽を操作できます。

## できること

| ツール | 説明 |
|--------|------|
| `get_my_playlists` | プレイリスト一覧を取得 |
| `play_playlist` | 名前を指定してプレイリストを再生 |
| `play_music` | 曲名・アーティスト・ジャンル等で検索して再生 |
| `weather_music` | 天気に合った音楽を自動選曲 |
| `control_playback` | 一時停止・再開・スキップ・前の曲 |
| `now_playing` | 現在再生中の曲情報を表示 |

## セットアップ

### 1. Spotify Developer Dashboard でアプリ作成

1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) にログイン
2. 「Create App」でアプリを作成
   - APIs used: **Web API** を選択
3. アプリの Settings → Redirect URIs に以下を追加:
   ```
   https://spotify-blue-psi.vercel.app/api/callback
   ```
4. **Client ID** をメモしておく

### 2. インストール

```bash
git clone https://github.com/Mei0001/spotify.git
cd spotify
npm install
```

### 3. Spotify 認証

```bash
npm run auth
```

ブラウザが開くので、Client ID を入力して Spotify で認証します。
トークンは `~/.spotify-mcp-tokens.json` に自動保存されます。

> 環境変数 `SPOTIFY_CLIENT_ID` を事前に設定しておくと、ブラウザでの入力をスキップできます。

### 4. VoiceOS に接続

1. VoiceOS アプリ → 設定 → カスタム連携
2. 以下を設定:
   - **名前**: `spotify`
   - **起動コマンド**:
     ```
     /opt/homebrew/bin/npx tsx /path/to/spotify/src/server.ts
     ```
     ※ パスは自分の環境に合わせて変更してください

### 5. 使う

Spotify アプリで何か 1 曲再生した状態で、VoiceOS に話しかけてください:

- 「プレイリスト見せて」
- 「ボサノバかけて」
- 「雨の日に合う曲かけて」
- 「次の曲」
- 「今なんの曲？」

## 自分で認証サーバーをデプロイする場合

`api/` ディレクトリが Vercel 用の認証サーバーです。フォークして自分の Vercel にデプロイできます:

```bash
vercel --prod
```

デプロイ後、Spotify Developer Dashboard の Redirect URI を `https://<your-domain>/api/callback` に変更してください。

ローカルの認証先を変更:

```bash
AUTH_SERVER_URL=https://your-domain.vercel.app npm run auth
```

## 技術スタック

- TypeScript / Node.js 18+
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) - MCP SDK
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) - OAuth PKCE
- [Vercel](https://vercel.com) - 認証サーバー
- [Zod](https://zod.dev) - スキーマバリデーション

## License

MIT
