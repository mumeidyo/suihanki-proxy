import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, X, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MusicTrack } from '@/types/music';
import { addToFavorites, removeFromFavorites, isInFavorites } from '@/lib/localStorageUtils';

// グローバル型定義はtypes/music.tsに移動

interface MusicPlayerProps {
  trackId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export default function MusicPlayer({ 
  trackId, 
  title, 
  artist, 
  thumbnailUrl, 
  onClose,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false
}: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekerRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  
  // 初回ロード時にお気に入りステータスをチェック
  useEffect(() => {
    setIsFavorite(isInFavorites(trackId));
  }, [trackId]);
  
  // 再生/一時停止の切り替え
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };
  
  // シーク処理（プログレスバーのクリック）
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (seekerRef.current && audioRef.current) {
      const rect = seekerRef.current.getBoundingClientRect();
      const seekPos = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = seekPos * duration;
    }
  };
  
  // ボリューム調整
  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    if (volumeRef.current && audioRef.current) {
      const rect = volumeRef.current.getBoundingClientRect();
      const volumeValue = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(volumeValue);
      audioRef.current.volume = volumeValue;
      if (volumeValue > 0 && isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };
  
  // ミュート切り替え
  const toggleMute = () => {
    if (audioRef.current) {
      const newMuteState = !isMuted;
      setIsMuted(newMuteState);
      audioRef.current.muted = newMuteState;
    }
  };
  
  // 時間表示のフォーマット（mm:ss）
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // 10秒戻る
  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };
  
  // 10秒進む
  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 10);
    }
  };
  
  // お気に入り切り替え
  const toggleFavorite = () => {
    console.log('toggleFavorite called', { trackId, title, artist, isFavorite });
    
    const track: MusicTrack = {
      id: trackId,
      title,
      artist,
      thumbnailUrl,
      duration: formatTime(duration),
      source: 'youtube_music',
      sourceId: trackId
    };
    
    try {
      if (isFavorite) {
        console.log('Removing from favorites', trackId);
        removeFromFavorites(trackId);
        setIsFavorite(false);
        toast({
          title: "お気に入りから削除しました",
          description: `"${title}" をお気に入りから削除しました`,
          duration: 2000,
        });
      } else {
        console.log('Adding to favorites', track);
        addToFavorites(track);
        setIsFavorite(true);
        toast({
          title: "お気に入りに追加しました",
          description: `"${title}" をお気に入りに追加しました`,
          duration: 2000,
        });
      }
      console.log('Favorites operation completed');
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };
  
  // 音声ソースの取得と読み込み処理
  useEffect(() => {
    // 曲が変更されたら読み込み状態にリセット
    setIsLoading(true);
    setError(null);
    
    // 直接URLを取得 (最適なフォーマットを選択)
    const getDirectAudioUrl = async () => {
      try {
        // 信頼性の高い直接のストリーミングエンドポイントを使用
        if (audioRef.current) {
          setIsLoading(true);
          
          // サーバー側に音声を保存→音声を流す→次の曲に行ったらそのファイルは削除
          console.log('Using cached-audio endpoint for', trackId);
          
          // プレイリスト内の次の曲IDを取得（先読み用）
          let nextTrackId: string | undefined;
          if (hasNext && onNext && window.musicPlayerState && window.musicPlayerState.currentPlaylist) {
            const playlist = window.musicPlayerState.currentPlaylist;
            const currentIndex = playlist.findIndex((item: any) => item.id === trackId);
            if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
              nextTrackId = playlist[currentIndex + 1].id;
              console.log('Next track detected for preloading:', nextTrackId);
            }
          }
          
          // 次の曲の情報をクエリパラメータとして渡す（先読み用）
          const cachedAudioUrl = nextTrackId 
            ? `/api/youtube/cached-audio/${trackId}?next=${nextTrackId}`
            : `/api/youtube/cached-audio/${trackId}`;
            
          audioRef.current.src = cachedAudioUrl;
          audioRef.current.load();
        } else {
          throw new Error('Audio element not found');
        }
      } catch (err) {
        console.error('音声URLの取得に失敗しました:', err);
        setIsLoading(false);
        setError('音声の取得に失敗しました。別の曲を試してください。');
        
        // エラー発生時、次の曲があれば自動的に移動
        if (hasNext && onNext) {
          setTimeout(() => {
            console.log('再生エラーのため次の曲に移動します');
            if (onNext) onNext();
          }, 1000);
        }
      }
    };
    
    getDirectAudioUrl();
    
    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [trackId, hasNext, onNext]);
  
  // オーディオ要素のイベント処理
  useEffect(() => {
    if (audioRef.current) {
      // メディアロード完了
      const handleLoadedMetadata = () => {
        setDuration(audioRef.current?.duration || 0);
        setIsLoading(false);
        
        // 再生開始
        if (audioRef.current) {
          audioRef.current.volume = volume;
          audioRef.current.play()
            .catch(err => {
              console.error('音声の再生に失敗しました:', err);
              setError('音声の再生に失敗しました。別の曲を試すか、ブラウザの設定を確認してください。');
            });
        }
      };
      
      // 再生状態の更新
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      
      // 時間の更新
      const handleTimeUpdate = () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      };
      
      // 曲の終了時に次の曲を再生
      const handleEnded = () => {
        console.log('曲の再生が終了しました');
        if (hasNext && onNext) {
          console.log('次の曲を再生します');
          // 少し遅延させて確実に実行されるようにする
          setTimeout(() => {
            if (onNext) onNext();
          }, 500);
        }
      };
      
      // エラー処理
      const handleError = (event: ErrorEvent) => {
        console.error("Audio element error:", event);
        setIsLoading(false);
        
        // キャッシュAPIが失敗したら、フォールバックとしてfast-playbackを試す
        if (audioRef.current && audioRef.current.src.includes('/api/youtube/cached-audio/')) {
          setError('キャッシュからの読み込みに失敗しました。別の方法を試します...');
          
          // fast-playbackエンドポイントを使用してみる
          const tryFastPlayback = async () => {
            try {
              const response = await fetch(`/api/youtube/fast-playback/${trackId}?audio=true`);
              if (response.ok) {
                const data = await response.json();
                if (data && data.url) {
                  console.log('Fallback: Fast playback URL obtained successfully');
                  audioRef.current!.src = data.url;
                  audioRef.current!.load();
                  return;
                }
              }
              // それでも失敗した場合は次の曲へ
              fallbackToNextTrack();
            } catch (e) {
              console.error('Fallback fast-playback failed:', e);
              fallbackToNextTrack();
            }
          };
          
          tryFastPlayback();
        } else {
          // すでにフォールバックを試したか、別の問題がある場合は次の曲へ
          fallbackToNextTrack();
        }
      };
      
      // 次の曲に移動するヘルパー関数
      const fallbackToNextTrack = () => {
        setError('音声の読み込みに失敗しました。別の曲を再生します...');
        if (hasNext && onNext) {
          // 短めの遅延で次の曲へ移動
          setTimeout(() => {
            console.log('再生エラーのため次の曲に移動します');
            if (onNext) onNext();
          }, 1000);
        } else {
          // 次の曲がない場合は再試行を提案
          setError('音声の読み込みに失敗しました。別の曲を選択してください。');
        }
      };
      
      // イベントリスナー登録
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('play', handlePlay);
      audioRef.current.addEventListener('pause', handlePause);
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
      
      // クリーンアップ
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audioRef.current.removeEventListener('play', handlePlay);
          audioRef.current.removeEventListener('pause', handlePause);
          audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.removeEventListener('error', handleError);
        }
      };
    }
  }, [volume, hasNext, onNext]);
  
  // シークバーとハンドルの位置を計算
  const seekerWidth = `${(currentTime / duration) * 100 || 0}%`;
  const seekerHandlePosition = `${(currentTime / duration) * 100 || 0}%`;
  
  return (
    <div className="fixed bottom-0 left-0 w-full bg-gray-800 dark:bg-gray-900 text-white shadow-lg p-3 z-50 border-t border-gray-700">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4 items-center">
        {/* 曲情報 */}
        <div className="col-span-3 flex items-center">
          <div className="w-12 h-12 rounded-md overflow-hidden mr-3 bg-zinc-800 flex-shrink-0">
            <img 
              src={`/api/proxy/direct?url=${encodeURIComponent(thumbnailUrl)}`} 
              alt={title} 
              className="w-full h-full object-cover"
              onError={(e) => (e.target as HTMLImageElement).src = "/api/proxy/default-thumbnail"}
            />
          </div>
          <div className="overflow-hidden">
            <h4 className="font-medium text-white text-sm truncate">{title}</h4>
            <p className="text-zinc-400 text-xs truncate">{artist}</p>
          </div>
        </div>
        
        {/* 再生コントロール */}
        <div className="col-span-6 flex flex-col items-center">
          <div className="flex items-center justify-center space-x-4 mb-1">
            {/* 前の曲ボタン */}
            <Button 
              variant="ghost" 
              size="sm" 
              className={`${hasPrev ? 'text-zinc-400 hover:text-white' : 'text-zinc-700'}`}
              onClick={onPrev}
              disabled={!hasPrev}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                <line x1="5" y1="19" x2="5" y2="5"></line>
              </svg>
            </Button>
            
            {/* 10秒戻るボタン */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-zinc-400 hover:text-white"
              onClick={skipBackward}
            >
              <SkipBack size={20} />
            </Button>
            
            {/* 再生/一時停止ボタン */}
            <Button 
              variant="ghost" 
              size="sm"
              className="text-white hover:text-white bg-primary hover:bg-primary/90 rounded-full w-10 h-10 p-0 flex items-center justify-center"
              onClick={togglePlay}
              disabled={isLoading || error !== null}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <Pause size={24} />
              ) : (
                <Play size={24} className="ml-1" />
              )}
            </Button>
            
            {/* 10秒進むボタン */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-zinc-400 hover:text-white"
              onClick={skipForward}
            >
              <SkipForward size={20} />
            </Button>
            
            {/* 次の曲ボタン */}
            <Button 
              variant="ghost" 
              size="sm" 
              className={`${hasNext ? 'text-zinc-400 hover:text-white' : 'text-zinc-700'}`}
              onClick={onNext}
              disabled={!hasNext}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
            </Button>
          </div>
          
          {/* シークバー */}
          <div className="w-full flex items-center space-x-2">
            <span className="text-xs text-zinc-400 min-w-[32px]">{formatTime(currentTime)}</span>
            
            <div 
              ref={seekerRef}
              className="music-player-seeker flex-1"
              onClick={handleSeek}
            >
              <div 
                className="music-player-seeker-fill" 
                style={{ width: seekerWidth }}
              />
              <div 
                className="music-player-seeker-handle" 
                style={{ left: seekerHandlePosition }}
              />
            </div>
            
            <span className="text-xs text-zinc-400 min-w-[32px]">{formatTime(duration)}</span>
          </div>
        </div>
        
        {/* 音量コントロールと閉じるボタン */}
        <div className="col-span-3 flex items-center justify-end space-x-4">
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white" onClick={toggleMute}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </Button>
            
            <div 
              ref={volumeRef}
              className="music-player-volume"
              onClick={handleVolumeChange}
            >
              <div 
                className="music-player-volume-fill" 
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
            </div>
          </div>
          
          {/* お気に入りボタン */}
          <Button
            variant="ghost"
            size="sm"
            className={`${isFavorite ? 'text-red-500 hover:text-red-600' : 'text-zinc-400 hover:text-white'}`}
            onClick={toggleFavorite}
          >
            <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </Button>
          
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white" onClick={onClose}>
            <X size={20} />
          </Button>
        </div>
      </div>
      
      {/* 非表示オーディオ要素（モバイルバックグラウンド再生対応） */}
      <audio 
        ref={audioRef}
        preload="metadata"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        x5-video-player-type="h5"
        style={{ display: 'none' }}
      />
      
      {/* エラーメッセージ */}
      {error && (
        <div className="max-w-7xl mx-auto mt-2 px-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}