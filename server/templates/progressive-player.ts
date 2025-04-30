/**
 * プログレッシブダウンロード対応のプレーヤーテンプレート
 * このプレーヤーは、動画の一部がダウンロードされた時点で再生を開始します。
 * YouTubeと同様のストリーミング体験を提供します。
 */

export function generateProgressivePlayerHtml(
  videoId: string, 
  title: string,
  directUrls: {
    url: string;
    qualityLabel: string;
    mimeType: string;
    hasAudio: boolean;
    hasVideo: boolean;
  }[],
  thumbnailUrl: string,
  channelTitle: string = ''
): string {
  // プレーヤーページのHTMLを生成
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${title}</title>
  <style>
    body, html { margin: 0; padding: 0; height: 100%; width: 100%; background: #000; overflow: hidden; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .container { height: 100%; display: flex; flex-direction: column; }
    .video-container { flex: 1; position: relative; background-color: #000; }
    video { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
    .header { background: #212121; padding: 8px; display: flex; align-items: center; }
    .back-button { background: none; border: none; color: white; font-size: 24px; cursor: pointer; margin-right: 10px; }
    .title { color: white; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .thumbnail { 
      position: absolute; 
      top: 0; 
      left: 0; 
      width: 100%; 
      height: 100%; 
      object-fit: contain; 
      z-index: 1;
      background: #000;
    }
    .controls-overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      padding: 10px;
      background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
      z-index: 3;
      display: flex;
      align-items: center;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .video-container:hover .controls-overlay {
      opacity: 1;
    }
    .progress-container {
      flex: 1;
      height: 5px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 5px;
      margin: 0 10px;
      cursor: pointer;
      position: relative;
    }
    .progress-bar {
      height: 100%;
      background: #f00;
      border-radius: 5px;
      width: 0%;
    }
    .progress-buffer {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      background: rgba(255, 255, 255, 0.4);
      border-radius: 5px;
      width: 0%;
    }
    .control-button {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .quality-selector {
      background: rgba(28, 28, 28, 0.9);
      color: white;
      border: none;
      border-radius: 5px;
      padding: 5px;
      margin-left: 10px;
      cursor: pointer;
    }
    .loading-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
      color: white;
      font-size: 18px;
      background: rgba(0, 0, 0, 0.6);
      padding: 15px 20px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 3px solid #f00;
      width: 20px;
      height: 20px;
      margin-right: 10px;
      animation: spin 1s linear infinite;
    }
    .play-button-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 3;
      background: rgba(0, 0, 0, 0.7);
      width: 70px;
      height: 70px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }
    .play-triangle {
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 15px 0 15px 25px;
      border-color: transparent transparent transparent white;
      margin-left: 5px;
    }
    .time-display {
      color: white;
      font-size: 14px;
      margin-left: 10px;
      min-width: 90px;
      text-align: right;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .fullscreen-button {
      margin-left: 10px;
    }
    @media (max-width: 768px) {
      .title { font-size: 14px; }
      .time-display { font-size: 12px; min-width: 75px; }
    }
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <button class="back-button" onclick="window.history.back()">←</button>
      <div class="title">${title}</div>
    </div>
    <div class="video-container">
      <!-- サムネイル画像（ビデオが読み込まれるまで表示） -->
      <img class="thumbnail" src="${thumbnailUrl}" alt="${title}">
      
      <!-- ビデオプレーヤー -->
      <video id="videoPlayer" preload="auto"></video>
      
      <!-- プレイボタンオーバーレイ -->
      <div class="play-button-overlay" id="playButtonOverlay">
        <div class="play-triangle"></div>
      </div>
      
      <!-- ローディングインジケーター -->
      <div class="loading-indicator hidden" id="loadingIndicator">
        <div class="spinner"></div>
        <span>読み込み中...</span>
      </div>
      
      <!-- コントロールオーバーレイ -->
      <div class="controls-overlay" id="controlsOverlay">
        <button class="control-button" id="playPauseButton">⏸</button>
        
        <div class="progress-container" id="progressContainer">
          <div class="progress-buffer" id="bufferBar"></div>
          <div class="progress-bar" id="progressBar"></div>
        </div>
        
        <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
        
        <select class="quality-selector" id="qualitySelector">
          ${directUrls.map(url => `
            <option value="${url.url}" 
              data-quality="${url.qualityLabel}" 
              data-mimetype="${url.mimeType}" 
              data-audio="${url.hasAudio}" 
              data-video="${url.hasVideo}">
              ${url.qualityLabel}
            </option>
          `).join('')}
        </select>
        
        <button class="control-button fullscreen-button" id="fullscreenButton">⛶</button>
      </div>
    </div>
  </div>

  <script>
    // DOM要素の取得
    const videoPlayer = document.getElementById('videoPlayer');
    const thumbnail = document.querySelector('.thumbnail');
    const playButtonOverlay = document.getElementById('playButtonOverlay');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const controlsOverlay = document.getElementById('controlsOverlay');
    const playPauseButton = document.getElementById('playPauseButton');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const bufferBar = document.getElementById('bufferBar');
    const timeDisplay = document.getElementById('timeDisplay');
    const qualitySelector = document.getElementById('qualitySelector');
    const fullscreenButton = document.getElementById('fullscreenButton');
    
    // 初期状態
    let isPlaying = false;
    let currentTime = 0;
    let duration = 0;
    let currentQualityUrl = '';
    let isFirstPlay = true;
    
    // パフォーマンス測定
    const loadStartTime = performance.now();
    let firstPlayTime = 0;
    
    // URLからソースを設定
    function setVideoSource(url) {
      if (currentQualityUrl === url) return;
      currentQualityUrl = url;
      
      // 現在の再生位置を保存
      const wasPlaying = !videoPlayer.paused;
      const currentTimePos = videoPlayer.currentTime;
      
      // ソースを設定
      videoPlayer.src = url;
      
      // 再生位置を復元
      videoPlayer.addEventListener('loadedmetadata', function onceLoaded() {
        videoPlayer.currentTime = currentTimePos;
        if (wasPlaying) videoPlayer.play();
        videoPlayer.removeEventListener('loadedmetadata', onceLoaded);
      }, { once: true });
    }
    
    // オーディオソースを保持する変数
    let audioSource = null;
    let audioPlayer = null;
    
    // 最高品質のビデオを選択（初期設定）
    function selectInitialQuality() {
      // まず360pのオプション（通常は音声付き）を見つける
      const options = Array.from(qualitySelector.options);
      const audioOption = options.find(opt => 
        opt.dataset.audio === 'true' && 
        opt.textContent.trim().includes('360p')
      );
      
      // 音声ソースを保存
      if (audioOption) {
        audioSource = audioOption.value;
        console.log('Audio source set from 360p video:', audioSource);
      }
      
      // デフォルトで最高品質の動画を選択
      const bestOption = options.find(opt => 
        opt.dataset.video === 'true'
      ) || options[0];
      
      if (bestOption) {
        qualitySelector.value = bestOption.value;
        setVideoSource(bestOption.value);
      }
    }
    
    // 初期品質を選択
    selectInitialQuality();
    
    // オーディオプレーヤーの作成（非表示）
    function createAudioPlayer() {
      if (!audioSource || audioPlayer) return;
      
      // メインビデオに音声がある場合は処理不要
      const selectedOption = qualitySelector.options[qualitySelector.selectedIndex];
      if (selectedOption && selectedOption.dataset.audio === 'true') {
        console.log('Selected video already has audio, no need for separate audio');
        if (audioPlayer) {
          audioPlayer.pause();
          audioPlayer.remove();
          audioPlayer = null;
        }
        return;
      }
      
      if (!audioPlayer) {
        audioPlayer = document.createElement('audio');
        audioPlayer.style.display = 'none';
        audioPlayer.src = audioSource;
        document.body.appendChild(audioPlayer);
        console.log('Audio player created with source:', audioSource);
        
        // ビデオとオーディオを同期
        videoPlayer.addEventListener('play', function() {
          if (audioPlayer) {
            audioPlayer.currentTime = videoPlayer.currentTime;
            audioPlayer.play();
          }
        });
        
        videoPlayer.addEventListener('pause', function() {
          if (audioPlayer) audioPlayer.pause();
        });
        
        videoPlayer.addEventListener('seeking', function() {
          if (audioPlayer) audioPlayer.currentTime = videoPlayer.currentTime;
        });
        
        videoPlayer.addEventListener('volumechange', function() {
          if (audioPlayer) audioPlayer.volume = videoPlayer.volume;
        });
        
        videoPlayer.addEventListener('ratechange', function() {
          if (audioPlayer) audioPlayer.playbackRate = videoPlayer.playbackRate;
        });
      }
    }
    
    // 品質変更時のハンドラ
    qualitySelector.addEventListener('change', function() {
      const selectedOption = qualitySelector.options[qualitySelector.selectedIndex];
      
      // ビデオソースを設定
      setVideoSource(this.value);
      
      // 選択されたビデオに音声がある場合
      if (selectedOption && selectedOption.dataset.audio === 'true') {
        console.log('Selected video has audio, removing audio player');
        if (audioPlayer) {
          audioPlayer.pause();
          audioPlayer.remove();
          audioPlayer = null;
        }
      } else {
        // 選択されたビデオに音声がない場合、360pの音声を使用
        console.log('Selected video has no audio, using audio from 360p');
        createAudioPlayer();
      }
    });
    
    // プレイ／一時停止の切り替え
    function togglePlayPause() {
      if (videoPlayer.paused) {
        if (isFirstPlay) {
          loadingIndicator.classList.remove('hidden');
          isFirstPlay = false;
          
          // 初回再生時にオーディオプレーヤーを確認
          const selectedOption = qualitySelector.options[qualitySelector.selectedIndex];
          if (selectedOption && selectedOption.dataset.audio !== 'true' && audioSource) {
            createAudioPlayer();
          }
        }
        
        videoPlayer.play();
        playPauseButton.textContent = '⏸';
        playButtonOverlay.classList.add('hidden');
      } else {
        videoPlayer.pause();
        playPauseButton.textContent = '▶';
        playButtonOverlay.classList.remove('hidden');
      }
    }
    
    // プレイボタンクリック
    playButtonOverlay.addEventListener('click', togglePlayPause);
    playPauseButton.addEventListener('click', togglePlayPause);
    
    // ビデオプレーヤークリック
    videoPlayer.addEventListener('click', function(e) {
      e.preventDefault();
      togglePlayPause();
    });
    
    // プログレスバークリック
    progressContainer.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoPlayer.currentTime = pos * videoPlayer.duration;
    });
    
    // フルスクリーン切り替え
    fullscreenButton.addEventListener('click', function() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        const videoContainer = document.querySelector('.video-container');
        videoContainer.requestFullscreen();
      }
    });
    
    // ビデオの読み込み開始
    videoPlayer.addEventListener('loadstart', function() {
      if (!isFirstPlay) loadingIndicator.classList.remove('hidden');
    });
    
    // メタデータの読み込み完了
    videoPlayer.addEventListener('loadedmetadata', function() {
      duration = videoPlayer.duration;
      updateTimeDisplay();
    });
    
    // ビデオの再生可能
    videoPlayer.addEventListener('canplay', function() {
      loadingIndicator.classList.add('hidden');
      
      // サムネイルを非表示
      thumbnail.classList.add('hidden');
      
      if (isFirstPlay) {
        // 最初の再生時間を記録
        firstPlayTime = performance.now();
        console.log('Video ready to play in ' + Math.round(firstPlayTime - loadStartTime) + 'ms');
      }
    });
    
    // ビデオの再生開始
    videoPlayer.addEventListener('play', function() {
      playPauseButton.textContent = '⏸';
      playButtonOverlay.classList.add('hidden');
      isPlaying = true;
    });
    
    // ビデオの一時停止
    videoPlayer.addEventListener('pause', function() {
      playPauseButton.textContent = '▶';
      playButtonOverlay.classList.remove('hidden');
      isPlaying = false;
    });
    
    // ビデオの終了
    videoPlayer.addEventListener('ended', function() {
      playPauseButton.textContent = '▶';
      playButtonOverlay.classList.remove('hidden');
      isPlaying = false;
    });
    
    // 時間の更新
    videoPlayer.addEventListener('timeupdate', function() {
      currentTime = videoPlayer.currentTime;
      updateTimeDisplay();
      
      // プログレスバーの更新
      const percent = (currentTime / duration) * 100;
      progressBar.style.width = percent + '%';
    });
    
    // バッファーの更新
    videoPlayer.addEventListener('progress', function() {
      if (duration > 0) {
        for (let i = 0; i < videoPlayer.buffered.length; i++) {
          if (videoPlayer.buffered.start(i) <= videoPlayer.currentTime && videoPlayer.currentTime <= videoPlayer.buffered.end(i)) {
            const bufferPercent = (videoPlayer.buffered.end(i) / duration) * 100;
            bufferBar.style.width = bufferPercent + '%';
            break;
          }
        }
      }
    });
    
    // 待機イベント
    videoPlayer.addEventListener('waiting', function() {
      loadingIndicator.classList.remove('hidden');
    });
    
    // 再生再開イベント
    videoPlayer.addEventListener('playing', function() {
      loadingIndicator.classList.add('hidden');
    });
    
    // 時間表示の更新
    function updateTimeDisplay() {
      timeDisplay.textContent = formatTime(currentTime) + ' / ' + formatTime(duration);
    }
    
    // 時間のフォーマット
    function formatTime(seconds) {
      seconds = Math.floor(seconds);
      const minutes = Math.floor(seconds / 60);
      seconds = seconds % 60;
      return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
    }
    
    // 新しいタブでの開き方によってイベントを追加
    window.addEventListener('DOMContentLoaded', () => {
      if (window.opener) {
        // about:blank経由で開かれた場合の挙動
        console.log('Opened via about:blank');
      }
    });
    
    // エラーハンドリング
    videoPlayer.addEventListener('error', function() {
      console.error('Video playback error:', videoPlayer.error);
      loadingIndicator.classList.add('hidden');
      alert('動画の再生中にエラーが発生しました。別の品質を選択するか、少し時間をおいて再度お試しください。');
      
      // 別の動画品質を試す
      const options = Array.from(qualitySelector.options);
      const currentIndex = options.findIndex(opt => opt.value === currentQualityUrl);
      if (currentIndex >= 0 && options.length > 1) {
        const nextIndex = (currentIndex + 1) % options.length;
        qualitySelector.selectedIndex = nextIndex;
        setVideoSource(options[nextIndex].value);
      }
    });
    
    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space') {
        // スペースキーで再生/一時停止
        e.preventDefault();
        togglePlayPause();
      } else if (e.code === 'ArrowRight') {
        // 右矢印キーで10秒進む
        videoPlayer.currentTime += 10;
      } else if (e.code === 'ArrowLeft') {
        // 左矢印キーで10秒戻る
        videoPlayer.currentTime -= 10;
      } else if (e.code === 'KeyF') {
        // Fキーでフルスクリーン切り替え
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          const videoContainer = document.querySelector('.video-container');
          videoContainer.requestFullscreen();
        }
      }
    });
    
    // モバイルデバイスの検出
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      // モバイル向けの調整
      // ...
    }
  </script>
</body>
</html>
  `;
}