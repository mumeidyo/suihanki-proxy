import { MusicTrack } from "../types/music";

// ローカルストレージのキー
const FAVORITES_KEY = 'youtube_music_favorites';
const PLAYLISTS_KEY = 'youtube_music_playlists';

// プレイリストの型定義
export interface Playlist {
  id: string;
  name: string;
  tracks: MusicTrack[];
  createdAt: string;
  updatedAt: string;
}

// お気に入り曲を取得
export function getFavorites(): MusicTrack[] {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('お気に入りの取得に失敗しました:', error);
    return [];
  }
}

// お気に入りに曲を追加
export function addToFavorites(track: MusicTrack): MusicTrack[] {
  try {
    const favorites = getFavorites();
    // 重複を防ぐため、既に存在するかチェック
    const exists = favorites.some(t => t.id === track.id);
    
    if (!exists) {
      const newFavorites = [...favorites, track];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    }
    
    return favorites;
  } catch (error) {
    console.error('お気に入りの追加に失敗しました:', error);
    return getFavorites();
  }
}

// お気に入りから曲を削除
export function removeFromFavorites(trackId: string): MusicTrack[] {
  try {
    const favorites = getFavorites();
    const newFavorites = favorites.filter(track => track.id !== trackId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
    return newFavorites;
  } catch (error) {
    console.error('お気に入りの削除に失敗しました:', error);
    return getFavorites();
  }
}

// 曲がお気に入りに存在するかチェック
export function isInFavorites(trackId: string): boolean {
  try {
    const favorites = getFavorites();
    return favorites.some(track => track.id === trackId);
  } catch (error) {
    console.error('お気に入りのチェックに失敗しました:', error);
    return false;
  }
}

// 全プレイリストを取得
export function getPlaylists(): Playlist[] {
  try {
    const data = localStorage.getItem(PLAYLISTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('プレイリストの取得に失敗しました:', error);
    return [];
  }
}

// プレイリストを作成
export function createPlaylist(name: string): Playlist[] {
  try {
    const playlists = getPlaylists();
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      tracks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updatedPlaylists = [...playlists, newPlaylist];
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updatedPlaylists));
    return updatedPlaylists;
  } catch (error) {
    console.error('プレイリストの作成に失敗しました:', error);
    return getPlaylists();
  }
}

// プレイリストを削除
export function deletePlaylist(playlistId: string): Playlist[] {
  try {
    const playlists = getPlaylists();
    const updatedPlaylists = playlists.filter(playlist => playlist.id !== playlistId);
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updatedPlaylists));
    return updatedPlaylists;
  } catch (error) {
    console.error('プレイリストの削除に失敗しました:', error);
    return getPlaylists();
  }
}

// プレイリストに曲を追加
export function addTrackToPlaylist(playlistId: string, track: MusicTrack): Playlist[] {
  try {
    const playlists = getPlaylists();
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        // 重複を防ぐためチェック
        const trackExists = playlist.tracks.some(t => t.id === track.id);
        if (!trackExists) {
          return {
            ...playlist,
            tracks: [...playlist.tracks, track],
            updatedAt: new Date().toISOString()
          };
        }
      }
      return playlist;
    });
    
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updatedPlaylists));
    return updatedPlaylists;
  } catch (error) {
    console.error('プレイリストへの曲の追加に失敗しました:', error);
    return getPlaylists();
  }
}

// プレイリストから曲を削除
export function removeTrackFromPlaylist(playlistId: string, trackId: string): Playlist[] {
  try {
    const playlists = getPlaylists();
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          tracks: playlist.tracks.filter(track => track.id !== trackId),
          updatedAt: new Date().toISOString()
        };
      }
      return playlist;
    });
    
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updatedPlaylists));
    return updatedPlaylists;
  } catch (error) {
    console.error('プレイリストからの曲の削除に失敗しました:', error);
    return getPlaylists();
  }
}

// プレイリスト名を変更
export function renamePlaylist(playlistId: string, newName: string): Playlist[] {
  try {
    const playlists = getPlaylists();
    const updatedPlaylists = playlists.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          name: newName,
          updatedAt: new Date().toISOString()
        };
      }
      return playlist;
    });
    
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(updatedPlaylists));
    return updatedPlaylists;
  } catch (error) {
    console.error('プレイリスト名の変更に失敗しました:', error);
    return getPlaylists();
  }
}

// 特定のプレイリストを取得
export function getPlaylistById(playlistId: string): Playlist | undefined {
  try {
    const playlists = getPlaylists();
    return playlists.find(playlist => playlist.id === playlistId);
  } catch (error) {
    console.error('プレイリストの取得に失敗しました:', error);
    return undefined;
  }
}