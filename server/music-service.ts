import { Request, Response } from 'express';
import YTMusic from 'ytmusic-api';
import axios from 'axios';
import { storage } from './storage';
import ytdl from 'ytdl-core';
import ytSearch from 'yt-search';

// YTMusic API インスタンスの初期化
const ytmusic = new YTMusic();

// API初期化フラグ
let ytmusicInitialized = false;

/**
 * YTMusic APIを初期化する
 * 
 * Note: YTMusic-API は自動初期化されるため、明示的な initialize() 呼び出しは不要
 */
async function initializeYTMusic() {
  if (!ytmusicInitialized) {
    try {
      // YTMusic-APIは初期化メソッドを必要としない
      ytmusicInitialized = true;
      console.log('YTMusic API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize YTMusic API:', error);
      throw new Error('YouTube Music APIの初期化に失敗しました');
    }
  }
}

// Spotify APIは使用しないため関数を削除

/**
 * 曲を検索する
 * @param req Express request
 * @param res Express response
 */
export async function searchMusicTracks(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query.query as string;
    const source = req.query.source as string || 'youtube_music';
    
    if (!query) {
      res.status(400).json({ message: '検索クエリが必要です' });
      return;
    }
    
    let tracks = [];
    
    try {
      // YouTube Music検索
      const results = await ytSearch(query + ' official audio');
      
      tracks = results.videos.slice(0, 20).map((video: any) => ({
        id: video.videoId,
        title: video.title,
        artist: video.author?.name || '不明',
        thumbnailUrl: video.thumbnail || '',
        duration: video.duration?.toString() || '0',
        source: 'youtube_music' as const,
        sourceId: video.videoId
      }));
    } catch (error) {
      console.error('Error with YouTube Music search:', error);
      // エラー時は一般的なYouTube検索を使用
      tracks = await searchTracksWithYouTube(query);
    }
    
    res.json({ tracks });
  } catch (error) {
    console.error('Music search error:', error);
    res.status(500).json({ message: '検索中にエラーが発生しました', error: (error as Error).message });
  }
}

/**
 * YouTube Musicで曲を検索
 */
async function searchTracksWithYouTubeMusic(query: string) {
  try {
    await initializeYTMusic();
    const results = await ytmusic.searchSongs(query);
    
    return results.map((track: any) => ({
      id: track.videoId,
      title: track.name,
      artist: track.artist ? track.artist.name : 
        (Array.isArray(track.artists) ? 
          track.artists.map((a: any) => a.name).join(', ') : '不明'),
      thumbnailUrl: track.thumbnails && track.thumbnails.length > 0 ? track.thumbnails[0]?.url || '' : '',
      duration: track.duration || '0',
      source: 'youtube_music' as const,
      sourceId: track.videoId
    }));
  } catch (error) {
    console.error('Error searching YouTube Music:', error);
    // フォールバック: 通常のYouTube検索を使用
    return await searchTracksWithYouTube(query + ' song');
  }
}

/**
 * 通常のYouTube検索で音楽を探す（フォールバック）
 */
async function searchTracksWithYouTube(query: string) {
  try {
    const results = await ytSearch(query);
    
    return results.videos.slice(0, 20).map((video: any) => ({
      id: video.videoId,
      title: video.title,
      artist: video.author?.name || '不明',
      thumbnailUrl: video.thumbnail || '',
      duration: video.duration?.toString() || '0',
      source: 'youtube_music' as const,
      sourceId: video.videoId
    }));
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return [];
  }
}

/**
 * YouTube Music トラックに対応するYouTube動画を見つける
 */
export async function findYouTubeForTrack(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query.query as string;
    
    if (!query) {
      res.status(400).json({ message: '検索クエリが必要です' });
      return;
    }
    
    // YouTubeで検索
    const results = await ytSearch(query + ' official audio');
    
    if (results.videos.length > 0) {
      const bestMatch = results.videos[0];
      res.json({ 
        videoId: bestMatch.videoId,
        title: bestMatch.title,
        author: bestMatch.author.name,
        duration: bestMatch.duration
      });
    } else {
      res.status(404).json({ message: '対応する動画が見つかりませんでした' });
    }
  } catch (error) {
    console.error('Error finding YouTube video:', error);
    res.status(500).json({ message: '検索中にエラーが発生しました', error: (error as Error).message });
  }
}

