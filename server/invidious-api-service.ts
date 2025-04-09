/**
 * Invidious API サービス
 * 
 * このモジュールでは、Invidious API を使用してYouTube動画情報を取得します。
 * より安定したサービスを提供するために、複数のInvidiousインスタンスを使用します。
 */

import axios from 'axios';
import { storage } from './storage';
import { VideoFormat, VideoDetails, VideoInfo } from './ytdlp-service';

// 利用可能なInvidiousインスタンス一覧（公開されている安定したインスタンス）
// 2025年4月7日時点で動作確認済みのインスタンスリスト
const INVIDIOUS_INSTANCES = [
  // 最も安定したインスタンス
  'https://invidious.slipfox.xyz',  // 非常に安定
  'https://inv.tux.pizza',          // 高速で信頼性が高い
  'https://invidious.lunar.icu',    // 優れたパフォーマンス
  'https://iv.nboeck.de',           // 高い安定性
  'https://invidious.private.coffee', // 信頼性が高い
  'https://invidious.dhusch.de',    // 優れた応答性
  // 信頼性のあるバックアップインスタンス
  'https://invidious.protokolla.fi',
  'https://iv.ggtyler.dev',
  'https://invidious.asir.dev',
  'https://yt.drgnz.club',
  'https://iv.melmac.space',
  'https://iv.arda.town',
  // 追加のバックアップ
  'https://invidious.privacydev.net',
  'https://vid.puffyan.us',
  'https://y.com.sb',
  // 最終フォールバック (人気だが時々過負荷)
  'https://yewtu.be'
];

// タイムアウト設定（15秒に延長）
const TIMEOUT = 15000;

// ユーザーエージェント
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

// ランダムなインスタンスURLを取得
function getRandomInstance(): string {
  const index = Math.floor(Math.random() * INVIDIOUS_INSTANCES.length);
  return INVIDIOUS_INSTANCES[index];
}

/**
 * 複数のインスタンスにリクエストを試みて最初に成功したレスポンスを返す
 */
async function fetchWithRetry(videoId: string, maxAttempts: number = 3): Promise<any> {
  const instances = [...INVIDIOUS_INSTANCES];
  // 順番をシャッフル
  for (let i = instances.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [instances[i], instances[j]] = [instances[j], instances[i]];
  }

  let lastError = null;
  let attemptCount = 0;

  // 指定された回数まで異なるインスタンスを試す
  while (attemptCount < maxAttempts && instances.length > 0) {
    const instance = instances.shift() as string;
    attemptCount++;
    
    try {
      console.log(`Trying Invidious instance ${instance} for videoId ${videoId} (attempt ${attemptCount}/${maxAttempts})`);
      const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: TIMEOUT
      });
      
      if (response.status === 200 && response.data) {
        console.log(`Successfully fetched data from ${instance} for videoId ${videoId}`);
        return response.data;
      }
    } catch (error) {
      console.error(`Error fetching from ${instance} for videoId ${videoId}:`, error instanceof Error ? error.message : error);
      lastError = error;
    }
  }
  
  // すべてのインスタンスが失敗した場合
  throw new Error(`All Invidious instances failed after ${attemptCount} attempts: ${lastError instanceof Error ? lastError.message : 'Unknown error'}`);
}

/**
 * Invidious API を使用して動画情報を取得
 */
