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