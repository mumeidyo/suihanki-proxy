# ベースイメージとしてNode.jsを使用
FROM node:18-alpine

# 必要な依存関係をインストール
RUN apk add --no-cache ffmpeg python3 curl bash

# 代わりにyt-dlpバイナリを直接ダウンロード
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルドスクリプトをカスタマイズ
RUN mkdir -p dist/server
RUN npx vite build
RUN npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=8080

# アプリケーションを実行
CMD ["node", "dist/index.js"]

# ポートを公開
EXPOSE 8080