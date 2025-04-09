#!/bin/bash

# Renderでの起動プロセスを管理するスクリプト
echo "Starting application in production mode..."

# 環境変数のチェック
if [ -z "$PORT" ]; then
  echo "PORT environment variable is not set. Using default port 10000."
  export PORT=10000
fi

# デプロイ環境の設定
if [ -z "$DEPLOY_ENV" ]; then
  # RenderとReplit以外の環境の場合
  DEPLOY_ENV="unknown"
  # Render特有の環境変数をチェック
  if [ ! -z "$RENDER" ]; then
    DEPLOY_ENV="render"
  fi
  echo "Setting DEPLOY_ENV to $DEPLOY_ENV"
  export DEPLOY_ENV
fi

# Cookieディレクトリの確認と作成
echo "Setting up Cookie directories..."
if [ "$DEPLOY_ENV" = "render" ] || [ "$RENDER" = "true" ]; then
  # Render環境では/tmpディレクトリにCookieを保存
  mkdir -p /tmp/har_and_cookies
  echo "Created /tmp/har_and_cookies directory for Render environment"
  
  # Render環境変数を明示的に設定
  export RENDER=true
  
  # サンプルNetscape形式のクッキーファイルが存在するか確認し、なければ作成
  if [ ! -f "/tmp/har_and_cookies/youtube_cookies.txt" ]; then
    echo "Creating sample Netscape cookie file for YouTube in Render environment..."
    cat > /tmp/har_and_cookies/youtube_cookies.txt << 'EOF'
# Netscape HTTP Cookie File
# https://curl.se/docs/http-cookies.html
# This file was generated for Render deployment

.youtube.com    TRUE    /       FALSE   1735603200      GPS     1
.youtube.com    TRUE    /       FALSE   1735603200      VISITOR_INFO1_LIVE      sample-render-deploy
.youtube.com    TRUE    /       FALSE   1735603200      YSC     sample-render-deploy
.youtube.com    TRUE    /       FALSE   1735603200      PREF    f6=40000000&tz=Asia.Tokyo
EOF
    echo "Sample cookie file created in /tmp/har_and_cookies/youtube_cookies.txt"
  else
    echo "Using existing cookie file: /tmp/har_and_cookies/youtube_cookies.txt"
  fi
else
  # その他の環境
  mkdir -p har_and_cookies
  echo "Created har_and_cookies directory for $DEPLOY_ENV environment"
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