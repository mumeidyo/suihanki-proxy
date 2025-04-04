# 高度なメディアアクセスアプリケーション

これは、プライバシー強化型のストリーミング機能を備えた教育用メディアアクセスWebアプリケーションです。セキュアで直感的なクロスプラットフォームメディア体験を提供します。

## 主な機能

- TypeScriptによるフロントエンドとバックエンド実装
- Ultravioletプライバシープロキシサービス
- 強化された軽量プロキシ実装
- クロスプラットフォーム対応のメディアストリーミング
- 動的プライバシーモード管理
- セキュアなメディア取得メカニズム
- 強化されたユーザープライバシー制御

## ローカル開発環境

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# 本番環境用ビルド
npm run build

# 本番サーバーの起動
npm start
```

## データベース

このアプリケーションはデータストレージにPostgreSQLを使用しています。

```bash
# データベースマイグレーションの実行
npm run db:push
```

## 技術スタック

- **フロントエンド**: React, TypeScript, TailwindCSS
- **バックエンド**: Node.js, Express, TypeScript
- **データベース**: PostgreSQL, Drizzle ORM
- **プロキシ**: Ultraviolet, カスタムプロキシ実装
- **システム監視**: カスタムメモリ・CPU監視モジュール

## プロジェクト構造

```
/
├── client/               # フロントエンドのReactアプリケーション
│   ├── src/              # ソースコード
│   │   ├── components/   # UIコンポーネント
│   │   ├── hooks/        # カスタムReactフック
│   │   ├── lib/          # ユーティリティ関数
│   │   ├── pages/        # ページコンポーネント
│   │   ├── styles/       # CSSスタイル
│   │   ├── types/        # TypeScript型定義
│   │   ├── App.tsx       # メインのAppコンポーネント
│   │   └── main.tsx      # エントリーポイント
│   └── index.html        # HTMLテンプレート
│
├── server/               # バックエンドのExpressサーバー
│   ├── templates/        # HTMLテンプレート
│   ├── index.ts          # サーバーのエントリーポイント
│   ├── routes.ts         # APIルート定義
│   ├── storage.ts        # データストレージインターフェース
│   ├── system-monitor.ts # システム監視モジュール
│   └── vite.ts           # Vite開発サーバー設定
│
├── shared/               # フロントエンドとバックエンド間の共有コード
│   └── schema.ts         # データベーススキーマ定義
│
├── dist/                 # ビルド後の出力ディレクトリ
├── render.yaml           # Render Blueprint設定
├── drizzle.config.ts     # Drizzle ORM設定
└── package.json          # プロジェクト設定・依存関係
```

# Renderクラウド環境へのデプロイメントガイド

このプロジェクトは、Renderクラウド環境への簡単なデプロイメントを実現するために最適化されています。本ガイドでは、アプリケーションをRenderにデプロイするための詳細な手順を説明します。

## 前提条件

Renderにデプロイするには、以下の前提条件が必要です：

- **GitHubアカウント**: リポジトリを保存するため
- **Renderアカウント**: [Render.com](https://render.com)で無料で作成可能
- **Node.js 20.x**: 開発中のローカル環境で必要（Render上では自動的に設定）
- **PostgreSQL**: 開発中は任意（Render上では自動的にプロビジョニング）

## システム要件

Render上でのデプロイメントには以下のリソースを推奨します：

| リソース | 最小要件 | 推奨 |
|---------|---------|-----|
| CPU | 1 vCPU | 2+ vCPU |
| メモリ | 512MB | 1GB+ |
| ストレージ | 不要 | 不要 |
| データベース | 無料プラン | スタータープラン |

高トラフィックの場合は、より多くのリソースが必要になる場合があります。

## 目次

- [ワンクリックデプロイメント](#ワンクリックデプロイメント)
- [手動デプロイメント手順](#手動デプロイメント手順)
- [デプロイメント後の設定](#デプロイメント後の設定)
- [システム監視と最適化](#システム監視と最適化)
- [トラブルシューティング](#トラブルシューティング)
- [カスタマイズと拡張](#カスタマイズと拡張)

## ワンクリックデプロイメント

最も簡単な方法は、下記の「Deploy to Render」ボタンをクリックすることです。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/advanced-media-access)

※ リンク内の `yourusername` を、あなたの実際のGitHubユーザー名に置き換えてください。

## 手動デプロイメント手順

より細かい設定を行いたい場合は、以下の手順で手動デプロイを行うことができます：

1. Renderアカウントを作成または既存のアカウントにログインします
2. このリポジトリをあなたのGitHubアカウントにフォークします
3. Renderダッシュボードで「Blueprint」を新規作成し、GitHubアカウントと連携します
4. フォークしたリポジトリを選択します
5. Renderが自動的に `render.yaml` 設定を検出し、必要なサービスをセットアップします
6. 「Apply」ボタンをクリックしてデプロイメントを開始します

### データベース設定

このアプリケーションは自動的にPostgreSQLデータベースを作成し設定します：

- データベース名: `advanced_media_access`
- ユーザー名: `advanced_media_access_user`
- 接続文字列: 環境変数 `DATABASE_URL` に自動的に設定されます

## デプロイメント後の設定

デプロイメントが完了したら、以下の点を確認してください：

1. アプリケーションはRenderが提供するURL（通常は `https://advanced-media-access.onrender.com`）でアクセス可能になります
2. データベース接続は環境変数を使用して自動的に設定されます
3. 必要なすべての環境変数が正しく設定されているか確認してください

