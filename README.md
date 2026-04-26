# TODO Web App

シンプルな TODO アプリです。Node.js の小さな HTTP サーバーで動作します。Supabase 環境変数が設定されている場合は DB に保存し、未設定の場合は `tasks.json` に保存します。

## ローカル起動

```bash
npm start
```

ブラウザで `http://localhost:3000` を開いてください。

## できること

- タスク追加
- 完了状態の切り替え
- タスク編集
- タスク削除

## デプロイ

このアプリは `PORT` 環境変数に対応しているため、一般的な Node.js 対応ホスティングにそのまま配置できます。

### 必要条件

- Node.js 18 以上
- 起動コマンド: `npm start`

### Render などに配置する場合

- リポジトリを GitHub に push する
- 新しい Web Service を作成する
- Build Command: `npm install`
- Start Command: `npm start`

## Supabase 設定

1. Supabase で新しいプロジェクトを作成する
2. SQL Editor で [supabase-schema.sql](C:/codex-work/test/supabase-schema.sql) の内容を実行する
3. Project Settings から `SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を取得する
4. `.env.example` を参考に環境変数を設定して起動する

ローカル例:

```bash
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
npm start
```

利用する環境変数:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TASKS_TABLE` 省略時は `tasks`
- `PORT`

## 注意

`SUPABASE_SERVICE_ROLE_KEY` はサーバー側だけで使ってください。フロントエンドの JavaScript に埋め込んではいけません。

Supabase を設定しない場合は `tasks.json` に保存されます。ホスティング先によっては再起動や再デプロイで内容が消えることがあります。