/**
 * 人気の曲を取得する
 */
export async function getPopularTracks(req: Request, res: Response): Promise<void> {
  try {
    let tracks = [];
    
    try {
      // 非公式API: 人気の曲をキーワード検索で代用
      const results = await ytSearch('top hits 2024 official audio');
      
      tracks = results.videos.slice(0, 20).map((video: any) => ({
        id: video.videoId,
        title: video.title,
        artist: video.author?.name || '不明',
        thumbnailUrl: video.thumbnail || '',
        duration: video.duration?.toString() || '0',
        source: 'youtube_music' as const,
        sourceId: video.videoId
      }));
    } catch (error) {
      console.error('Error getting popular tracks with unofficial method:', error);
      // フォールバック: 人気音楽で検索
      tracks = await searchTracksWithYouTube('top youtube music charts 2024');
    }
    
    res.json({ tracks });
  } catch (error) {
    console.error('Error getting popular tracks:', error);
    res.status(500).json({ message: '人気曲の取得中にエラーが発生しました', error: (error as Error).message });
  }
}

// Apple Music関連の機能は削除

/**
 * YouTube Musicから人気の曲を取得
 */
async function getPopularTracksWithYouTubeMusic() {
  try {
    await initializeYTMusic();
    // 注: ytmusic-apiにはgetCharts関数がないため、一般的な検索に置き換え
    const results = await ytmusic.searchSongs('popular music 2024');
    
    return results.slice(0, 20).map((track: any) => ({
      id: track.videoId,
      title: track.name,
      // YTMusic APIの構造に合わせて調整
      artist: Array.isArray(track.artists) 
        ? track.artists.map((a: any) => a.name).join(', ')
        : track.artist?.name || '',
      thumbnailUrl: Array.isArray(track.thumbnails) && track.thumbnails.length > 0 
        ? track.thumbnails[0]?.url || '' 
        : '',
      duration: typeof track.duration === 'string' ? track.duration : '0',
      source: 'youtube_music' as const,
      sourceId: track.videoId
    }));
  } catch (error) {
    console.error('Error getting popular tracks from YouTube Music:', error);
    // フォールバック：一般的な音楽ワードで検索
    return await searchTracksWithYouTube('popular music 2024');
  }
}

/**
 * アーティストの人気曲を取得
 */
export async function getArtistTracks(req: Request, res: Response): Promise<void> {
  try {
    const artistName = req.query.artist as string;
    
    if (!artistName) {
      res.status(400).json({ message: 'アーティスト名が必要です' });
      return;
    }
    
    let tracks = [];
    
    try {
      // 非公式API: アーティスト名で検索
      const results = await ytSearch(artistName + ' official audio');
      
      tracks = results.videos.slice(0, 20).map((video: any) => ({
        id: video.videoId,
        title: video.title,
        artist: video.author?.name || '不明',
        thumbnailUrl: video.thumbnail || '',
        duration: video.duration?.toString() || '0',
        source: 'youtube_music' as const,
        sourceId: video.videoId
      }));
    } catch (error) {
      console.error('Error getting artist tracks with unofficial method:', error);
      // フォールバック: 一般的なYouTube検索を使用
      tracks = await searchTracksWithYouTube(artistName);
    }
    
    res.json({ tracks });
  } catch (error) {
    console.error('Error getting artist tracks:', error);
    res.status(500).json({ message: 'アーティスト曲の取得中にエラーが発生しました', error: (error as Error).message });
  }
}

// YTMusic API初期化
try {
  // YTMusic APIを初期化する
  initializeYTMusic().catch((err: Error) => console.error('YTMusic initialization failed:', err));
} catch (error) {
  console.error('Error initializing music services:', error);
}