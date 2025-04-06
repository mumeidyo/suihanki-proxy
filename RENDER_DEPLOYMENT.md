# Render へのデプロイ手順

このアプリケーションは Render.com で簡単にデプロイできます。以下の手順に従ってください。

## 1. Render アカウントの作成

まだ Render アカウントをお持ちでない場合は、[Render のウェブサイト](https://render.com)でアカウントを作成してください。

## 2. Render へのデプロイ方法

### 方法 A: GitHub 連携でのデプロイ（推奨）

1. このプロジェクトを GitHub リポジトリにプッシュします
2. Render ダッシュボードにログインし、「New +」ボタンをクリックします
3. 「Web Service」を選択します
4. GitHub アカウントを連携し、このリポジトリを選択します
5. 以下の設定を入力します：
   - **Name**: youtube-proxy-app（好きな名前に変更可能）
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free（または必要に応じて他のプランを選択）

### 方法 B: render.yaml を使ったブループリントデプロイ

1. Render ダッシュボードにログインします
2. 「New +」ボタンをクリックし、「Blueprint」を選択します
3. GitHub アカウントを連携し、このリポジトリを選択します
4. Render が自動的に `render.yaml` ファイルを検出し、設定を適用します
5. 「Apply」ボタンをクリックしてデプロイを開始します

## 3. 環境変数の設定

デプロイ後、以下の環境変数を設定する必要があります：

1. Render ダッシュボードでデプロイしたサービスを選択します
2. 「Environment」タブをクリックします
3. 以下の環境変数を追加します：
   - `NODE_ENV`: `production`
   - `PORT`: `10000`（Render が自動的に設定するので任意）

## 4. データベースの設定（オプション）

メモリストレージの代わりに永続的なデータベースを使用する場合：

1. Render ダッシュボードで「PostgreSQL」をクリックします
2. 「New PostgreSQL Database」を選択します
3. 必要な情報を入力し、無料プランを選択します
4. データベースが作成されたら、そのデータベースを Web サービスに接続します：
   - Web サービスの「Environment」タブで「Add Environment Variable」をクリックします
   - `DATABASE_URL` という名前で、PostgreSQL データベースの接続 URL を追加します

## 5. ドメインの設定（オプション）

カスタムドメインを設定する場合：

1. Render ダッシュボードでデプロイしたサービスを選択します
2. 「Settings」タブをクリックし、「Custom Domain」セクションを探します
3. 「Add Custom Domain」ボタンをクリックします
4. 表示される指示に従ってドメインの設定を完了します

## 注意事項

- 無料プランでは、15分間の非アクティブ後にサービスがスリープ状態になります
- 初回アクセス時は起動に時間がかかる場合があります
- YouTube API 機能を使用する場合は、`YOUTUBE_API_KEY` 環境変数も設定してください