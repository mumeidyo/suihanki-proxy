import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Share, Loader, RefreshCw, Play, ArrowLeft, Maximize, X, Check, Smartphone } from "lucide-react";
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
    controller: AbortController, 
    onSuccess: (url: string) => void,
    isMountedCheck: () => boolean
  ) => {
    try {
      const signal = controller.signal;
      
      console.log(`Fetching direct URL for ${currentVideoId}`);
      const startTime = performance.now();
      
      const response = await fetch(`/api/youtube/get-direct-urls/${currentVideoId}`, {
        credentials: 'include',
        signal
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching direct URL: ${response.status}`);
      }
      
      const data = await response.json();
      const endTime = performance.now();
      console.log(`Direct URL fetch completed in ${Math.round(endTime - startTime)}ms`);
      
      if (isMountedCheck() && data && data.source && data.source.url) {
        onSuccess(data.source.url);
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
    let controller = new AbortController(); // 明示的に初期化して型エラーを防止
    
    // 状態のリセットと更新
    if (videoId) {
      // 最初に状態をリセット（ただし直接URLはリセットしない）
      setIsLoading(true);
      setPlaybackError(false);
      
      // すぐにローディングを終了して次のビデオの準備をする
      const loadingTimer = setTimeout(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      }, 200); // より短い時間に設定（ユーザー体験向上）
      
      // 前回のリクエストがあれば中止
      controller.abort(); // 常に前のコントローラーを中止
      
      // 新しいAbortControllerを作成
      controller = new AbortController();

      // 別のタイマーで少し遅延させてからURLフェッチを開始
      // これにより、UIの更新が優先され、ユーザー体験が向上する
      const fetchTimer = setTimeout(() => {
        if (isMounted) {
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
        controller.abort(); // 常に中止可能なコントローラー
      };
    }
  }, [videoId]);

  // プレーヤーへのURL - プロキシプレーヤーを使用（学校環境での視聴対応）
  const videoPlayerUrl = `/api/youtube/proxy-player/${videoId}`;
  
  // フォールバックURL - ストリーミングAPIを使用（学校環境での視聴対応）
  const videoProxyUrl = `/api/youtube/stream-video/${videoId}`;
  
  // Android向け強化プレーヤーURL
  const androidPlayerUrl = `/api/youtube/android-player/${videoId}`;

  if (!videoId) {
    return <div className="mb-6"></div>;
  }

  // Android向け強化プレーヤーを開く
  const openAndroidPlayer = () => {
    if (videoId) {
      openUrl(androidPlayerUrl);
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
  
  // フルプレイヤーモードを開始 - 最適化版
  const handleOpenFullPlayer = () => {
    // プリフェッチされたURL取得を高速化するため、タイムアウトを設定
    // 150ms以内にURLが取得できない場合はプロキシプレーヤーへ（超高速化）
    const startTime = performance.now();
    
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
    
    // Add a random query parameter to force reload
    if (iframeRef.current) {
      const timestamp = new Date().getTime();
      iframeRef.current.src = `${videoProxyUrl}?t=${timestamp}`;
    }
    
    // 直接URLも再取得 (タイムアウト付き高速化版)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒でタイムアウト
    
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
        if (data && data.source && data.source.url) {
          setDirectUrl(data.source.url);
          console.log('Updated direct URL after refresh');
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
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const handleIframeError = () => {
    setPlaybackError(true);
    setIsLoading(false);
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
              className="w-full h-full"
              controls
              autoPlay
              playsInline
              data-webkit-playsinline="true"
              data-x5-playsinline="true"
              data-x5-video-player-type="h5"
              data-x5-video-player-fullscreen="true"
              preload="auto"
              onError={() => {
                console.error('Direct URL playback error');
                setDirectUrl(null);
              }}
            >
              お使いのブラウザは動画の再生をサポートしていません。
            </video>
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
            <>
              {/* ミニプレーヤーでも高速読み込み方式を使用 */}
              {directUrl ? (
                // 直接URLがある場合はHTML5 videoタグを使用 (高速)
                <video
                  className="absolute top-0 left-0 w-full h-full"
                  src={directUrl}
                  controls
                  autoPlay
                  playsInline
                  data-webkit-playsinline="true"
                  data-x5-playsinline="true"
                  data-x5-video-player-type="h5"
                  data-x5-video-player-fullscreen="true"
                  preload="auto"
                  onError={() => {
                    console.error('Direct URL mini-player error');
                    setDirectUrl(null);
                    // エラー時はiframeプレーヤーにフォールバック
                    if (iframeRef.current) {
                      iframeRef.current.src = videoProxyUrl;
                    }
                  }}
                />
              ) : (
                // 直接URLがない場合は従来のiframeプレーヤーを使用
                <iframe
                  ref={iframeRef}
                  className="absolute top-0 left-0 w-full h-full"
                  src={videoProxyUrl}
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  allowFullScreen
                  onError={handleIframeError}
                ></iframe>
              )}
              <div className="proxy-error-overlay absolute top-0 left-0 w-full h-full hidden items-center justify-center bg-neutral-800/90 z-10">
                <div className="text-center p-4">
                  <div className="text-red-400 mb-2 text-5xl">😕</div>
                  <h3 className="text-white text-lg mb-2">読み込みエラー</h3>
                  <p className="text-white/70 mb-4 text-sm">動画の読み込みに失敗しました。</p>
                  <div className="flex space-x-2 justify-center">
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
                          variant="default" 
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
              
              {/* プレビュー上にはフルスクリーンボタンを表示しない（二重表示防止） */}
            </>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-medium text-lg mb-2">{videoInfo?.title}</h2>
          <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
            <div>
              <p className="text-gray-600">{videoInfo?.channelTitle}</p>
              <div className="text-sm text-gray-500">
                {videoInfo?.viewCount && `${parseInt(videoInfo.viewCount).toLocaleString()} 回視聴`} 
                {videoInfo?.publishedAt && ` • ${formatPublishedDate(videoInfo.publishedAt)}`}
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => openUrl(`/api/youtube/proxy-player/${videoId}?autoplay=1`)}
              >
                <Play className="h-4 w-4 mr-1" />別タブで開く
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
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
                variant="secondary" 
                size="sm"
                onClick={openAndroidPlayer}
              >
                <Smartphone className="h-4 w-4 mr-1" />Android再生
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleShare}
              >
                <Share className="h-4 w-4 mr-1" />共有
              </Button>
            </div>
          </div>
          {videoInfo?.description && (
            <div className="border-t pt-3">
              <p className="text-gray-700 whitespace-pre-line line-clamp-3">
                {videoInfo.description}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
