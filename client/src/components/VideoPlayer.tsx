import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share, Loader, RefreshCw, Play, ArrowLeft, Maximize, X, Check, Smartphone, Shield } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatPublishedDate } from "@/lib/youtube";
import { YoutubeVideo } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { openUrl } from "@/lib/aboutBlank";

interface VideoPlayerProps {
  videoId: string;
  onDownload: (videoId: string) => void;
}

export default function VideoPlayer({ videoId, onDownload }: VideoPlayerProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(true);
  const [playbackError, setPlaybackError] = useState(false);
  const [isFullPlayer, setIsFullPlayer] = useState(false);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 直接ダウンロードのためのハンドラー
  const handleDirectDownload = (format: string, quality: string) => {
    if (!videoId) return;
    
    const downloadUrl = `/api/youtube/download?videoId=${videoId}&format=${format}&quality=${quality}`;
    
    // 新しいタブでダウンロードリンクを開く（about:blankモード対応）
    openUrl(downloadUrl);
  };

  const { data: videoInfo } = useQuery<YoutubeVideo>({
    queryKey: [`/api/youtube/video/${videoId}`],
    enabled: !!videoId
  });

  // 直接URLを取得 (プリフェッチで高速化)
  // バックグラウンドで非同期に直接URLを取得する関数
  const fetchDirectUrl = async (
    currentVideoId: string, 
    controller: AbortController | null, 
    onSuccess: (url: string) => void,
    isMountedCheck: () => boolean
  ) => {
    // ローカルのcontrollerを作成（nullの場合に対応）
    let localController: AbortController | null = controller;
    try {
      if (!localController) {
        localController = new AbortController();
      }
      const signal = localController.signal;
      
      console.log(`Fetching direct URL for ${currentVideoId}`);
      const startTime = performance.now();
      
      // isMountedCheckを使うことで、コンポーネントがアンマウントされた場合は処理を中止
      if (!isMountedCheck()) {
        console.log('Component unmounted, aborting fetch');
        return;
      }
      
      const response = await fetch(`/api/youtube/get-direct-urls/${currentVideoId}`, {
        credentials: 'include',
        signal
      });
      
      // コンポーネントがアンマウントされた場合は処理を中止
      if (!isMountedCheck()) {
        console.log('Component unmounted after fetch, aborting processing');
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Error fetching direct URL: ${response.status}`);
      }
      
      const data = await response.json();
      const endTime = performance.now();
      console.log(`Direct URL fetch completed in ${Math.round(endTime - startTime)}ms`);
      
      // APIからのレスポンスに対応する複数のフォーマットをサポート
      if (isMountedCheck()) {
        let url = null;
        
        // 複数のフォーマットに対応
        if (data && data.source && data.source.url) {
          url = data.source.url;
        } else if (data && data.url) {
          url = data.url; 
        } else if (data && data.formats && data.formats.length > 0) {
          // 最初の利用可能なフォーマットを使用
          url = data.formats[0].url;
        }
        
        if (url) {
          console.log("Direct URL set successfully:", url.substring(0, 100) + "...");
          
          // CORS対応のためにURLパラメータにoriginを追加（可能な場合）
          try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('googlevideo.com')) {
              // 既存のクエリパラメータを保持
              const params = new URLSearchParams(urlObj.search);
              // originパラメータを追加（YouTubeの要件に合わせる）
              if (!params.has('origin')) {
                params.set('origin', 'https://www.youtube.com');
              }
              urlObj.search = params.toString();
              url = urlObj.toString();
              console.log('Enhanced URL with origin parameter');
            }
          } catch (urlError) {
            console.warn('Could not parse or enhance URL:', urlError);
          }
          
          // 直接URLを設定
          onSuccess(url);
        } else {
          console.warn("No valid URL found in response");
        }
      }
    } catch (error) {
      // AbortErrorは正常なキャンセルなのでエラーとして扱わない
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('Direct URL fetch aborted');
      } else {
        console.error('Error fetching direct URL:', error);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let controller: AbortController | null = null;
    
    // 状態のリセットと更新
    if (videoId) {
      // 最初に状態をリセット（ただし直接URLはリセットしない）
      setIsLoading(true);
      setPlaybackError(false);
      setVideoLoaded(false);
      setVideoError(false);
      
      // すぐにローディングを終了して次のビデオの準備をする
      const loadingTimer = setTimeout(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      }, 200); // より短い時間に設定（ユーザー体験向上）
      
      // 新しいAbortControllerを作成
      controller = new AbortController();

      // 別のタイマーで少し遅延させてからURLフェッチを開始
      // これにより、UIの更新が優先され、ユーザー体験が向上する
      const fetchTimer = setTimeout(() => {
        if (isMounted && controller) {
          fetchDirectUrl(
            videoId,
            controller,
            (url) => setDirectUrl(url),
            () => isMounted
          );
        }
      }, 100);
      
      return () => {
        isMounted = false;
        clearTimeout(loadingTimer);
        clearTimeout(fetchTimer);
        // コンポーネントがアンマウントされた場合、進行中のリクエストをキャンセル
        if (controller) {
          controller.abort(); // コントローラーが存在する場合のみ中止
        }
      };
    }
  }, [videoId]);

  // 高速プレーヤーURL - 高画質・高速処理に対応（標準）
  const videoPlayerUrl = `/api/youtube/progressive/${videoId}`;
  
  // プロキシプレーヤーURL（代替）
  const proxyPlayerUrl = `/api/youtube/proxy-player/${videoId}`;
  
  // プロキシビデオURL - プロキシビデオを使用（低画質だが安定）
  const proxyVideoUrl = `/api/youtube/proxy-video/${videoId}`;
  
  // フォールバックURL - ストリーミングAPIを使用（フォールバック用）
  const videoProxyUrl = `/api/youtube/stream-video/${videoId}`;
  
  // Android向け強化プレーヤーURL
  const androidPlayerUrl = `/api/youtube/android-player/${videoId}`;
  
  // iFilter対応特殊プレーヤーURL
  const iFilterPlayerUrl = `/api/youtube/ifilter-player/${videoId}`;

  if (!videoId) {
    return <div className="mb-6"></div>;
  }

  // Android向け強化プレーヤーを開く
  const openAndroidPlayer = () => {
    if (videoId) {
      openUrl(androidPlayerUrl);
    }
  };
  
  // iFilter対応プレーヤーを開く
  const openIFilterPlayer = () => {
    if (videoId) {
      openUrl(iFilterPlayerUrl);
    }
  };
  
  // プロキシビデオプレーヤーを開く
  const openProxyVideoPlayer = () => {
    if (videoId) {
      openUrl(proxyVideoUrl);
    }
  };
  
  // 高速プレーヤーを開く
  const openProgressivePlayer = () => {
    if (videoId) {
      openUrl(`/api/youtube/progressive/${videoId}`);
    }
  };
  
  // 標準プロキシプレーヤーを開く
  const openStandardProxyPlayer = () => {
    if (videoId) {
      openUrl(proxyPlayerUrl);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: videoInfo?.title || "YouTube Video",
        url: `https://www.youtube.com/watch?v=${videoId}`
      }).catch(err => {
        console.error("Error sharing:", err);
      });
    } else {
      // Fallback for browsers that don't support the Web Share API
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      navigator.clipboard.writeText(url);
      alert("URLをクリップボードにコピーしました");
    }
  };
  
  // フルプレイヤーモードを開始 - 最適化版（エラーハンドリング強化）
  const handleOpenFullPlayer = () => {
    // プリフェッチされたURL取得を高速化するため、タイムアウトを設定
    // 150ms以内にURLが取得できない場合はプロキシプレーヤーへ（超高速化）
    const startTime = performance.now();
    
    // 直近でエラーが発生していれば、直接iframeプレーヤーモードを使用
    if (videoError) {
      console.log('Recent video error detected, using iframe player');
      setDirectUrl(null); // 直接URLをクリア
      setIsFullPlayer(true);
      return;
    }
    
    // まずプリフェッチされたURLをチェック
    if (directUrl) {
      // 既にURLが取得できていれば即座にフルプレーヤーモードを開始
      console.log(`Using cached direct URL (ready in ${Math.round(performance.now() - startTime)}ms)`);
      setIsFullPlayer(true);
    } else {
      // URLがまだ取得できていなければ短時間待機
      console.log('Direct URL not available yet, waiting briefly...');
      
      // 最大150msまで待機（読み込み高速化）
      const waitTimeout = setTimeout(() => {
        console.log(`URL wait timeout reached after ${Math.round(performance.now() - startTime)}ms - using proxy player`);
        setIsFullPlayer(true);
      }, 150);
      
      // その間に取得できた場合はタイムアウトをキャンセル
      const checkInterval = setInterval(() => {
        if (directUrl) {
          clearTimeout(waitTimeout);
          clearInterval(checkInterval);
          console.log(`Direct URL became available in ${Math.round(performance.now() - startTime)}ms`);
          setIsFullPlayer(true);
        }
      }, 30); // 更に細かくチェック
      
      // 安全のため、どちらにしても最大150ms後に画面を表示する
      setTimeout(() => {
        clearInterval(checkInterval);
      }, 150);
    }
  };
  
  // フルプレイヤーモードを終了
  const handleCloseFullPlayer = () => {
    setIsFullPlayer(false);
    
    // 直接再生の場合、ビデオを一時停止
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const handleRefresh = () => {
    // Reload the iframe
    setPlaybackError(false);
    setIsLoading(true);
    setVideoLoaded(false);
    setVideoError(false);
    
    // Add a random query parameter to force reload
    if (iframeRef.current) {
      const timestamp = new Date().getTime();
      iframeRef.current.src = `${videoPlayerUrl}?t=${timestamp}`;
    }
    
    // 直接URLも再取得 (タイムアウト付き高速化版)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort(); // タイムアウト処理
        } catch (abortError) {
          console.error('Error aborting controller:', abortError);
        }
      }, 3000); // 3秒でタイムアウト
      
      // フェッチリクエスト
      fetch(`/api/youtube/get-direct-urls/${videoId}`, {
        credentials: 'include',
        signal: controller.signal
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Error fetching: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          // 複数のレスポース形式に対応
          let url = null;
          if (data && data.source && data.source.url) {
            url = data.source.url;
          } else if (data && data.url) {
            url = data.url;
          } else if (data && data.formats && data.formats.length > 0) {
            url = data.formats[0].url;
          }
          
          if (url) {
            setDirectUrl(url);
            console.log('Updated direct URL after refresh:', url.substring(0, 100) + "...");
          }
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            console.error('Error refreshing direct URL:', error);
          } else {
            console.warn('Direct URL refresh timed out');
          }
        })
        .finally(() => {
          clearTimeout(timeoutId);
        });
    } catch (initError) {
      console.error('Error initializing fetch request:', initError);
    }
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleIframeError = () => {
    setPlaybackError(true);
    setIsLoading(false);
  };

  // 指定されたURLを直接埋め込むモードへ
  const embedDirectUrl = () => {
    if (directUrl) {
      // 直接URLをvideoタグのsrc属性に設定して再生する
      // 既に設定されているので確認メッセージだけ表示
      alert('googlevideo.comの直接URLを使用して再生中です。他の端末でも使用したい場合は右クリックでURLをコピーできます。');
    } else {
      alert('直接URLはまだ取得できていません。少し待ってから再試行してください。');
    }
  };
  
  // フルプレイヤーモード
  if (isFullPlayer) {
    return (
      <div className="fixed inset-0 w-full h-full bg-black z-50 flex flex-col">
        <div className="bg-black text-white p-2 flex justify-between items-center">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleCloseFullPlayer}
            className="text-white hover:text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />戻る
          </Button>
          <div className="truncate mx-2 text-sm">
            {videoInfo?.title || 'ビデオを再生中...'}
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleCloseFullPlayer}
            className="text-white hover:text-white hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 relative overflow-hidden bg-black">
          {/* ここで両方の要素を常に保持し、表示/非表示を切り替える - これにより読み込みが高速化 */}
          {/* 直接URLがある場合はvideoタグを表示、そうでない場合はiframeを表示 */}
          <div className={`absolute inset-0 w-full h-full ${directUrl ? 'block' : 'hidden'}`}>
            <video
              ref={videoRef}
              src={directUrl || ''}
              className="w-full h-full object-contain"
              controls
              autoPlay
              crossOrigin="anonymous"
              playsInline
              data-webkit-playsinline="true"
              data-x5-playsinline="true"
              data-x5-video-player-type="h5"
              data-x5-video-player-fullscreen="true"
              preload="auto"
              onLoadedData={() => {
                console.log('Video loaded successfully');
                setVideoLoaded(true);
                setVideoError(false);
              }}
              onLoadStart={() => {
                console.log('Video load started');
              }}
              onCanPlay={() => {
                console.log('Video can be played now');
              }}
              onError={(e) => {
                console.error('Direct URL playback error:', e);
                setVideoError(true);
                setVideoLoaded(false);
                
                // エラー発生時は自動的にiframeに切り替えず、ユーザーに選択肢を提示
                
                // エラー状況のログ詳細
                try {
                  const videoElement = e.target as HTMLVideoElement;
                  console.warn(`Video error details: network=${videoElement.networkState}, ready=${videoElement.readyState}, error=${videoElement.error?.code}`);
                  
                  // エラーコードによる詳細情報
                  if (videoElement.error) {
                    const errorCodes = {
                      1: 'MEDIA_ERR_ABORTED - ユーザーによって中断されました',
                      2: 'MEDIA_ERR_NETWORK - ネットワークエラーが発生しました',
                      3: 'MEDIA_ERR_DECODE - メディアの復号化に失敗しました',
                      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - メディアソースが見つからないかサポートされていません'
                    };
                    const errorText = errorCodes[videoElement.error.code as 1|2|3|4] || '不明なエラー';
                    console.error(`詳細エラー: ${errorText}`);
                    
                    // CORS対応のため、再試行を実装
                    // 特定のエラーコードの場合、CORS対応URLに変換して再試行
                    if (videoElement.error.code === 4 && directUrl) {
                      console.log('CORS関連エラーの可能性、URLを修正して再試行します');
                      try {
                        // URLにoriginパラメータを追加
                        const urlObj = new URL(directUrl);
                        const params = new URLSearchParams(urlObj.search);
                        params.set('origin', 'https://www.youtube.com');
                        urlObj.search = params.toString();
                        
                        // 同じvideoElementに新しいURLを設定
                        setTimeout(() => {
                          try {
                            if (videoRef.current) {
                              videoRef.current.src = urlObj.toString();
                              videoRef.current.load();
                            }
                          } catch (reloadError) {
                            console.error('URL再設定エラー:', reloadError);
                          }
                        }, 500);
                      } catch (urlError) {
                        console.error('URL処理エラー:', urlError);
                      }
                    }
                  }
                } catch (logError) {
                  console.error('Error logging video error details', logError);
                }
              }}
            >
              お使いのブラウザは動画の再生をサポートしていません。
            </video>
            
            {/* エラー発生時の代替再生オプション - フルスクリーンプレーヤー用 */}
            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80 z-10">
                <div className="text-center p-4 max-w-md">
                  <div className="text-red-400 mb-3 text-4xl">⚠️</div>
                  <h3 className="text-white text-lg mb-2">再生エラーが発生しました</h3>
                  <p className="text-white/70 mb-4">この動画は現在の再生方法では視聴できないようです。</p>
                  <div className="flex flex-col gap-3">
                    <Button 
                      variant="default"
                      onClick={() => {
                        setVideoError(false);
                        setDirectUrl(null);
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />iframeプレーヤーで再生
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1 bg-black/60 text-white border-gray-700"
                        onClick={() => openUrl(`/api/youtube/proxy-player/${videoId}?autoplay=1`)}
                      >
                        <Maximize className="h-4 w-4 mr-1" />新しいタブで開く
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 bg-black/60 text-white border-gray-700"
                        onClick={openAndroidPlayer}
                      >
                        <Smartphone className="h-4 w-4 mr-1" />Android向けプレーヤー
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 bg-black/60 text-white border-gray-700"
                        onClick={openIFilterPlayer}
                      >
                        <Shield className="h-4 w-4 mr-1" />iFilter対応
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 bg-black/60 text-white border-gray-700"
                        onClick={openProxyVideoPlayer}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />プロキシ再生
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`absolute inset-0 w-full h-full ${!directUrl ? 'block' : 'hidden'}`}>
            <iframe
              src={videoPlayerUrl}
              className="w-full h-full border-0"
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
        
        <div className="bg-gray-900 text-white p-2 flex justify-between items-center">
          <div className="text-sm">
            {videoInfo?.channelTitle && (
              <span className="text-gray-300">{videoInfo.channelTitle}</span>
            )}
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-white border-gray-700 hover:bg-gray-800"
                >
                  <Download className="h-4 w-4 mr-1" />ダウンロード
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>動画をダウンロード</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '1080p')}>
                    <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                    <span>1080p (高画質)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '720p')}>
                    <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                    <span>720p (標準画質)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '480p')}>
                    <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                    <span>480p (低画質)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '360p')}>
                    <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                    <span>360p (最低画質)</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>音声のみをダウンロード</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => handleDirectDownload('mp3', '320')}>
                  <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                  <span>MP3 - 320kbps (高音質)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDirectDownload('mp3', '128')}>
                  <Check className="mr-2 h-4 w-4 text-green-500 opacity-0" />
                  <span>MP3 - 128kbps (標準音質)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={openAndroidPlayer}
              className="text-white border-gray-700 hover:bg-gray-800"
            >
              <Smartphone className="h-4 w-4 mr-1" />Android再生
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={openIFilterPlayer}
              className="text-white border-gray-700 hover:bg-gray-800"
            >
              <Shield className="h-4 w-4 mr-1" />iFilter
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={openProxyVideoPlayer}
              className="text-white border-gray-700 hover:bg-gray-800"
            >
              <RefreshCw className="h-4 w-4 mr-1" />プロキシ
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleShare}
              className="text-white border-gray-700 hover:bg-gray-800"
            >
              <Share className="h-4 w-4 mr-1" />共有
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 通常プレイヤー
  return (
    <div className="mb-6 fade-in">
      <Card className="overflow-hidden">
        <div className="relative pt-[56.25%] bg-black">
          {isLoading ? (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-neutral-800">
              <div className="text-center">
                <Loader className="h-12 w-12 text-white mb-3 animate-spin" />
                <p className="text-white">動画を読み込み中...</p>
              </div>
            </div>
          ) : playbackError ? (
            <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-neutral-800">
              <div className="text-center p-4">
                <div className="text-red-400 mb-2 text-5xl">😢</div>
                <h3 className="text-white text-lg mb-2">再生エラー</h3>
                <p className="text-white/70 mb-4 text-sm">動画を再生できませんでした。</p>
                <div className="flex space-x-2 justify-center">
                  <Button 
                    variant="default" 
                    onClick={() => openUrl(`/api/youtube/proxy-player/${videoId}?autoplay=1`)}
                    size="sm"
                  >
                    <Play className="h-4 w-4 mr-1" />別タブで開く
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={openProxyVideoPlayer}
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />プロキシで開く
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRefresh}
                    size="sm"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />もう一度試す
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-1" />ダウンロード
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>動画をダウンロード</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '1080p')}>
                          <span>1080p (高画質)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '720p')}>
                          <span>720p (標準画質)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '480p')}>
                          <span>480p (低画質)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDirectDownload('mp4', '360p')}>
                          <span>360p (最低画質)</span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>音声のみをダウンロード</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem onClick={() => handleDirectDownload('mp3', '320')}>
                        <span>MP3 - 320kbps (高音質)</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDirectDownload('mp3', '128')}>
                        <span>MP3 - 128kbps (標準音質)</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute top-0 left-0 w-full h-full">
              {/* ミニプレーヤーはプロキシプレーヤーと同じ再生方法を使用 */}
              <iframe
                ref={iframeRef}
                src={videoPlayerUrl}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onError={handleIframeError}
              ></iframe>
              

            </div>
          )}
        </div>
        
        {videoInfo && (
          <div className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium">{videoInfo.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {videoInfo.viewCount && (
                    <span className="mr-2">再生回数 {parseInt(videoInfo.viewCount).toLocaleString()}</span>
                  )}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="default" 
                  onClick={() => onDownload(videoId)}
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-1" />ダウンロード
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => openUrl(`/api/youtube/proxy-video/${videoId}`)}
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />プロキシで再生
                </Button>
              </div>
            </div>
            
            {/* 動画情報 */}
            <div className="mt-4">
              <div className="flex items-center">
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{videoInfo.channelTitle}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}