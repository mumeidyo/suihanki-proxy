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
  // Render環境か確認
  const isRender = process.env.RENDER === 'true' || process.cwd().includes('render');
  
  if (isRender) {
    // Render環境では最も安定したインスタンスのみを使用
    const reliableInstances = [
      'https://invidious.slipfox.xyz',
      'https://inv.tux.pizza',
      'https://invidious.lunar.icu',
      'https://iv.nboeck.de',
      'https://invidious.private.coffee'
    ];
    const index = Math.floor(Math.random() * reliableInstances.length);
    console.log(`Render環境向け: 安定インスタンス ${reliableInstances[index]} を使用`);
    return reliableInstances[index];
  } else {
    // 通常環境では全インスタンスを使用
    const index = Math.floor(Math.random() * INVIDIOUS_INSTANCES.length);
    return INVIDIOUS_INSTANCES[index];
  }
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
  // Render環境ではプリセットされた人気動画を使用
  const isRender = process.env.RENDER === 'true' || process.cwd().includes('render');

  // 試行する最大インスタンス数を増やす
  const maxInstancesToTry = isRender ? 5 : 3;
  // 取得する最大動画数を増やす
  const enhancedMaxResults = isRender ? maxResults * 2 : maxResults;

  // アクセスごとにランダムに別のリージョンも試す（より多様なビデオを取得するため）
  const regions = ['JP', 'US', 'GB', 'CA', 'DE', 'FR'];
  const randomRegion = regions[Math.floor(Math.random() * regions.length)];
  const actualRegion = (Math.random() > 0.5) ? region : randomRegion;
  
  console.log(`アクセスごとにランダムに選択されたリージョン: ${actualRegion} (元のリクエスト: ${region})`);

  // データベース/ストレージからの最近の人気動画を取得する試み
  try {
    console.log(`データベースから最近の人気動画を取得 (${maxResults}件)`);
    const popularVideos = await storage.getPopularVideos(enhancedMaxResults);
    
    if (popularVideos && popularVideos.length >= 5) {
      console.log(`${popularVideos.length}件の人気動画を取得しました`);
      
      // データを正しいフォーマットに変換
      const results = popularVideos.slice(0, maxResults).map((video: any) => ({
        kind: 'youtube#video',
        id: video.videoId,
        snippet: {
          title: video.title || 'Unknown Title',
          description: video.description || '',
          thumbnails: {
            default: { url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/default.jpg` },
            medium: { url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg` },
            high: { url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` }
          },
          channelTitle: video.channelTitle || 'Unknown Channel',
          publishedAt: video.publishedAt || new Date().toISOString()
        },
        contentDetails: { duration: video.duration ? `PT${Math.floor(Number(video.duration) / 60)}M${Number(video.duration) % 60}S` : 'PT0M0S' },
        statistics: { viewCount: video.viewCount || '0' }
      }));
      
      return results;
    }
  } catch (storageError) {
    console.error('ストレージからの人気動画取得エラー:', storageError);
  }

  // 複数のインスタンスに対して順次試行
  const triedInstances = new Set();
  const allResults: any[] = [];
  
  // 最大試行回数だけ実行
  for (let attempt = 0; attempt < maxInstancesToTry; attempt++) {
    try {
      let instance;
      do {
        instance = getRandomInstance();
      } while (triedInstances.has(instance));
      
      triedInstances.add(instance);
      console.log(`人気動画取得 試行 ${attempt+1}/${maxInstancesToTry}: Invidius インスタンス ${instance} を使用`);
      
      const response = await axios.get(`${instance}/api/v1/trending`, {
        params: {
          region: actualRegion,
          type: 'default'
        },
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: TIMEOUT
      });
      
      if (response.status !== 200 || !response.data) {
        console.warn(`インスタンス ${instance} からの人気動画取得に失敗: ${response.status}`);
        continue;
      }
      
      // レスポンスデータが配列かどうかを確認
      if (!Array.isArray(response.data)) {
        console.warn(`インスタンス ${instance} から予期しないレスポンス形式:`, typeof response.data);
        continue;
      }
      
      // 結果を整形
      const results = response.data.map((item: any) => ({
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
      
      // 結果を蓄積
      allResults.push(...results);
      
      // データベースに保存（バックグラウンド）
      try {
        setTimeout(async () => {
          for (const item of results) {
            try {
              await storage.saveVideo({
                videoId: item.id,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                description: item.snippet.description || '',
                thumbnailUrl: item.snippet.thumbnails.high.url,
                publishedAt: item.snippet.publishedAt,
                duration: item.contentDetails.duration.replace(/PT(\d+)M(\d+)S/, (_, m, s) => String(parseInt(m) * 60 + parseInt(s))),
                viewCount: item.statistics.viewCount
              });
            } catch (e) {
              console.warn(`動画 ${item.id} の保存に失敗:`, e);
            }
          }
          console.log(`${results.length}件の人気動画をバックグラウンドでストレージに保存`);
        }, 0);
      } catch (saveError) {
        console.warn('人気動画のストレージ保存中にエラー:', saveError);
      }
      
      console.log(`${results.length}件の人気動画を取得しました (リージョン: ${actualRegion})`);
      
      // 十分な数のビデオを取得したら早期リターン
      if (allResults.length >= enhancedMaxResults) {
        break;
      }
    } catch (error) {
      console.error(`試行 ${attempt+1}/${maxInstancesToTry}: 人気動画取得エラー:`, error);
    }
  }
  
  // ユニークなビデオIDのみを保持（重複排除）
  const uniqueResults = Array.from(
    new Map(allResults.map(item => [item.id, item])).values()
  );
  
  if (uniqueResults.length === 0) {
    console.warn('人気動画を取得できませんでした。安全なフォールバックを使用します。');
    // 最小限のフォールバック（空配列を返さない）
    return [{
      kind: 'youtube#video',
      id: 'jNQXAC9IVRw',
      snippet: {
        title: 'Me at the zoo - YouTubeで最初に公開された動画',
        description: 'The first video on YouTube',
        thumbnails: {
          default: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/default.jpg' },
          medium: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/mqdefault.jpg' },
          high: { url: 'https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg' }
        },
        channelTitle: 'jawed',
        publishedAt: '2005-04-23T14:31:52Z'
      },
      contentDetails: { duration: 'PT0M19S' },
      statistics: { viewCount: '263152718' }
    }];
  }
  
  return uniqueResults.slice(0, maxResults);
}
