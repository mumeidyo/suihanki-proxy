/**
 * YouTube Music プレーヤー用のHTMLテンプレート
 */
export function getYouTubeMusicPlayerHtml(videoId: string, title: string, artist: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title} - ${artist} | Music Player</title>
  
  <!-- Android専用設定 -->
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="theme-color" content="#FF0000">
  
  <!-- 省エネモード対策 -->
  <meta http-equiv="origin-trial" content="AndroidBackgroundPlayback">
  <meta name="monetization" content="$ilp.uphold.com/LJZ3rDr7kQPF">
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    
    body {
      background-color: #121212;
      color: #fff;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .player-header {
      text-align: center;
      margin-bottom: 30px;
      padding-top: 20px;
    }
    
    .player-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 10px;
      color: #fff;
    }
    
    .player-artist {
      font-size: 18px;
      color: #b3b3b3;
      margin-bottom: 10px;
    }
    
    .album-art {
      width: 100%;
      max-width: 300px;
      height: auto;
      aspect-ratio: 1 / 1;
      margin: 0 auto 30px;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      background: #1e1e1e;
    }
    
    .album-art img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .controls {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .play-button {
      background: #FF0000;
      color: white;
      border: none;
      border-radius: 50px;
      padding: 15px 30px;
      font-size: 16px;
      font-weight: 600;
      margin: 20px 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 2px 8px rgba(255, 0, 0, 0.3);
      transition: transform 0.2s, background-color 0.2s;
    }
    
    .play-button:hover {
      background: #d70000;
      transform: scale(1.05);
    }
    
    .audio-container {
      width: 100%;
      margin: 20px 0;
      display: none;
    }
    
    audio {
      width: 100%;
      height: 54px;
      border-radius: 8px;
      background: #1e1e1e;
    }
    
    .status-indicator {
      text-align: center;
      margin: 20px 0;
      padding: 8px 16px;
      background: rgba(255, 0, 0, 0.1);
      border-radius: 4px;
      font-size: 14px;
      color: #ff5252;
      display: none;
    }
    
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
      margin-top: 40px;
    }
    
    /* Keep awake pulse animation */
    @keyframes pulse {
      0% { opacity: 0.2; }
      50% { opacity: 0.5; }
      100% { opacity: 0.2; }
    }
    
    #keep-awake-indicator {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: 10px;
      height: 10px;
      background-color: #ff5722;
      border-radius: 50%;
      animation: pulse 2s infinite;
      z-index: 100;
      display: none;
    }
    
    /* Overlay for preventing sleep */
    #overlay-keep-awake {
      position: fixed;
      top: 0;
      left: 0;
      width: 1px;
      height: 1px;
      background: transparent;
      z-index: -1;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <div id="keep-awake-indicator"></div>
  <div id="overlay-keep-awake"></div>
  
  <div class="container">
    <div class="player-header">
      <h1 class="player-title">${title}</h1>
      <p class="player-artist">${artist}</p>
    </div>
    
    <div class="album-art">
      <img src="https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg" 
           onerror="this.onerror=null; this.src='https://i.ytimg.com/vi/${videoId}/hqdefault.jpg'" 
           alt="${title} - ${artist}">
    </div>
    
    <div class="controls">
      <button id="playButton" class="play-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
        再生する
      </button>
    </div>
    
    <div id="audioContainer" class="audio-container">
      <!-- オーディオプレイヤーはJSで挿入 -->
    </div>
    
    <div id="statusIndicator" class="status-indicator">
      バックグラウンド再生対応
    </div>
  </div>
  
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // 変数設定
      const VIDEO_ID = "${videoId}";
      const TITLE = "${title}";
      const ARTIST = "${artist}";
      
      // DOM要素
      const playButton = document.getElementById('playButton');
      const audioContainer = document.getElementById('audioContainer');
      const statusIndicator = document.getElementById('statusIndicator');
      const keepAwakeIndicator = document.getElementById('keep-awake-indicator');
      const overlayKeepAwake = document.getElementById('overlay-keep-awake');
      
      // スリープ防止用変数
      let audioPlayer = null;
      let wakeLock = null;
      let noSleepVideo = null;
      let noSleepAudio = null;
      let heartbeatIntervals = [];
      let playbackActive = false;
      
      // スリープ防止策1: 無音のビデオを作成
      function createNoSleepVideo() {
        if (noSleepVideo) return;
        
        // ビデオ要素
        noSleepVideo = document.createElement('video');
        noSleepVideo.setAttribute('loop', '');
        noSleepVideo.setAttribute('playsinline', '');
        noSleepVideo.setAttribute('muted', '');
        
        // base64でエンコードした1x1ピクセルの無音ビデオ
        const source = document.createElement('source');
        source.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAs1tZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjYwMSBhMGNkN2QzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAD2WIhAA3//728P4FNjuZQQAAAu5tb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAZAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACGHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAZAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAgAAAAIAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAGQAAAAAAAEAAAAAAZBtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAACgAAAAEAFXEAAAAAAAtaGRscgAAAAAAAAAAdmlkZQAAAAAAAAAAAAAAAFZpZGVvSGFuZGxlcgAAAAE7bWluZgAAABR2bWhkAAAAAQAAAAAAAAAAAAAAJGRpbmYAAAAcZHJlZgAAAAAAAAABAAAADHVybCAAAAABAAAA+3N0YmwAAACXc3RzZAAAAAAAAAABAAAAh2F2YzEAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAgACAEgAAABIAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY//8AAAAxYXZjQwFkAAr/4QAYZ2QACqzZX4iIhAAAAwAEAAADAFA8SJZYAQAGaOvjyyLAAAAAGHN0dHMAAAAAAAAAAQAAAAEAAAQAAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAABRzdHN6AAAAAAAAAsUAAAABAAAAFHN0Y28AAAAAAAAAAQAAADAAAABidWR0YQAAAFptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAAC1pbHN0AAAAJal0b28AAAAdZGF0YQAAAAEAAAAATGF2ZjU2LjQwLjEwMQ==';
        source.type = 'video/mp4';
        noSleepVideo.appendChild(source);
        
        // ドキュメントに追加
        document.body.appendChild(noSleepVideo);
        noSleepVideo.style.width = '1px';
        noSleepVideo.style.height = '1px';
        noSleepVideo.style.position = 'absolute';
        noSleepVideo.style.left = '-1px';
        noSleepVideo.style.top = '-1px';
        noSleepVideo.muted = true;
      }
      
      // スリープ防止策2: 無音のオーディオを作成
      function createNoSleepAudio() {
        if (noSleepAudio) return;
        
        noSleepAudio = new Audio();
        noSleepAudio.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA/+NAwAAAAAAAAAAAAEluZm8AAAAPAAAAAwAABPUA7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u//MQxAADwAABpAAAACAAADSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//MQxBUAAANIAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
        noSleepAudio.loop = true;
        noSleepAudio.volume = 0.001;
        
        try {
          noSleepAudio.play().catch(e => {
            console.error('NoSleep Audio play failed:', e);
          });
        } catch (e) {
          console.error('NoSleep Audio error:', e);
        }
      }
      
      // スリープ防止対策 - すべての方法を実装
      async function enableNoSleep() {
        if (keepAwakeIndicator) {
          keepAwakeIndicator.style.display = 'block';
        }
        
        try {
          // 1. WakeLock API
          if ('wakeLock' in navigator) {
            try {
              wakeLock = await navigator.wakeLock.request('screen');
              console.log('WakeLock有効化成功');
              
              document.addEventListener('visibilitychange', async () => {
                if (wakeLock !== null && document.visibilityState === 'visible') {
                  wakeLock.release();
                  wakeLock = await navigator.wakeLock.request('screen');
                }
              });
            } catch (err) {
              console.error('WakeLock失敗:', err.message);
            }
          }
          
          // 2. NoSleep Video - 常に1x1ピクセルの無音ビデオを再生
          createNoSleepVideo();
          if (noSleepVideo) {
            noSleepVideo.play().catch(e => console.error('NoSleep Video play failed:', e));
          }
          
          // 3. NoSleep Audio - 無音のオーディオを再生
          createNoSleepAudio();
          
          // 4. CPU使用を維持するためのハートビート
          // 各種インターバルをクリア
          heartbeatIntervals.forEach(clearInterval);
          heartbeatIntervals = [];
          
          // オーディオ再生状態を定期チェック
          const audioCheckInterval = setInterval(() => {
            if (audioPlayer && audioPlayer.paused && playbackActive) {
              console.log('オーディオが一時停止しています - 再開試行');
              audioPlayer.play().catch(e => console.error('自動再開失敗:', e));
            }
            
            // 定期的なCPU使用をさせるための処理
            const randomCalc = Math.random() * Math.random(); // CPUを少量使わせる
            overlayKeepAwake.style.opacity = randomCalc < 0.5 ? '0.01' : '0';
            
            if (document.visibilityState === 'hidden' && playbackActive) {
              // バックグラウンドの時は追加のCPU使用
              const arr = new Uint8Array(1024);
              crypto.getRandomValues(arr);
              arr.sort();
            }
          }, 3000);
          
          // オーディオコンテキストを使ったプロセッシング
          try {
            const audioCtx = new (window.AudioContext || window['webkitAudioContext'])();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            gainNode.gain.value = 0.0001;
            oscillator.frequency.value = 1;
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            
            const audioCtxInterval = setInterval(() => {
              if (audioCtx.state !== 'running') {
                audioCtx.resume();
              }
              oscillator.frequency.value = 1 + (Math.random() * 0.1);
            }, 5000);
            
            heartbeatIntervals.push(audioCtxInterval);
          } catch (e) {
            console.log('AudioContext error:', e);
          }
          
          heartbeatIntervals.push(audioCheckInterval);
          
          // 定期的な小さな計算を実行
          const smallCalcInterval = setInterval(() => {
            if (playbackActive) {
              // この処理は小さなCPU使用量を維持し、
              // OSがプロセスをスリープさせるのを防ぐ
              for (let i = 0; i < 1000; i++) {
                Math.random();
              }
            }
          }, 2000);
          
          heartbeatIntervals.push(smallCalcInterval);
          
          // MediaSession API
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: TITLE,
              artist: ARTIST,
              album: "Music Player",
              artwork: [
                { src: \`https://i.ytimg.com/vi/\${VIDEO_ID}/hqdefault.jpg\`, sizes: '480x360', type: 'image/jpeg' }
              ]
            });
            
            navigator.mediaSession.setActionHandler('play', () => {
              if (audioPlayer) {
                audioPlayer.play().catch(e => console.log('MediaSession play error:', e));
              }
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
              if (audioPlayer) {
                audioPlayer.pause();
              }
            });
          }
          
          // スリープ防止が有効になったことを表示
          statusIndicator.textContent = 'バックグラウンド再生対応 - スリープ防止有効';
          statusIndicator.style.display = 'block';
          
          return true;
        } catch (e) {
          console.error('スリープ防止の初期化に失敗:', e);
          return false;
        }
      }
      
      // 再生ボタンクリック
      playButton.addEventListener('click', function() {
        // オーディオプレイヤー生成
        audioContainer.innerHTML = \`
          <audio
            id="audio-player"
            src="/api/youtube/stream-video/\${VIDEO_ID}"
            controls
            autoplay
            playsinline
            webkit-playsinline="true"
            preload="auto"
          ></audio>
        \`;
        
        audioPlayer = document.getElementById('audio-player');
        audioContainer.style.display = 'block';
        this.style.display = 'none';
        
        // スリープ防止有効化
        enableNoSleep();
        
        // オーディオイベント設定
        audioPlayer.addEventListener('play', function() {
          playbackActive = true;
          enableNoSleep();
        });
        
        audioPlayer.addEventListener('error', function(e) {
          console.error('Audio playback error:', e);
          statusIndicator.textContent = '再生エラー - もう一度お試しください';
          statusIndicator.style.display = 'block';
          playButton.style.display = 'inline-flex';
          playbackActive = false;
        });
        
        audioPlayer.addEventListener('pause', function() {
          if (document.visibilityState === 'hidden' && playbackActive) {
            // バックグラウンドで一時停止した場合は自動再開
            setTimeout(() => {
              if (document.visibilityState === 'hidden' && audioPlayer.paused && playbackActive) {
                audioPlayer.play().catch(e => console.log('バックグラウンド再開失敗:', e));
              }
            }, 500);
          }
        });
        
        // タッチイベント - 再生状態修復
        document.addEventListener('touchstart', function() {
          if (audioPlayer && audioPlayer.paused && playbackActive) {
            audioPlayer.play().catch(e => {});
          }
        }, {passive: true});
        
        // 再生開始
        audioPlayer.play()
          .then(() => {
            playbackActive = true;
          })
          .catch(e => {
            console.error('自動再生失敗:', e);
            statusIndicator.textContent = 'タップして再生を開始してください';
            statusIndicator.style.display = 'block';
          });
      });
      
      // ページ表示状態の変化を監視
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // フォアグラウンドに戻ったとき
          if (audioPlayer && audioPlayer.paused && playbackActive) {
            audioPlayer.play().catch(e => console.log('表示状態変化時の再開失敗:', e));
          }
          
          // スリープ防止を再適用
          if (playbackActive) enableNoSleep();
        } else {
          // バックグラウンドに行ったとき
          if (noSleepVideo) noSleepVideo.play().catch(e => {});
          if (noSleepAudio) noSleepAudio.play().catch(e => {});
          
          if (playbackActive) {
            // バックグラウンドモードで特別なCPU作業を追加
            setInterval(() => {
              const arr = new Uint8Array(256);
              crypto.getRandomValues(arr);
            }, 1000);
          }
        }
      });
      
      // フォーカスイベント
      window.addEventListener('focus', function() {
        if (audioPlayer && audioPlayer.paused && playbackActive) {
          audioPlayer.play().catch(e => {});
        }
      });
      
      // オリエンテーション変更時
      window.addEventListener('orientationchange', () => {
        setTimeout(() => {
          if (audioPlayer && audioPlayer.paused && playbackActive) {
            audioPlayer.play().catch(e => {});
          }
        }, 500);
      });
      
      // ネットワーク状態変化
      window.addEventListener('online', () => {
        if (audioPlayer && audioPlayer.paused && playbackActive) {
          // 再読み込み
          const currentTime = audioPlayer.currentTime;
          audioPlayer.load();
          audioPlayer.currentTime = currentTime;
          audioPlayer.play().catch(e => {});
        }
      });
    });
  </script>
  <div class="footer">
    © ${new Date().getFullYear()} Android Music Player | バージョン 3.0
  </div>
</body>
</html>`;
}
