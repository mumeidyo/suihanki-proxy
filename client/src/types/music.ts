// 音楽トラックの型定義
export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  thumbnailUrl: string;
  duration: string;
  source: 'youtube_music';
  sourceId: string;
}

// ウィンドウグローバル型の拡張（クライアント間で型の一貫性を確保）
declare global {
  interface Window {
    musicPlayerState?: {
      currentPlaylist?: MusicTrack[];
      currentIndex?: number;
      [key: string]: any;
    };
  }
}