/**
 * Spotifyダウンロード用のHTMLテンプレート
 */
export function getSpotifyDownloadHtml(trackId: string, title: string, artist: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${artist} | Spotify ダウンロード</title>
  <link rel="icon" href="https://open.spotifycdn.com/cdn/images/favicon.5cb2bd30.ico" type="image/x-icon">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    
    body {
      background-color: #121212;
      color: #fff;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 20px;
    }
    
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 15px 0;
      border-bottom: 1px solid #282828;
      margin-bottom: 20px;
    }
    
    .spotify-logo {
      color: #1DB954;
      font-weight: bold;
      font-size: 24px;
      display: flex;
      align-items: center;
    }
    
    .spotify-logo svg {
      margin-right: 10px;
    }
    
    .download-container {
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      background-color: #181818;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      flex-grow: 1;
    }
    
    .track-info {
      display: flex;
      margin-bottom: 20px;
      align-items: center;
    }
    
    .track-image {
      width: 180px;
      height: 180px;
      background-color: #282828;
      border-radius: 4px;
      margin-right: 20px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .track-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .track-image .placeholder {
      color: #b3b3b3;
      font-size: 24px;
      text-align: center;
    }
    
    .track-details {
      flex-grow: 1;
    }
    
    .track-title {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    
    .track-artist {
      font-size: 18px;
      color: #b3b3b3;
      margin-bottom: 15px;
    }
    
    .download-info {
      background-color: #282828;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    
    .download-info h2 {
      margin-bottom: 15px;
      font-size: 20px;
      display: flex;
      align-items: center;
    }
    
    .download-info h2 svg {
      margin-right: 10px;
    }
    
    .download-info p {
      color: #b3b3b3;
      line-height: 1.6;
      margin-bottom: 10px;
    }
    
    .download-btn {
      background-color: #1DB954;
      color: white;
      border: none;
      padding: 15px 30px;
      border-radius: 30px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      transition: transform 0.2s, background-color 0.2s;
      text-decoration: none;
      margin: 20px 0;
    }
    
    .download-btn:hover {
      background-color: #1ed760;
      transform: scale(1.05);
    }
    
    .download-btn svg {
      width: 20px;
      height: 20px;
    }
    
    .download-message {
      text-align: center;
      margin: 20px 0;
      color: #b3b3b3;
      font-size: 16px;
      line-height: 1.6;
    }
    
    .download-footer {
      margin-top: 40px;
      text-align: center;
      color: #b3b3b3;
      font-size: 14px;
    }
    
    .download-footer a {
      color: #1DB954;
      text-decoration: none;
    }
    
    @media (max-width: 600px) {
      .track-info {
        flex-direction: column;
        text-align: center;
      }
      
      .track-image {
        margin-right: 0;
        margin-bottom: 20px;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="spotify-logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="#1DB954"/>
        <path d="M16.7519 16.2501C16.4815 16.2501 16.2963 16.1797 16.0259 16.0093C14.8741 15.3334 13.2222 14.7982 11.5704 14.7982C10.1482 14.7982 8.72593 15.0538 7.51852 15.4186C7.31852 15.4889 7.11111 15.6593 6.84074 15.6593C6.2296 15.6593 5.75925 15.1889 5.75925 14.5834C5.75925 14.1482 5.97407 13.7834 6.38148 13.6482C7.93333 13.1075 9.55555 12.7778 11.6407 12.7778C13.7407 12.7778 15.7556 13.3834 17.1926 14.2593C17.3926 14.3649 17.6778 14.5834 17.6778 15.0889C17.6778 15.6593 17.2074 16.2501 16.7519 16.2501ZM17.8778 13.1778C17.5926 13.1778 17.3778 13.1075 17.1074 12.9371C15.6852 12.0612 13.4444 11.5204 11.1 11.5204C9.38519 11.5204 7.87037 11.8149 6.70741 12.1797C6.43704 12.2501 6.22222 12.3204 5.95185 12.3204C5.26667 12.3204 4.72222 11.7501 4.72222 11.065C4.72222 10.4945 5.07407 10.0593 5.55185 9.92411C7.04074 9.4537 8.87037 9.15896 11.1704 9.15896C13.7926 9.15896 16.3148 9.77041 18.0296 10.9371C18.3 11.1075 18.5037 11.4723 18.5037 11.9075C18.4333 12.6538 18.1185 13.1778 17.8778 13.1778ZM19.1778 9.57041C18.8926 9.57041 18.7222 9.50004 18.3815 9.32967C16.7519 8.38263 13.9148 7.77118 11.1704 7.77118C9.03333 7.77118 7.17778 8.06592 5.62592 8.57041C5.41111 8.64078 5.12593 8.78226 4.78148 8.78226C3.95926 8.78226 3.27407 8.06592 3.27407 7.24374C3.27407 6.42155 3.75185 5.85598 4.3 5.65671C6.22222 4.99933 8.37037 4.63344 11.0852 4.63344C14.1222 4.63344 17.4481 5.37859 19.6185 6.84374C19.9481 7.03559 20.2333 7.40148 20.2333 8.01293C20.2333 8.95256 19.7852 9.57041 19.1778 9.57041Z" fill="white"/>
      </svg>
      <span>Spotify ダウンロード</span>
    </div>
  </header>

  <div class="download-container">
    <div class="track-info">
      <div class="track-image">
        <div class="placeholder">🎵</div>
      </div>
      <div class="track-details">
        <h1 class="track-title">${title}</h1>
        <p class="track-artist">${artist}</p>
        <p class="track-id">Track ID: ${trackId}</p>
      </div>
    </div>
    
    <div class="download-info">
      <h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ダウンロード情報
      </h2>
      <p>ファイル名: ${filename}</p>
      <p>ファイル形式: MP3</p>
      <p>品質: 320kbps</p>
    </div>
    
    <div style="text-align: center;">
      <button id="downloadButton" class="download-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ダウンロードを開始
      </button>
    </div>
    
    <div class="download-message">
      <p>Spotifyの曲をダウンロードするには、Spotify APIキーと適切な権限が必要です</p>
      <p>このデモでは、実際のファイルダウンロードは行われません</p>
    </div>
    
    <div class="download-footer">
      <p>© ${new Date().getFullYear()} Spotify Music Center | 教育目的のデモアプリケーション</p>
    </div>
  </div>
  
  <script>
    // 実際のアプリケーションではSpotify APIを使用してダウンロードを処理します
    document.getElementById('downloadButton').addEventListener('click', function() {
      alert('Spotifyの曲のダウンロードには、Spotify APIの認証と適切な権限が必要です。このデモでは実装されていません。');
    });
  </script>
</body>
</html>`;
}