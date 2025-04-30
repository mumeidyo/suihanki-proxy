#!/bin/bash

# Renderでのビルドプロセスを管理するスクリプト
echo "Starting build process..."

# yt-dlpをシステムにインストール
echo "Installing yt-dlp binary..."
mkdir -p bin
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o bin/yt-dlp
chmod +x bin/yt-dlp
export PATH="$PATH:$(pwd)/bin"

# Render環境特有の設定（Pythonライブラリとしてyt-dlpをインストール）
if [ "$RENDER" = "true" ]; then
  echo "Detected Render environment, installing yt-dlp as Python package..."
  # Python 3がインストールされているか確認
  if command -v python3 &> /dev/null; then
    echo "Python 3 is installed, installing pip packages..."
    python3 -m pip install --upgrade pip
    python3 -m pip install yt-dlp
    
    # インストールされたパスを確認
    YT_DLP_PATH=$(which yt-dlp)
    echo "yt-dlp installed at: $YT_DLP_PATH"
    
    # 環境変数として設定
    export YT_DLP_PATH
  else
    echo "Python 3 is not installed, skipping Python package installation."
  fi
fi

# YouTubeのCookieを保存するディレクトリを作成
echo "Creating directories for cookies and HAR files..."
mkdir -p har_and_cookies
touch har_and_cookies/.gitkeep
# Render環境用の一時Cookie保存ディレクトリも作成（/tmp内は起動時に毎回リセットされるため）
mkdir -p /tmp/har_and_cookies

# サンプルNetscape形式のクッキーファイルを作成（Renderデプロイ時に必要）
echo "Creating sample Netscape cookie file for YouTube..."
cat > /tmp/har_and_cookies/youtube_cookies.txt << 'EOF'
# Netscape HTTP Cookie File
# https://curl.se/docs/http-cookies.html
# This file was generated for Render deployment

.youtube.com    TRUE    /       FALSE   1735603200      GPS     1
.youtube.com    TRUE    /       FALSE   1735603200      VISITOR_INFO1_LIVE      sample-render-deploy
.youtube.com    TRUE    /       FALSE   1735603200      YSC     sample-render-deploy
.youtube.com    TRUE    /       FALSE   1735603200      PREF    f6=40000000&tz=Asia.Tokyo
EOF

# リポジトリ内にも同じクッキーファイルを作成
cp /tmp/har_and_cookies/youtube_cookies.txt har_and_cookies/
echo "Sample cookie files created."

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