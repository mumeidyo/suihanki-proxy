/**
 * 高速レンダリング用プレーヤーHTMLテンプレート
 * - 最適なフォーマット自動選択
 * - 複数品質のプリロード対応
 * - HLS (HTTP Live Streaming) のサポート
 * - キャッシュとプログレッシブロード
 */
export function getFastPlayerHtml(
  videoId: string,
  title: string,
  videoUrl: string,
  thumbnailUrl: string,
  alternativeFormats: { url: string; quality: string; type: string }[] = []
): string {
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <title>${title} - TabTube Fast Player</title>
      <style>
        /* レスポンシブデザイン */
        *, *::before, *::after { box-sizing: border-box; }
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; font-family: Arial, sans-serif; background: #0f0f0f; color: white; overflow-x: hidden; }
        body { display: flex; flex-direction: column; }
        
        /* ヘッダー */
        .header { background: #212121; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; z-index: 10; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .header-left { display: flex; align-items: center; }
        .back-button { background: none; border: none; color: white; font-size: 24px; cursor: pointer; margin-right: 15px; padding: 5px; }
        .logo { color: #ff0000; font-weight: bold; font-size: 18px; }
        
        /* メイン動画エリア */
        .content { flex: 1; display: flex; flex-direction: column; width: 100%; max-width: 1280px; margin: 0 auto; padding: 16px; }
        .video-container { position: relative; width: 100%; background: #000; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
        .video-container::before { content: ""; display: block; padding-top: 56.25%; /* 16:9アスペクト比 */ }
        video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; }
        
        /* 動画コントロール */
        .custom-controls { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); padding: 10px; opacity: 0; transition: opacity 0.3s; }
        .video-container:hover .custom-controls { opacity: 1; }
        .progress-bar { width: 100%; height: 5px; background: #444; margin-bottom: 10px; position: relative; cursor: pointer; border-radius: 2px; }
        .progress-amount { position: absolute; top: 0; left: 0; height: 100%; background: #f00; border-radius: 2px; width: 0%; }
        .control-buttons { display: flex; align-items: center; }
        .btn { background: none; border: none; color: white; margin-right: 10px; cursor: pointer; font-size: 20px; }
        .quality-selector { margin-left: auto; background: #333; color: white; border: none; padding: 5px 10px; border-radius: 4px; }
        
        /* メタデータ */
        .video-info { margin-bottom: 16px; }
        .video-title { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
        .video-meta { display: flex; justify-content: space-between; color: #aaa; font-size: 14px; }
        .loading-indicator { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); padding: 20px; border-radius: 10px; display: none; }
        
        /* モバイル最適化 */
        @media (max-width: 640px) {
          .header { padding: 8px 12px; }
          .content { padding: 12px; }
          .video-title { font-size: 16px; }
          .custom-controls { padding: 8px; }
        }
        
        /* 高度なコントロール */
        .buffered-amount { position: absolute; top: 0; left: 0; height: 100%; background: rgba(255,255,255,0.2); border-radius: 2px; width: 0%; }
        .time-display { color: white; margin: 0 10px; font-size: 14px; min-width: 70px; }
        .volume-container { display: flex; align-items: center; margin-left: auto; }
        .volume-slider { width: 80px; }
        
        /* プレロードマスク & 高速再生のための最適化 */
        .thumbnail-mask { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .play-button { width: 60px; height: 60px; background: rgba(0,0,0,0.7); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .play-button:before { content: ""; width: 0; height: 0; border-top: 15px solid transparent; border-bottom: 15px solid transparent; border-left: 25px solid white; margin-left: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="header-left">
          <button class="back-button" onclick="window.history.back()">←</button>
          <div class="logo">TabTube Fast</div>
        </div>
      </div>
      
      <div class="content">
        <div class="video-container">
          <!-- サムネイル表示 (プレロード中に表示) -->
          <div class="thumbnail-mask" id="thumbnail-mask" style="background-image: url('${thumbnailUrl}')">
            <div class="play-button"></div>
          </div>
          
          <!-- ビデオプレーヤー (非表示で先読み) -->
          <video id="video-player" preload="auto" poster="${thumbnailUrl}" style="opacity: 0;">
            <source src="${videoUrl}" type="video/mp4">
            ${alternativeFormats.map(format => 
              `<source src="${format.url}" type="${format.type}" data-quality="${format.quality}">`
            ).join('\n')}
            お使いのブラウザはHTML5ビデオをサポートしていません。
          </video>
          
          <!-- カスタムコントロール -->
          <div class="custom-controls" id="custom-controls">
            <div class="progress-bar" id="progress-bar">
              <div class="buffered-amount" id="buffered-amount"></div>
              <div class="progress-amount" id="progress-amount"></div>
            </div>
            <div class="control-buttons">
              <button class="btn" id="play-pause-btn">▶</button>
              <span class="time-display" id="time-display">0:00 / 0:00</span>
              <div class="volume-container">
                <button class="btn" id="mute-btn">🔊</button>
                <input type="range" class="volume-slider" id="volume-slider" min="0" max="1" step="0.1" value="1">
              </div>
              <select class="quality-selector" id="quality-selector">
                ${alternativeFormats.map(format => 
                  `<option value="${format.url}" ${format.url === videoUrl ? 'selected' : ''}>${format.quality}</option>`
                ).join('\n')}
              </select>
            </div>
          </div>
          
          <!-- ローディング表示 -->
          <div class="loading-indicator" id="loading-indicator">読み込み中...</div>
        </div>
        
        <div class="video-info">
          <div class="video-title">${title}</div>
          <div class="video-meta">
            <div>VideoID: ${videoId}</div>
            <div id="stats">読み込み時間: <span id="load-time">計測中...</span></div>
          </div>
        </div>
      </div>
      
      <script>
        // DOM要素
        const videoPlayer = document.getElementById('video-player');
        const thumbnailMask = document.getElementById('thumbnail-mask');
        const progressBar = document.getElementById('progress-bar');
        const progressAmount = document.getElementById('progress-amount');
        const bufferedAmount = document.getElementById('buffered-amount');
        const playPauseBtn = document.getElementById('play-pause-btn');
        const timeDisplay = document.getElementById('time-display');
        const qualitySelector = document.getElementById('quality-selector');
        const muteBtn = document.getElementById('mute-btn');
        const volumeSlider = document.getElementById('volume-slider');
        const loadingIndicator = document.getElementById('loading-indicator');
        const loadTimeDisplay = document.getElementById('load-time');
        
        // 時間フォーマッター
        function formatTime(seconds) {
          const minutes = Math.floor(seconds / 60);
          seconds = Math.floor(seconds % 60);
          return \`\${minutes}:\${seconds < 10 ? '0' : ''}\${seconds}\`;
        }
        
        // 動画読み込み追跡
        let startLoadTime = Date.now();
        let playAttempted = false;
        
        // サムネイルクリック時の処理
        thumbnailMask.addEventListener('click', () => {
          videoPlayer.style.opacity = '1';
          thumbnailMask.style.display = 'none';
          videoPlayer.play().catch(err => {
            console.error('Auto-play failed:', err);
            // 自動再生に失敗した場合でもUI更新
            thumbnailMask.style.display = 'flex';
          });
          playAttempted = true;
        });
        
        // 動画読み込み完了時の処理
        videoPlayer.addEventListener('canplay', () => {
          if (!playAttempted) return;
          
          const loadDuration = Date.now() - startLoadTime;
          loadTimeDisplay.textContent = \`\${loadDuration}ms\`;
          
          // 読み込み表示を隠す
          loadingIndicator.style.display = 'none';
          
          // UIを更新
          videoPlayer.style.opacity = '1';
          thumbnailMask.style.display = 'none';
          
          // 再生
          videoPlayer.play().catch(err => {
            console.error('Auto-play failed after canplay:', err);
          });
        });
        
        // 動画読み込み中の処理
        videoPlayer.addEventListener('waiting', () => {
          loadingIndicator.style.display = 'flex';
        });
        
        // 再生/一時停止ボタン
        playPauseBtn.addEventListener('click', () => {
          if (videoPlayer.paused) {
            videoPlayer.play();
            playPauseBtn.textContent = '⏸';
          } else {
            videoPlayer.pause();
            playPauseBtn.textContent = '▶';
          }
        });
        
        // 動画再生状態変更時の処理
        videoPlayer.addEventListener('play', () => {
          playPauseBtn.textContent = '⏸';
        });
        
        videoPlayer.addEventListener('pause', () => {
          playPauseBtn.textContent = '▶';
        });
        
        // プログレスバークリック時の処理
        progressBar.addEventListener('click', (e) => {
          const percent = e.offsetX / progressBar.offsetWidth;
          videoPlayer.currentTime = percent * videoPlayer.duration;
        });
        
        // 再生位置更新
        videoPlayer.addEventListener('timeupdate', () => {
          const percent = videoPlayer.currentTime / videoPlayer.duration;
          progressAmount.style.width = \`\${percent * 100}%\`;
          timeDisplay.textContent = \`\${formatTime(videoPlayer.currentTime)} / \${formatTime(videoPlayer.duration)}\`;
          
          // バッファー情報更新
          if (videoPlayer.buffered.length > 0) {
            const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
            const bufferedPercent = bufferedEnd / videoPlayer.duration;
            bufferedAmount.style.width = \`\${bufferedPercent * 100}%\`;
          }
        });
        
        // 品質変更
        qualitySelector.addEventListener('change', () => {
          const currentTime = videoPlayer.currentTime;
          const isPaused = videoPlayer.paused;
          
          // 現在の再生位置を保存
          videoPlayer.src = qualitySelector.value;
          
          // 読込を開始
          videoPlayer.load();
          videoPlayer.addEventListener('canplay', function resumePlayback() {
            videoPlayer.currentTime = currentTime;
            if (!isPaused) videoPlayer.play();
            videoPlayer.removeEventListener('canplay', resumePlayback);
          });
        });
        
        // 音量コントロール
        muteBtn.addEventListener('click', () => {
          videoPlayer.muted = !videoPlayer.muted;
          muteBtn.textContent = videoPlayer.muted ? '🔇' : '🔊';
        });
        
        volumeSlider.addEventListener('input', () => {
          videoPlayer.volume = volumeSlider.value;
          videoPlayer.muted = (volumeSlider.value === '0');
          muteBtn.textContent = (videoPlayer.muted || videoPlayer.volume === 0) ? '🔇' : '🔊';
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
          switch(e.key) {
            case ' ':  // スペースで再生/一時停止
              if (videoPlayer.paused) videoPlayer.play();
              else videoPlayer.pause();
              e.preventDefault();
              break;
            case 'ArrowRight':  // 右矢印で10秒進む
              videoPlayer.currentTime += 10;
              e.preventDefault();
              break;
            case 'ArrowLeft':  // 左矢印で10秒戻る
              videoPlayer.currentTime -= 10;
              e.preventDefault();
              break;
            case 'f':  // fでフルスクリーン
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                videoPlayer.requestFullscreen();
              }
              e.preventDefault();
              break;
            case 'm':  // mでミュート
              videoPlayer.muted = !videoPlayer.muted;
              muteBtn.textContent = videoPlayer.muted ? '🔇' : '🔊';
              e.preventDefault();
              break;
          }
        });
        
        // モバイルデバイス向け最適化
        function checkMobile() {
          return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        
        if (checkMobile()) {
          // モバイルデバイス向けの調整
          document.querySelectorAll('.btn').forEach(btn => {
            btn.style.padding = '10px';
          });
          
          // モバイルでは一部の詳細コントロールを隠す
          document.querySelector('.volume-container').style.display = 'none';
        }
        
        // サイト内の検索パラメータからタイムスタンプを取得して適用
        function applyTimeFromUrl() {
          try {
            const urlParams = new URLSearchParams(window.location.search);
            const t = urlParams.get('t');
            
            if (t) {
              // 時間フォーマットを解析 (例: 1h30m15s, 1:30:15, 90m15s, 5430s)
              let seconds = 0;
              
              if (t.includes('h') || t.includes('m') || t.includes('s')) {
                // 1h30m15s形式
                const hours = t.match(/(\d+)h/);
                const minutes = t.match(/(\d+)m/);
                const secs = t.match(/(\d+)s/);
                
                if (hours) seconds += parseInt(hours[1]) * 3600;
                if (minutes) seconds += parseInt(minutes[1]) * 60;
                if (secs) seconds += parseInt(secs[1]);
              } else if (t.includes(':')) {
                // 1:30:15形式
                const parts = t.split(':').map(Number);
                if (parts.length === 3) {
                  seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2) {
                  seconds = parts[0] * 60 + parts[1];
                }
              } else {
                // 秒数のみ
                seconds = parseInt(t);
              }
              
              // 読み込みが完了したらタイムスタンプを適用
              videoPlayer.addEventListener('loadedmetadata', () => {
                if (seconds > 0 && seconds < videoPlayer.duration) {
                  videoPlayer.currentTime = seconds;
                }
              });
            }
          } catch (e) {
            console.error('Error applying time from URL:', e);
          }
        }
        
        applyTimeFromUrl();
        
        // Fast-start最適化: プリロードモードを設定
        function optimizePreload() {
          // データが十分に取得できるまでauto、その後はmetadata(軽量)に変更
          videoPlayer.addEventListener('canplaythrough', () => {
            // 全体の25%以上がバッファされたらプリロードモードを変更
            if (videoPlayer.buffered.length > 0) {
              const bufferedEnd = videoPlayer.buffered.end(videoPlayer.buffered.length - 1);
              if (bufferedEnd / videoPlayer.duration > 0.25) {
                videoPlayer.preload = 'metadata';
              }
            }
          });
        }
        
        optimizePreload();
      </script>
    </body>
    </html>
  `;
}

// 日付フォーマット関数
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// 動画時間フォーマット関数
function formatDuration(seconds: string): string {
  const sec = parseInt(seconds, 10);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSeconds = sec % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}