export async function getVideoInfoFromInvidious(videoId: string): Promise<VideoInfo> {
  try {
    // Invidious API からデータを取得
    const data = await fetchWithRetry(videoId);
    
    // 動画のフォーマット情報を抽出
    const formats: VideoFormat[] = [];
    
    // 適応ストリーミングフォーマット（DASH）
    if (data.adaptiveFormats) {
      for (const format of data.adaptiveFormats) {
        // フォーマットタイプを判定
        const isVideo = format.type?.includes('video/');
        const isAudio = format.type?.includes('audio/');
        
        // MIMEタイプとコンテナ形式を抽出
        let mimeType = format.type || '';
        let container = 'mp4';
        
        if (mimeType.includes('webm')) {
          container = 'webm';
        } else if (mimeType.includes('mp4')) {
          container = 'mp4';
        }
        
        // 品質ラベルを構築
        let qualityLabel = format.quality || '';
        if (format.qualityLabel) {
          qualityLabel = format.qualityLabel;
        } else if (isVideo && format.height) {
          qualityLabel = `${format.height}p`;
        } else if (isAudio) {
          qualityLabel = `Audio ${Math.round((format.bitrate || 0) / 1000)}kbps`;
        }
        
        formats.push({
          url: format.url,
          mimeType: mimeType,
          qualityLabel: qualityLabel,
          hasAudio: isAudio,
          hasVideo: isVideo,
          container: container,
          contentLength: format.contentLength?.toString(),
          bitrate: format.bitrate,
          width: format.width,
          height: format.height,
          cacheTimestamp: Date.now()
        });
      }
    }
    
    // 通常の形式（非DASH）
    if (data.formatStreams) {
      for (const format of data.formatStreams) {
        let mimeType = 'video/mp4';
        let container = 'mp4';
        
        if (format.type?.includes('webm')) {
          mimeType = 'video/webm';
          container = 'webm';
        }
        
        formats.push({
          url: format.url,
          mimeType: mimeType,
          qualityLabel: format.qualityLabel || format.quality || '',
          hasAudio: true,
          hasVideo: true,
          container: container,
          contentLength: format.contentLength?.toString(),
          bitrate: format.bitrate,
          width: format.width,
          height: format.height,
          cacheTimestamp: Date.now()
        });
      }
    }
    
    // 動画詳細情報を構築
    const videoDetails: VideoDetails = {
      title: data.title || 'Unknown Title',
      description: data.description || '',
      lengthSeconds: data.lengthSeconds?.toString() || '0',
      thumbnailUrl: data.videoThumbnails?.find((t: any) => t.quality === 'maxres')?.url || 
                   data.videoThumbnails?.[0]?.url || 
                   `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelTitle: data.author || 'Unknown Channel',
      viewCount: data.viewCount?.toString() || '0'
    };
    
    // ストレージに保存
    try {
      await storage.saveVideo({
        videoId: videoId,
        title: videoDetails.title,
        channelTitle: videoDetails.channelTitle || 'Unknown Channel',
        description: videoDetails.description || '',
        thumbnailUrl: videoDetails.thumbnailUrl,
        publishedAt: data.published ? new Date(data.published * 1000).toISOString() : new Date().toISOString(),
        duration: videoDetails.lengthSeconds,
        viewCount: videoDetails.viewCount
      });
    } catch (error) {
      console.error(`Failed to save video ${videoId} to storage:`, error);
    }
    
    return {
      formats,
      videoDetails
    };
  } catch (error) {
    console.error(`Error getting video info from Invidious for ${videoId}:`, error);
    throw error;
  }
}

/**
 * 指定された動画IDの視聴可能なフォーマット一覧を取得
 */
export async function getFormatsFromInvidious(videoId: string): Promise<VideoInfo> {
  return await getVideoInfoFromInvidious(videoId);
}

/**
 * 検索機能 - Invidious APIを使用してYouTube動画を検索
 */
export async function searchVideosWithInvidious(query: string, maxResults: number = 20): Promise<any[]> {
  try {
    const instance = getRandomInstance();
    console.log(`Searching videos with query "${query}" using Invidious instance ${instance}`);
    
    const response = await axios.get(`${instance}/api/v1/search`, {
      params: {
        q: query,
        type: 'video',
        sort_by: 'relevance',
        page: 1
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: TIMEOUT
    });
    
    if (response.status !== 200 || !response.data) {
      throw new Error(`Failed to get search results: ${response.status}`);
    }
    
    // 検索結果を整形し、YouTube API互換のフォーマットに変換
    const results = response.data.slice(0, maxResults).map((item: any) => ({
      kind: 'youtube#searchResult',
      id: { kind: 'youtube#video', videoId: item.videoId },
      snippet: {
        title: item.title || 'Unknown Title',
        description: item.description || '',
        thumbnails: {
          default: { url: item.videoThumbnails?.find((t: any) => t.quality === 'default')?.url || `https://i.ytimg.com/vi/${item.videoId}/default.jpg` },
          medium: { url: item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` },
          high: { url: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` }
        },
        channelTitle: item.author || 'Unknown Channel',
        publishedAt: item.published ? new Date(item.published * 1000).toISOString() : new Date().toISOString()
      },
      contentDetails: { duration: item.lengthSeconds ? `PT${Math.floor(item.lengthSeconds / 60)}M${item.lengthSeconds % 60}S` : 'PT0M0S' },
      statistics: { viewCount: item.viewCount?.toString() || '0' }
    }));
    
    return results;
  } catch (error) {
    console.error(`Error searching videos with Invidious:`, error);
    throw error;
  }
}