### 環境変数一覧

以下の環境変数が自動的に設定されます：

| 環境変数 | 説明 | デフォルト値 |
|----------|------|------------|
| `NODE_ENV` | 実行環境の種類 | `production` |
| `RENDER` | Render環境で実行中かどうか | `true` |
| `DATABASE_URL` | PostgreSQLデータベースの接続文字列 | 自動生成 |
| `PORT` | アプリケーションの実行ポート | `10000` |

## システム監視と最適化

このアプリケーションには、Render環境に最適化されたシステム監視モジュールが含まれています：

- メモリ使用量の継続的な監視
- 高メモリ使用時の自動クリーンアップ
- CPU使用率の監視と負荷軽減
- Render環境特有の制約に合わせた閾値設定

これにより、長時間の安定した運用が可能になります。監視間隔やメモリ閾値はRender環境に合わせて最適化されています。

## トラブルシューティング

デプロイメントに問題がある場合は、以下の確認を行ってください：

1. **ログの確認**: Renderダッシュボードでログを確認し、エラーメッセージを特定します
2. **環境変数の確認**: すべての環境変数が正しく設定されているか確認します
3. **データベース初期化の確認**: アプリケーションは起動時に自動的にマイグレーションを実行します
4. **NODE_ENV設定の確認**: `NODE_ENV` 環境変数が `production` に設定されていることを確認します
5. **メモリ使用量の確認**: アプリケーションが割り当てられたメモリ制限内で動作していることを確認します

### 一般的なエラーと解決策

| エラー | 考えられる原因 | 解決策 |
|-------|--------------|-------|
| データベース接続エラー | データベースURLが正しくない | 環境変数 `DATABASE_URL` を確認 |
| アプリケーションが起動しない | メモリ不足 | より大きなインスタンスタイプを選択 |
| 502エラー | アプリケーションのクラッシュ | ログを確認し、エラーを修正 |

## ビルドと実行コマンド

このアプリケーションのビルドと実行には以下のコマンドが使用されます。Render環境では自動的に実行されますが、他の環境でデプロイする場合に役立ちます。

### ビルドコマンド

```bash
# package.jsonのbuildスクリプト
npm install && npm run build

# 実際に実行されるコマンド
vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

このビルドプロセスでは：
1. `vite build` - フロントエンドアセットをビルド
2. `esbuild` - バックエンドのTypeScriptコードをESMフォーマットでバンドル

### 起動コマンド

```bash
# package.jsonのstartスクリプト
npm start

# 実際に実行されるコマンド
NODE_ENV=production node dist/index.js
```

## カスタマイズと拡張

Render環境でさらに最適化するための提案：

1. **スケーリング設定**: トラフィックが多い場合は、Renderダッシュボードでインスタンス数を増やすことを検討してください
2. **メモリ割り当て**: アプリケーションの要件に基づいて、適切なメモリ割り当てを設定してください
3. **CDN統合**: 静的アセットにはRenderのCDNを活用することで、パフォーマンスを向上させることができます
4. **カスタムドメイン**: 本番環境では、Renderダッシュボードからカスタムドメインを設定することをお勧めします
5. **CI/CD**: GitHubアクションを使用して、継続的インテグレーションと継続的デプロイメントを設定することでデプロイメントプロセスを自動化できます

## 環境変数

`.env.example` テンプレートを元に `.env` ファイルを作成し、適切な値を設定してください。

### 必要な環境変数

| 環境変数 | 説明 | 必須 |
|----------|------|------|
| `DATABASE_URL` | PostgreSQLデータベースの接続文字列 | はい |
| `NODE_ENV` | 実行環境（development/production） | はい |
| `PORT` | サーバーの実行ポート | いいえ（デフォルト: 5000） |
| `YOUTUBE_API_KEY` | YouTube APIキー（オプション） | いいえ |

## ライセンス

MIT