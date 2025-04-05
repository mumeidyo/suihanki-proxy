/**
 * proxy-view用のHTMLテンプレート
 */
export function getProxyViewHtml(videoId: string, videoTitle: string, channelTitle: string, thumbnailUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${videoTitle} - sui-han-ki Tube & Proxy</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: Arial, sans-serif;
            background: #f9f9f9;
          }
          .container {
            max-width: 960px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
          }
          .back-button {
            background: #f0f0f0;
            color: #333;
            border: none;
            border-radius: 4px;
            padding: 8px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            margin-right: 15px;
          }
          .back-button:hover {
            background: #e0e0e0;
          }
          .title {
            font-size: 18px;
            font-weight: bold;
            margin: 0;
            flex: 1;
          }
          .player-container {
            position: relative;
            padding-top: 56.25%;
            background: #000;
            margin-bottom: 20px;
            border-radius: 8px;
            overflow: hidden;
          }
          .thumbnail-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: opacity 0.5s ease;
          }
          .thumbnail {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .play-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.5);
            transition: opacity 0.3s ease;
          }
          .play-button {
            background: #ff0000;
            color: white;
            border: none;
            border-radius: 50%;
            width: 60px;
            height: 60px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          }
          .play-button:hover {
            background: #cc0000;
          }
          .player-frame {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            border: none;
          }
          .loader {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 48px;
            height: 48px;
            border: 5px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s infinite linear;
            display: none;
          }
          .loader.active {
            display: block;
          }
          @keyframes spin {
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
          .tabs {
            display: flex;
            margin-bottom: 15px;
            border-bottom: 1px solid #e0e0e0;
          }
          .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
          }
          .tab.active {
            border-bottom: 2px solid #ff0000;
            font-weight: bold;
          }
          .tab-content {
            margin-bottom: 20px;
          }
          .info-content {
            line-height: 1.6;
          }
          .download-options {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
          }
          .download-button {
            background: #ff0000;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 10px 20px;
            cursor: pointer;
            font-weight: bold;
            display: flex;
            align-items: center;
            gap: 5px;
          }
          .download-button:hover {
            background: #cc0000;
          }
          .channel-info {
            margin-bottom: 15px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <button onclick="goBack()" class="back-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              戻る
            </button>
            <h1 class="title">${videoTitle}</h1>
          </div>
          
          <div class="player-container">
            <div class="thumbnail-wrapper">
              <img 
                src="${thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}" 
                onerror="this.onerror=null; this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'" 
                class="thumbnail" 
                alt="${videoTitle}"
              >
              <div class="play-overlay">
                <button id="playButton" class="play-button">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                </button>
              </div>
            </div>
            <iframe id="playerFrame" class="player-frame" allowfullscreen></iframe>
            <div id="loader" class="loader"></div>
          </div>
          
          <div class="channel-info">
            ${channelTitle || ''}
          </div>
          
          <div class="tabs">
            <div id="tabDownload" class="tab active">ダウンロード</div>
            <div id="tabInfo" class="tab">情報</div>
          </div>
          
          <div id="tabContentDownload" class="tab-content">
            <div class="download-options">
              <button id="downloadMP4" class="download-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                MP4動画をダウンロード
              </button>
              <button id="downloadMP3" class="download-button">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                MP3音声をダウンロード
              </button>
            </div>
          </div>
          
          <div id="tabContentInfo" class="tab-content info-content" style="display:none">
            <p>この動画はプロキシを通じてアクセスしています。公式サイトでも視聴できます：</p>
            <p><a href="https://www.youtube.com/watch?v=${videoId}" target="_blank">YouTubeで見る</a></p>
          </div>
        </div>
        
        <script>
          // 戻るボタンの機能
          function goBack() {
            window.history.back();
          }
          
          document.addEventListener('DOMContentLoaded', function() {
            const videoId = "${videoId}";
            const playerFrame = document.getElementById('playerFrame');
            const playButton = document.getElementById('playButton');
            const tabDownload = document.getElementById('tabDownload');
            const tabInfo = document.getElementById('tabInfo');
            const tabContentDownload = document.getElementById('tabContentDownload');
            const tabContentInfo = document.getElementById('tabContentInfo');
            const downloadMP4 = document.getElementById('downloadMP4');
            const downloadMP3 = document.getElementById('downloadMP3');
            
            // タブ切り替え
            tabDownload.addEventListener('click', function() {
              tabDownload.classList.add('active');
              tabInfo.classList.remove('active');
              tabContentDownload.style.display = 'block';
              tabContentInfo.style.display = 'none';
            });
            
            tabInfo.addEventListener('click', function() {
              tabInfo.classList.add('active');
              tabDownload.classList.remove('active');
              tabContentInfo.style.display = 'block';
              tabContentDownload.style.display = 'none';
            });
            
            // ダウンロードボタン
            downloadMP4.addEventListener('click', function() {
              window.location.href = '/api/youtube/download?videoId=${videoId}&format=mp4&quality=highest';
            });
            
            downloadMP3.addEventListener('click', function() {
              window.location.href = '/api/youtube/download?videoId=${videoId}&format=mp3&quality=highest';
            });
            
            // 再生ボタン - 同じページでビデオを再生する
            playButton.addEventListener('click', function() {
              // ローディングインジケーターを表示
              const loader = document.getElementById('loader');
              loader.classList.add('active');
              
              // 直接再生可能なURLを取得する
              // URL取得に時間がかかる場合のフォールバック処理
              const timeoutId = setTimeout(() => {
                console.log('Direct URL fetch is taking too long, falling back to proxy player');
                // プロキシプレーヤーに直接リダイレクト (待ちすぎない)
                window.location.href = "/api/youtube/proxy-player/" + videoId;
              }, 3000); // 3秒以内に応答がない場合はフォールバック
              
              fetch("/api/youtube/get-direct-urls/" + videoId)
                .then(response => response.json())
                .then(data => {
                  clearTimeout(timeoutId); // タイムアウトをキャンセル
                  
                  if (data && data.source && data.source.url) {
                    // プレーヤーフレームを設定して表示する
                    playerFrame.src = data.source.url;
                    playerFrame.style.display = 'block';
                    
                    // サムネイルと再生ボタンを非表示にする
                    document.querySelector('.thumbnail-wrapper').style.opacity = '0';
                  } else {
                    // 利用可能なURLがない場合はプロキシプレーヤーにリダイレクト
                    window.location.href = "/api/youtube/proxy-player/" + videoId;
                  }
                })
                .catch(error => {
                  clearTimeout(timeoutId); // タイムアウトをキャンセル
                  console.error('Error fetching video URL:', error);
                  // エラーが発生した場合はプロキシプレーヤーにリダイレクト
                  window.location.href = "/api/youtube/proxy-player/" + videoId;
                })
                .finally(() => {
                  // ローディングインジケーターを非表示
                  loader.classList.remove('active');
                });
            });
          });
        </script>
      </body>
    </html>
  `;
}