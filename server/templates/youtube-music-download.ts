/**
 * YouTube Music ダウンロード用のHTMLテンプレート
 */
export function getYouTubeMusicDownloadHtml(videoId: string, title: string, artist: string, filename: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - ${artist} | YouTube Music ダウンロード</title>
  <link rel="icon" href="https://www.gstatic.com/youtube/img/music/favicon.ico" type="image/x-icon">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    
    body {
      background-color: #030303;
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
    
    .ytmusic-logo {
      color: #FF0000;
      font-weight: bold;
      font-size: 24px;
      display: flex;
      align-items: center;
    }
    
    .ytmusic-logo svg {
      margin-right: 10px;
    }
    
    .download-container {
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      background-color: #212121;
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
      background-color: #333333;
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
      background-color: #FF0000;
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
      background-color: #CC0000;
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
      color: #FF0000;
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
    <div class="ytmusic-logo">
      <svg width="24" height="24" fill="#FF0000" viewBox="0 0 24 24">
        <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"/>
      </svg>
      <span>YouTube Music ダウンロード</span>
    </div>
  </header>

  <div class="download-container">
    <div class="track-info">
      <div class="track-image">
        <img src="https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg" 
             onerror="this.onerror=null; this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'" 
             alt="${title}">
      </div>
      <div class="track-details">
        <h1 class="track-title">${title}</h1>
        <p class="track-artist">${artist}</p>
        <p class="track-id">Video ID: ${videoId}</p>
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
      <p>品質: 最高品質</p>
    </div>
    
    <div style="text-align: center;">
      <a href="/api/youtube/download?videoId=${videoId}&format=mp3&quality=highest" class="download-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        ダウンロードを開始
      </a>
    </div>
    
    <div class="download-message">
      <p>YouTube Musicの楽曲をMP3形式でダウンロードします</p>
      <p>ダウンロードボタンをクリックすると処理が開始されます</p>
    </div>
    
    <div class="download-footer">
      <p>© ${new Date().getFullYear()} YouTube Music Center | 教育目的のデモアプリケーション</p>
    </div>
  </div>
</body>
</html>`;
}