/**
 * 人気動画取得 - Invidiousの人気動画APIを使用
 */
export async function getTrendingVideosFromInvidious(maxResults: number = 20, region: string = 'JP'): Promise<any[]> {
  try {
    const instance = getRandomInstance();
    console.log(`Getting trending videos from Invidious instance ${instance}`);
    
    const response = await axios.get(`${instance}/api/v1/trending`, {
      params: {
        region: region,
        type: 'default'
      },
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      },
      timeout: TIMEOUT
    });
    
    if (response.status !== 200 || !response.data) {
      throw new Error(`Failed to get trending videos: ${response.status}`);
    }
    
    // レスポンスデータが配列かどうかを確認
    if (!Array.isArray(response.data)) {
      console.error('Unexpected response format from Invidious API:', typeof response.data);
      console.log('Response data sample:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Unexpected response format from Invidious API');
    }
    
    // 結果を整形
    const results = response.data.slice(0, maxResults).map((item: any) => ({
      kind: 'youtube#video',
      id: item.videoId,
      snippet: {
        title: item.title || 'Unknown Title',
        description: item.description || '',
        thumbnails: {
          default: { url: item.videoThumbnails?.find((t: any) => t.quality === 'default')?.url || `https://i.ytimg.com/vi/${item.videoId}/default.jpg` },
          medium: { url: item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` },
          high: { url: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` }
        },
        channelTitle: item.author || 'Unknown Channel',
        publishedAt: item.published ? new Date(item.published * 1000).toISOString() : new Date().toISOString()
      },
      contentDetails: { duration: item.lengthSeconds ? `PT${Math.floor(item.lengthSeconds / 60)}M${item.lengthSeconds % 60}S` : 'PT0M0S' },
      statistics: { viewCount: item.viewCount?.toString() || '0' }
    }));
    
    return results;
  } catch (error) {
    console.error(`Error getting trending videos from Invidious:`, error);
    
    // 代替インスタンスでの試行
    try {
      const fallbackInstance = getRandomInstance();
      if (fallbackInstance) {
        console.log(`Trying fallback Invidious instance ${fallbackInstance}`);
        
        const response = await axios.get(`${fallbackInstance}/api/v1/trending`, {
          params: {
            region: region,
            type: 'default'
          },
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
          },
          timeout: TIMEOUT
        });
        
        if (response.status === 200 && Array.isArray(response.data)) {
          const results = response.data.slice(0, maxResults).map((item: any) => ({
            kind: 'youtube#video',
            id: item.videoId,
            snippet: {
              title: item.title || 'Unknown Title',
              description: item.description || '',
              thumbnails: {
                default: { url: item.videoThumbnails?.find((t: any) => t.quality === 'default')?.url || `https://i.ytimg.com/vi/${item.videoId}/default.jpg` },
                medium: { url: item.videoThumbnails?.find((t: any) => t.quality === 'medium')?.url || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` },
                high: { url: item.videoThumbnails?.find((t: any) => t.quality === 'high')?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` }
              },
              channelTitle: item.author || 'Unknown Channel',
              publishedAt: item.published ? new Date(item.published * 1000).toISOString() : new Date().toISOString()
            },
            contentDetails: { duration: item.lengthSeconds ? `PT${Math.floor(item.lengthSeconds / 60)}M${item.lengthSeconds % 60}S` : 'PT0M0S' },
            statistics: { viewCount: item.viewCount?.toString() || '0' }
          }));
          
          return results;
        }
      }
    } catch (fallbackError) {
      console.error(`Fallback Invidious instance also failed:`, fallbackError);
    }
    
    // モックデータの代わりに空の配列を返す
    console.log('All Invidious instances failed, returning empty array');
    return [];
  }
}