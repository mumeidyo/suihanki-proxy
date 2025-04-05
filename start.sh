#!/bin/bash

# Renderでの起動プロセスを管理するスクリプト
echo "Starting application in production mode..."

# 環境変数のチェック
if [ -z "$PORT" ]; then
  echo "PORT environment variable is not set. Using default port 10000."
  export PORT=10000
fi

# yt-dlpのパスを設定
echo "Setting up yt-dlp path..."
export PATH="$PATH:$(pwd)/dist/bin"

# Renderでのyt-dlpパス
if [ -f "$(pwd)/dist/bin/yt-dlp" ]; then
  export YT_DLP_PATH="$(pwd)/dist/bin/yt-dlp"
  echo "Using custom yt-dlp at: $YT_DLP_PATH"
# Replitでのyt-dlpパス
elif [ -f "/home/runner/workspace/.pythonlibs/bin/yt-dlp" ]; then
  export YT_DLP_PATH="/home/runner/workspace/.pythonlibs/bin/yt-dlp"
  echo "Using Replit yt-dlp at: $YT_DLP_PATH"
else
  echo "Warning: Could not find yt-dlp binary!"
fi

# 依存関係のバイナリをスキップする設定
export YOUTUBE_DL_SKIP_DOWNLOAD=true
export YT_DLP_SKIP_DOWNLOAD=true

# アプリケーションの起動
echo "Running application with NODE_ENV=production"
NODE_ENV=production node dist/index.js