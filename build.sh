#!/bin/bash

# Renderでのビルドプロセスを管理するスクリプト
echo "Starting build process..."

# yt-dlpをシステムにインストール
echo "Installing yt-dlp binary..."
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod +x bin/yt-dlp
export PATH="$PATH:$(pwd)/bin"

# YouTubeのCookieを保存するディレクトリを作成
echo "Creating directories for cookies and HAR files..."
mkdir -p har_and_cookies
touch har_and_cookies/.gitkeep
# Render環境用の一時Cookie保存ディレクトリも作成（/tmp内は起動時に毎回リセットされるため）
mkdir -p /tmp/har_and_cookies

# youtube-dl-execのpostinstallスクリプトをバイパスするための環境変数を設定
echo "Setting up environment to skip youtube-dl-exec postinstall..."
export YOUTUBE_DL_SKIP_DOWNLOAD=true
export YT_DLP_SKIP_DOWNLOAD=true

# 依存関係のインストール
echo "Installing dependencies..."
npm install

# フロントエンドとバックエンドのビルド
echo "Building application..."
npm run build

# テンプレートファイルをdistディレクトリにコピー
echo "Copying template files to dist directory..."
mkdir -p dist/templates
cp -r server/templates/* dist/templates/

# binディレクトリをdistにコピー（実行環境で利用可能にする）
echo "Copying yt-dlp binary to dist directory..."
mkdir -p dist/bin
cp bin/yt-dlp dist/bin/
chmod +x dist/bin/yt-dlp

echo "Build completed successfully!"
