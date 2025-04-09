/**
 * YouTube埋め込みプレーヤー用のHTMLテンプレート
 * 実際のYouTube埋め込みプレーヤーに極めて近い挙動と見た目を再現します
 * @param videoId 再生する動画のID
 * @param autoplay 自動再生を有効にするかどうか（デフォルトはfalse）
 * @param showinfo 動画情報を表示するかどうか（デフォルトはtrue）
 * @param controls コントロールを表示するかどうか（デフォルトはtrue）
 * @param rel 関連動画を表示するかどうか（デフォルトはtrue）
 */
export function getProxyPlayerHtml(
  videoId: string, 
  autoplay: boolean = false,
  showinfo: boolean = true,
  controls: boolean = true,
  rel: boolean = true
): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>YouTube風プレーヤー</title>
  
  <!-- モバイル対応設定 -->
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#000000">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      background-color: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      overflow: hidden;
    }
    
    #app {
      display: flex;
      flex-direction: column;
      height: 100%;
      background-color: #000;
      position: relative;
    }
    
    #player-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    
    #video-player {
      max-width: 100%;
      max-height: 100%;
      width: 100%;
      height: 100%;
      background-color: #000;
      position: absolute;
      top: 0;
      left: 0;
    }
    
    #youtube-embed {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      border: none;
    }
    
    /* 再生コントロール */
    .player-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%);
      display: flex;
      align-items: center;
      padding: 0 16px;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 5;
    }
    
    #player-container:hover .player-controls {
      opacity: 1;
    }
    
    .progress-bar {
      position: absolute;
      bottom: 40px;
      left: 0;
      right: 0;
      height: 3px;
      background-color: rgba(255,255,255,0.2);
      cursor: pointer;
      z-index: 6;
    }
    
    .progress-filled {
      height: 100%;
      background-color: #f00;
      width: 0%;
      position: relative;
    }
    
    .progress-handle {
      position: absolute;
      right: -6px;
      top: -6px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: #f00;
      transform: scale(0);
      transition: transform 0.1s;
    }
    
    .progress-bar:hover .progress-handle {
      transform: scale(1);
    }
    
    .progress-bar:hover {
      height: 5px;
    }
    
    #loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background-color: rgba(0,0,0,0.7);
      z-index: 100;
    }
    
    #loading .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255,255,255,0.2);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s infinite linear;
      margin-bottom: 20px;
    }
    
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    
    #play-button {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 68px;
      height: 48px;
      background-color: rgba(0, 0, 0, 0.7);
      border: none;
      border-radius: 10%;
      color: white;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 20;
      transition: background-color 0.3s;
    }
    
    #play-button:hover {
      background-color: #cc0000;
    }
    
    #play-button-icon {
      width: 0;
      height: 0;
      border-top: 12px solid transparent;
      border-bottom: 12px solid transparent;
      border-left: 20px solid white;
      margin-left: 5px;
    }
    
    .hidden {
      display: none !important;
    }
    
    #error-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0,0,0,0.8);
      padding: 20px;
      border-radius: 8px;
      max-width: 80%;
      text-align: center;
      z-index: 50;
    }
    
    #error-message button {
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .nav-button {
      position: absolute;
      top: 20px;
      background-color: rgba(0,0,0,0.5);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      z-index: 30;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    #back-button {
      left: 20px;
    }
    
    #android-player-button {
      right: 20px;
    }
    
    /* YouTube風の埋め込みスタイル */
    .youtube-player-container {
      position: relative;
      width: 100%;
      height: 0;
      padding-bottom: 56.25%; /* 16:9 アスペクト比 */
      background-color: #000;
      overflow: hidden;
    }
    
    .youtube-player-container iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
    
    /* YouTube風プログレスバー */
    .youtube-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background-color: rgba(255,255,255,0.2);
      z-index: 5;
    }
    
    .youtube-progress-filled {
      height: 100%;
      background-color: #cc0000;
      width: 0;
      transition: width 0.1s linear;
    }
    
    .youtube-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 36px;
      background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0) 100%);
      display: flex;
      align-items: center;
      padding: 0 12px;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 4;
    }
    
    .youtube-player-container:hover .youtube-controls {
      opacity: 1;
    }
    
    .volume-control {
      display: flex;
      align-items: center;
      margin-left: 10px;
    }
    
    .volume-slider {
      width: 60px;
      height: 4px;
      background-color: rgba(255,255,255,0.2);
      margin-left: 5px;
      position: relative;
      cursor: pointer;
      border-radius: 2px;
    }
    
    .volume-filled {
      height: 100%;
      background-color: #fff;
      width: 100%;
      border-radius: 2px;
    }
    
    .fullscreen-button {
      margin-left: auto;
      cursor: pointer;
    }
    
    .time-display {
      color: #fff;
      font-size: 12px;
      margin-left: 10px;
    }
    
    /* YouTube風UI */
    .youtube-ui {
      position: absolute;
      inset: 0;
      background-color: #000;
      display: flex;
      flex-direction: column;
    }
    
    .play-pause-btn {
      background: none;
      border: none;
      color: white;
      font-size: 16px;
      cursor: pointer;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div id="app">
    <button id="back-button" class="nav-button">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      戻る
    </button>
    
    <a id="android-player-button" class="nav-button" href="/api/youtube/android-player/${videoId}">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
        <line x1="12" y1="18" x2="12" y2="18"></line>
      </svg>
      Androidモード
    </a>
    
    <div class="youtube-player-container">
      <div id="player-ui" class="youtube-ui">
        <div id="loading">
          <div class="spinner"></div>
          <div>動画を読み込み中...</div>
        </div>
        
        <button id="play-button">
          <div id="play-button-icon"></div>
        </button>
        
        <div class="youtube-progress">
          <div class="youtube-progress-filled" id="progress-bar"></div>
        </div>
        
        <div class="youtube-controls">
          <button class="play-pause-btn" id="play-pause">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5V19L19 12L8 5Z" fill="white"/>
            </svg>
          </button>
          
          <div class="volume-control">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="white"/>
              <path d="M15.54 8.46C16.4774 9.39764 17.0039 10.6692 17.0039 11.995C17.0039 13.3208 16.4774 14.5924 15.54 15.53" stroke="white" stroke-width="2"/>
              <path d="M19.07 4.93C20.9447 6.80528 21.9979 9.34836 21.9979 12C21.9979 14.6516 20.9447 17.1947 19.07 19.07" stroke="white" stroke-width="2"/>
            </svg>
            
            <div class="volume-slider">
              <div class="volume-filled"></div>
            </div>
          </div>
          
          <div class="time-display" id="time-display">0:00 / 0:00</div>
          
          <div class="fullscreen-button" id="fullscreen-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5V8M21 8V5C21 4.46957 20.7893 3.96086 20.4142 3.58579C20.0391 3.21071 19.5304 3 19 3H16M16 21H19C19.5304 21 20.0391 20.7893 20.4142 20.4142C20.7893 20.0391 21 19.5304 21 19V16M3 16V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H8" stroke="white" stroke-width="2"/>
            </svg>
          </div>
        </div>
      </div>
      
      <video 
        id="video-player"
        controls
        playsinline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        x5-video-player-fullscreen="true"
        x5-video-orientation="portrait"
        crossorigin="anonymous"
        preload="auto"
        poster="https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg"
        class="hidden"
      ></video>
    </div>
    
    <div id="error-message" class="hidden">
      <div>動画の読み込みに失敗しました</div>
      <div style="margin-top: 10px;">
        <a href="/api/youtube/direct-stream/${videoId}" style="color: #3ea6ff; text-decoration: none;">
          直接ストリーミングを試す
        </a>
      </div>
      <div style="margin-top: 10px;">
        <a href="/api/youtube/android-player/${videoId}" style="color: #3ea6ff; text-decoration: none;">
          Androidモードを試す
        </a>
      </div>
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const videoId = "${videoId}";
      const autoplay = ${autoplay};
      const backButton = document.getElementById('back-button');
      const playButton = document.getElementById('play-button');
      const playerUI = document.getElementById('player-ui');
      const videoPlayer = document.getElementById('video-player');
      const loading = document.getElementById('loading');
      const errorMessage = document.getElementById('error-message');
      const progressBar = document.getElementById('progress-bar');
      const playPauseBtn = document.getElementById('play-pause');
      const timeDisplay = document.getElementById('time-display');
      const fullscreenButton = document.getElementById('fullscreen-button');

      // YouTubeスタイルのカスタムUI
      let isPlaying = false;
      let videoLoaded = false;
      
      // 戻るボタン
      backButton.addEventListener('click', function() {
        window.history.back();
      });
      
      // 再生ボタン
      playButton.addEventListener('click', function() {
        startPlayback();
      });
      
      playPauseBtn.addEventListener('click', function() {
        if (isPlaying) {
          videoPlayer.pause();
          updatePlayPauseButton(false);
        } else {
          videoPlayer.play();
          updatePlayPauseButton(true);
        }
      });
      
      fullscreenButton.addEventListener('click', function() {
        if (videoPlayer.requestFullscreen) {
          videoPlayer.requestFullscreen();
        } else if (videoPlayer.webkitRequestFullscreen) {
          videoPlayer.webkitRequestFullscreen();
        } else if (videoPlayer.msRequestFullscreen) {
          videoPlayer.msRequestFullscreen();
        }
      });
      
      function updatePlayPauseButton(playing) {
        isPlaying = playing;
        if (playing) {
          playPauseBtn.innerHTML = \`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="4" width="4" height="16" fill="white"/>
              <rect x="14" y="4" width="4" height="16" fill="white"/>
            </svg>
          \`;
        } else {
          playPauseBtn.innerHTML = \`
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 5V19L19 12L8 5Z" fill="white"/>
            </svg>
          \`;
        }
      }
      
      // 自動再生かつモバイルデバイスでない場合は直接開始
      if (autoplay && !isMobileDevice()) {
        startPlayback();
      }
      
      function startPlayback() {
        if (videoLoaded) return;
        
        playButton.classList.add('hidden');
        
        // ビデオをセットアップ
        videoPlayer.src = \`/api/youtube/stream-video/\${videoId}\`;
        videoPlayer.classList.remove('hidden');
        videoLoaded = true;
        
        // 再生イベント
        videoPlayer.addEventListener('canplay', function() {
          loading.classList.add('hidden');
          playerUI.classList.add('hidden');
          videoPlayer.play().then(() => {
            updatePlayPauseButton(true);
          }).catch(e => {
            console.error('Play error:', e);
            // モバイルではユーザージェスチャーが必要
            if (isMobileDevice()) {
              playButton.classList.remove('hidden');
              loading.classList.add('hidden');
              playButton.addEventListener('click', function() {
                playButton.classList.add('hidden');
                videoPlayer.play().then(() => {
                  updatePlayPauseButton(true);
                }).catch(err => {
                  console.error('Mobile play error:', err);
                  errorMessage.classList.remove('hidden');
                });
              });
            } else {
              errorMessage.classList.remove('hidden');
            }
          });
        });
        
        // 再生状態の更新
        videoPlayer.addEventListener('play', function() {
          updatePlayPauseButton(true);
        });
        
        videoPlayer.addEventListener('pause', function() {
          updatePlayPauseButton(false);
        });
        
        // プログレスバーの更新
        videoPlayer.addEventListener('timeupdate', function() {
          const percent = (videoPlayer.currentTime / videoPlayer.duration) * 100;
          progressBar.style.width = percent + '%';
          
          // 時間表示の更新
          const currentMinutes = Math.floor(videoPlayer.currentTime / 60);
          const currentSeconds = Math.floor(videoPlayer.currentTime % 60);
          const totalMinutes = Math.floor(videoPlayer.duration / 60);
          const totalSeconds = Math.floor(videoPlayer.duration % 60);
          
          timeDisplay.textContent = \`\${currentMinutes}:\${currentSeconds < 10 ? '0' : ''}\${currentSeconds} / \${totalMinutes}:\${totalSeconds < 10 ? '0' : ''}\${totalSeconds}\`;
        });
        
        // エラーイベント
        videoPlayer.addEventListener('error', function() {
          loading.classList.add('hidden');
          errorMessage.classList.remove('hidden');
        });
        
        // 15秒以上かかったらタイムアウト
        setTimeout(function() {
          if (loading.classList.contains('hidden') === false) {
            loading.classList.add('hidden');
            errorMessage.classList.remove('hidden');
          }
        }, 15000);
      }
      
      // モバイルデバイスかどうかを判定
      function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      }
      
      // YouTubeの埋め込みプレーヤーのようなキーボードナビゲーション
      document.addEventListener('keydown', function(e) {
        if (!videoLoaded || !videoPlayer) return;
        
        switch(e.key) {
          case ' ':  // スペースキーで再生/一時停止
          case 'k':  // kキーで再生/一時停止 (YouTubeのショートカット)
            e.preventDefault();
            if (isPlaying) {
              videoPlayer.pause();
            } else {
              videoPlayer.play();
            }
            break;
          case 'f':  // fキーでフルスクリーン
            e.preventDefault();
            if (videoPlayer.requestFullscreen) {
              videoPlayer.requestFullscreen();
            } else if (videoPlayer.webkitRequestFullscreen) {
              videoPlayer.webkitRequestFullscreen();
            }
            break;
          case 'ArrowLeft':  // 左矢印で5秒戻る
            e.preventDefault();
            videoPlayer.currentTime = Math.max(0, videoPlayer.currentTime - 5);
            break;
          case 'ArrowRight':  // 右矢印で5秒進む
            e.preventDefault();
            videoPlayer.currentTime = Math.min(videoPlayer.duration, videoPlayer.currentTime + 5);
            break;
          case 'ArrowUp':  // 上矢印で音量アップ
            e.preventDefault();
            videoPlayer.volume = Math.min(1, videoPlayer.volume + 0.1);
            break;
          case 'ArrowDown':  // 下矢印で音量ダウン
            e.preventDefault();
            videoPlayer.volume = Math.max(0, videoPlayer.volume - 0.1);
            break;
          case 'm':  // mキーでミュート切り替え
            e.preventDefault();
            videoPlayer.muted = !videoPlayer.muted;
            break;
          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            // 数字キーで動画の特定の位置に移動（YouTube埋め込みと同様）
            const percent = parseInt(e.key) * 10;
            videoPlayer.currentTime = videoPlayer.duration * (percent / 100);
            break;
        }
      });
    });
  </script>
  
  <!-- YouTube埋め込みAPIに似た挙動を実装 -->
  <script>
    // YouTubeの埋め込みプレーヤーAPIをエミュレート
    window.onYouTubeIframeAPIReady = function() {
      console.log('YouTube API Ready emulated');
    };
    
    // YouTubePlayer風インターフェース
    class YouTubePlayerEmulator {
      constructor(videoPlayer) {
        this.videoPlayer = videoPlayer;
        this.events = {};
      }
      
      // イベントリスナー
      addEventListener(event, callback) {
        if (!this.events[event]) {
          this.events[event] = [];
        }
        this.events[event].push(callback);
        return this;
      }
      
      // イベント発火
      triggerEvent(event, data) {
        if (this.events[event]) {
          this.events[event].forEach(callback => callback(data));
        }
      }
      
      // 再生
      playVideo() {
        this.videoPlayer.play();
        return this;
      }
      
      // 一時停止
      pauseVideo() {
        this.videoPlayer.pause();
        return this;
      }
      
      // 停止
      stopVideo() {
        this.videoPlayer.pause();
        this.videoPlayer.currentTime = 0;
        return this;
      }
      
      // シーク
      seekTo(seconds, allowSeekAhead) {
        this.videoPlayer.currentTime = seconds;
        return this;
      }
      
      // ミュート
      mute() {
        this.videoPlayer.muted = true;
        return this;
      }
      
      // ミュート解除
      unMute() {
        this.videoPlayer.muted = false;
        return this;
      }
      
      // ミュート状態取得
      isMuted() {
        return this.videoPlayer.muted;
      }
      
      // 音量設定
      setVolume(volume) {
        this.videoPlayer.volume = Math.max(0, Math.min(100, volume)) / 100;
        return this;
      }
      
      // 音量取得
      getVolume() {
        return Math.round(this.videoPlayer.volume * 100);
      }
      
      // 動画の長さを取得
      getDuration() {
        return this.videoPlayer.duration;
      }
      
      // 現在の再生位置を取得
      getCurrentTime() {
        return this.videoPlayer.currentTime;
      }
      
      // 読み込み率を取得
      getVideoLoadedFraction() {
        if (this.videoPlayer.buffered.length === 0) {
          return 0;
        }
        return this.videoPlayer.buffered.end(0) / this.videoPlayer.duration;
      }
      
      // 再生状態を取得
      getPlayerState() {
        if (this.videoPlayer.paused) {
          return 2; // PAUSED
        } else if (this.videoPlayer.ended) {
          return 0; // ENDED
        } else {
          return 1; // PLAYING
        }
      }
    }
    
    // グローバルYouTubeオブジェクトをエミュレート
    window.YT = {
      PlayerState: {
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5
      },
      Player: YouTubePlayerEmulator
    };
  </script>
</body>
</html>`;
}
