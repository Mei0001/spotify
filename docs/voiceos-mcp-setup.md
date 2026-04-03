# VoiceOS MCPサーバー構築手順（TypeScript）

VoiceOSで音声から呼び出せるカスタムMCPサーバーをTypeScriptで構築する手順。

## 前提条件

- Node.js v18以上
- npm または pnpm
- VoiceOSアプリがインストール済み
- GitHub CLI (`gh`) がインストール済み＆認証済み

## 1. プロジェクト初期化

```bash
cd taskattor

npm init -y

npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### package.json に追記

```json
{
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "npx tsx src/server.ts"
  }
}
```

## 2. ファイル構成

```
taskattor/
├── src/
│   ├── server.ts              # エントリポイント
│   └── tools/
│       └── diary.ts           # 日記ツール定義
├── data/                      # ローカル蓄積用（.gitignore対象）
├── docs/
├── tsconfig.json
└── package.json
```

## 3. 機能概要（日記MCPサーバー）

### ユースケース

音声で1日の出来事を随時入力し、蓄積したテキストを `Mei0001/life` リポジトリの既存Issueにコメントとして投稿する。

### 処理フロー

```
[音声入力] → VoiceOS → MCPサーバー
                          │
                          ├─ add_entry: ローカルファイルに追記
                          ├─ list_entries: 今日の蓄積内容を確認
                          └─ post_diary: GitHub Issueにコメント投稿
```

### ツール一覧

| ツール名 | 説明 | パラメータ |
|----------|------|-----------|
| `add_entry` | 今日の出来事をローカルに追記 | `text`: 入力テキスト |
| `list_entries` | 今日蓄積した内容を一覧表示 | なし |
| `post_diary` | 蓄積内容をGitHub Issueにコメント投稿 | `issue_number`: 投稿先Issue番号 |

### 各ツールの詳細

#### add_entry

- 音声で入力されたテキストを `data/diary-YYYY-MM-DD.txt` に追記
- タイムスタンプ付きで保存（例: `[14:30] ランチにカレーを食べた`）
- 追記のたびに確認メッセージを返す

#### list_entries

- 今日の日付の蓄積ファイルを読み取り、内容を返す
- ファイルが存在しない場合は「まだ記録がありません」を返す

#### post_diary

- `data/diary-YYYY-MM-DD.txt` の内容を読み取る
- `Mei0001/life` リポジトリの指定Issue番号にコメントとして投稿
- 投稿後、蓄積ファイルを投稿済みとしてリネーム（`diary-YYYY-MM-DD.posted.txt`）
- GitHub API は `gh` CLI 経由で実行（認証をCLIに委譲）

## 4. 実装のポイント

### ローカル蓄積

```typescript
// data/diary-2026-04-03.txt の形式
// [14:30] ランチにカレーを食べた
// [15:45] MTGでプロジェクトの進捗を共有した
// [18:00] 新しいライブラリを試した
```

### GitHub Issue コメント投稿

```bash
# gh CLI でコメント追加
gh issue comment <issue_number> --repo Mei0001/life --body "<本文>"
```

### エラーハンドリング

- `gh` コマンドが見つからない → エラーメッセージで案内
- Issue番号が不正 → GitHub APIのエラーをそのまま返す
- 蓄積ファイルが空 → 「投稿する内容がありません」を返す

## 5. 動作確認

```bash
# 開発モードで起動
npx tsx src/server.ts
```

## 6. VoiceOSへの接続

1. **VoiceOSアプリ**を起動
2. **設定 → 連携 → カスタム連携** へ移動
3. **追加** をクリック
4. 以下を設定:
   - **名前**: `taskattor`
   - **起動コマンド**: `npx tsx /Users/mei/src/github.com/Mei0001/taskattor/src/server.ts`

## 7. 実装時の注意点

- **説明文は具体的に**: VoiceOSのLLMがツール選択に使うため、曖昧な説明だと意図しないツールが呼ばれる
- **タイムアウト**: ツールの実行は15秒以内が推奨
- **`data/` ディレクトリ**: `.gitignore` に追加して日記データをリポジトリに含めない
- **`gh` CLI の認証**: サーバー起動前に `gh auth status` で認証状態を確認しておく

## 参考リンク

- [VoiceOS MCP連携ガイド](https://www.voiceos.com/ja/guide/build-mcp-integration)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Zod ドキュメント](https://zod.dev)
- [GitHub CLI ドキュメント](https://cli.github.com/manual/)
