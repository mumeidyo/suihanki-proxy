/**
 * 本物のYouTube埋め込みプレーヤーのようなHTMLを生成する関数
 * YouTubeの埋め込みコードと同じパラメータや構造を持ち、
 * 内部的にはプロキシを使用して制限されたネットワーク環境でも視聴可能
 * 
 * @param videoId YouTubeのビデオID
 * @param options オプション設定
 * @returns HTML文字列
 */
export function getYouTubeIframeEmbed(
  videoId: string, 
  options: {
    autoplay?: boolean;
    controls?: boolean;
    showinfo?: boolean;
    rel?: boolean;
    loop?: boolean;
    start?: number;
    end?: number;
    width?: number | string;
    height?: number | string;
    title?: string;
  } = {}
): string {
  // デフォルト値の設定
  const {
    autoplay = false,
    controls = true,
    showinfo = true,
    rel = true,
    loop = false,
    start = 0,
    end = 0,
    width = 560,
    height = 315,
    title = 'YouTube video player'
  } = options;

  // パラメータをYouTubeのクエリパラメータ形式に変換
  const autoplayParam = autoplay ? '1' : '0';
  const controlsParam = controls ? '1' : '0';
  const showinfoParam = showinfo ? '1' : '0';
  const relParam = rel ? '1' : '0';
  const loopParam = loop ? '1' : '0';
  const startParam = start > 0 ? start.toString() : '';
  const endParam = end > 0 ? end.toString() : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #000;
    }
    
    .embed-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    
    #player-frame {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="embed-container">
    <iframe 
      id="player-frame"
      src="/api/youtube/proxy-player/${videoId}?autoplay=${autoplayParam}&controls=${controlsParam}&showinfo=${showinfoParam}&rel=${relParam}${startParam ? '&start=' + startParam : ''}${endParam ? '&end=' + endParam : ''}${loop ? '&loop=1' : ''}&embed=1"
      title="${title}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </div>
  
  <script>
    // YouTube API互換レイヤー
    window.onYouTubeIframeAPIReady = function() {
      if (typeof window.onYouTubePlayerAPIReady === 'function') {
        window.onYouTubePlayerAPIReady();
      }
    };
    
    // YouTube Player APIのエミュレート
    class YT {
      static get Player() {
        return class YouTubePlayer {
          constructor(elementId, options) {
            this.frame = document.getElementById('player-frame');
            this.options = options || {};
            this.videoId = '${videoId}';
            this.initialized = false;
            this.events = this.options.events || {};
            
            // APIが読み込まれたことを通知
            if (this.events.onReady) {
              setTimeout(() => {
                this.initialized = true;
                this.events.onReady({ target: this });
              }, 100);
            }
            
            // イベントリスナーの設定
            window.addEventListener('message', (event) => {
              try {
                const data = JSON.parse(event.data);
                if (data.event === 'play' && this.events.onStateChange) {
                  this.events.onStateChange({ data: YT.PlayerState.PLAYING });
                } else if (data.event === 'pause' && this.events.onStateChange) {
                  this.events.onStateChange({ data: YT.PlayerState.PAUSED });
                } else if (data.event === 'ended' && this.events.onStateChange) {
                  this.events.onStateChange({ data: YT.PlayerState.ENDED });
                }
              } catch (e) {
                // JSON解析エラーは無視
              }
            });
          }
          
          // PlayerAPIメソッド
          playVideo() {
            this.postMessage({ action: 'playVideo' });
          }
          
          pauseVideo() {
            this.postMessage({ action: 'pauseVideo' });
          }
          
          stopVideo() {
            this.postMessage({ action: 'stopVideo' });
          }
          
          seekTo(seconds, allowSeekAhead) {
            this.postMessage({ 
              action: 'seekTo', 
              seconds, 
              allowSeekAhead: !!allowSeekAhead 
            });
          }
          
          mute() {
            this.postMessage({ action: 'mute' });
          }
          
          unMute() {
            this.postMessage({ action: 'unMute' });
          }
          
          setVolume(volume) {
            this.postMessage({ action: 'setVolume', volume: Math.min(100, Math.max(0, volume)) });
          }
          
          getVolume() {
            return 100; // フォールバック値
          }
          
          // frame postMessage通信
          postMessage(message) {
            if (this.frame && this.frame.contentWindow) {
              this.frame.contentWindow.postMessage(JSON.stringify(message), '*');
            }
          }
        };
      }
      
      static get PlayerState() {
        return {
          UNSTARTED: -1,
          ENDED: 0,
          PLAYING: 1,
          PAUSED: 2,
          BUFFERING: 3,
          CUED: 5
        };
      }
    }
    
    // グローバルオブジェクトにYTを割り当て
    window.YT = YT;
    
    // APIが読み込まれたことを通知
    setTimeout(() => {
      if (typeof window.onYouTubeIframeAPIReady === 'function') {
        window.onYouTubeIframeAPIReady();
      }
    }, 200);
  </script>
</body>
</html>`;
}