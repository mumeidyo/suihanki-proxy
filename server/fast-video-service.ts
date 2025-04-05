/**
 * 高速ビデオサービス
 * 
 * このモジュールは、YouTubeビデオのフォーマット情報をより高速かつ効率的に取得し、
 * キャッシングと最適化された形式選択を通じて視聴体験を向上させます。
 */

import { Request, Response } from 'express';
import { getFromCache, saveToCache, validateCachedUrls } from './cache-service';
import { storage } from './storage';
import axios from 'axios';
import { parse } from 'node:url';
import { getFastPlayerHtml } from './templates/fast-player';
import { getVideoInfo, VideoFormat, VideoDetails, VideoInfo } from './ytdlp-service';

// selectOptimalFormatと混同しないようにimport名を変更して使用
import { selectOptimalFormat as ytdlpSelectOptimalFormat } from './ytdlp-service';

// キャッシュ設定
const CACHE_REFRESH_INTERVAL = 30 * 60 * 1000; // 30分
const HTTP_TIMEOUT = 8000; // 8秒

/**
 * ビデオフォーマットを高速に取得する拡張関数
 */
export async function getFastVideoFormats(req: Request, res: Response): Promise<void> {
  const { videoId } = req.params;
  const startTime = Date.now();
  
  try {
    // キャッシュからチェック
    const cachedData = getFromCache(videoId);
    
    if (cachedData) {
      // キャッシュデータを即座に使用（検証を待たず）
      console.log(`Using cached formats for video ${videoId}`);
      const endTime = Date.now();
      console.log(`Formats retrieved from cache in ${endTime - startTime}ms`);
      
      res.json({
        formats: cachedData.formats,
        videoDetails: cachedData.videoDetails,
        fromCache: true,
        responseTime: endTime - startTime
      });
      
      // バックグラウンドでURLの検証と更新を行う（レスポンスをブロックしない）
      setTimeout(() => {
        validateCachedUrls(cachedData.formats)
          .then(urlsValid => {
            if (!urlsValid) {
              console.log(`Cache for ${videoId} is invalid, refreshing in background`);
              return refreshVideoFormats(videoId);
            } else {
              // キャッシュが古い場合はバックグラウンドで更新
              const cacheAge = Date.now() - cachedData.formats[0].cacheTimestamp;
              if (cacheAge > CACHE_REFRESH_INTERVAL) {
                console.log(`Cache is ${Math.round(cacheAge / 60000)}min old, refreshing in background`);
                return refreshVideoFormats(videoId);
              }
            }
          })
          .catch(err => console.error(`Background cache operation failed for ${videoId}:`, err));
      }, 100);
      
      return;
    }
    
    // キャッシュにない場合は取得
    const formats = await getVideoFormatsWithFallback(videoId);
    
    const endTime = Date.now();
    console.log(`Formats retrieved from API in ${endTime - startTime}ms`);
    
    res.json({
      formats: formats.formats,
      videoDetails: formats.videoDetails,
      fromCache: false,
      responseTime: endTime - startTime
    });
    
  } catch (error) {
    console.error(`Error getting video formats for ${videoId}:`, error);
    res.status(500).json({
      error: 'ビデオフォーマットの取得に失敗しました',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * ビデオフォーマットを複数の方法で取得する（フォールバック機能付き）
 */
export async function getVideoFormatsWithFallback(videoId: string): Promise<any> {
  try {
    // 方法1: yt-dlpを使用（高速かつ堅牢）
    console.log(`Fetching formats for ${videoId} using yt-dlp`);
    const videoInfo = await getVideoInfo(videoId);
    
    // データベースにビデオ情報を保存
    await saveVideoToDatabase(videoId, videoInfo);
    
    return {
      formats: videoInfo.formats,
      videoDetails: videoInfo.videoDetails
    };
  } catch (ytdlError) {
    console.error(`ytdl-core failed for ${videoId}, falling back to direct method:`, ytdlError);
    
    try {
      // 方法2: 直接リクエストメソッドを使用（より堅牢）
      console.log(`Fetching formats for ${videoId} using direct method`);
      
      // 注意: このメソッドは限定的な情報のみを提供します
      // YouTube動画のメタデータを取得
      const response = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // タイトルの抽出（シンプルな正規表現）
      let title = 'YouTube Video';
      const titleMatch = response.data.match(/<title>([^<]*)<\/title>/);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].replace(' - YouTube', '');
      }
      
      // 簡易的なフォーマットリストを生成
      // 実際の動画URLは提供されず、再生時に別途リクエストが必要になります
      const formattedFormats = [
        {
          url: `https://www.youtube.com/watch?v=${videoId}`, // 実際の直接URLではなく、参照URL
          mimeType: 'video/mp4',
          qualityLabel: '720p',
          hasAudio: true,
          hasVideo: true,
          container: 'mp4',
          contentLength: undefined,
          bitrate: 1000000,
          cacheTimestamp: Date.now()
        },
        {
          url: `https://www.youtube.com/watch?v=${videoId}`, // 実際の直接URLではなく、参照URL
          mimeType: 'video/mp4',
          qualityLabel: '360p',
          hasAudio: true,
          hasVideo: true,
          container: 'mp4',
          contentLength: undefined,
          bitrate: 500000,
          cacheTimestamp: Date.now()
        }
      ];
      
      const videoDetails = {
        title: title,
        description: '',
        lengthSeconds: '0',
        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      };
      
      // キャッシュに保存（短期間のみ）
      saveToCache(videoId, formattedFormats, videoDetails);
      
      // ビデオ情報をデータベースに保存
      try {
        await storage.saveVideo({
          videoId,
          title: videoDetails.title,
          thumbnailUrl: videoDetails.thumbnailUrl,
          channelTitle: 'YouTube Channel',
          description: ''
        });
      } catch (dbError) {
        console.error(`Failed to save video ${videoId} to database:`, dbError);
      }
      
      return {
        formats: formattedFormats,
        videoDetails
      };
    } catch (fallbackError) {
      console.error(`All methods failed for ${videoId}:`, fallbackError);
      throw new Error('ビデオ情報の取得に失敗しました。サポートされていないフォーマットか、制限付きコンテンツの可能性があります。');
    }
  }
}

/**
 * データベースにビデオ情報を保存
 */
async function saveVideoToDatabase(videoId: string, info: VideoInfo): Promise<void> {
  try {
    await storage.saveVideo({
      videoId,
      title: info.videoDetails.title,
      thumbnailUrl: info.videoDetails.thumbnailUrl,
      channelTitle: info.videoDetails.channelTitle || 'YouTube Channel',
      description: (info.videoDetails.description || '').substring(0, 1000) // 説明が長すぎる場合は切り詰める
    });
  } catch (error) {
    console.error(`Failed to save video ${videoId} to database:`, error);
  }
}

/**
 * すでにキャッシュされたフォーマットをバックグラウンドで更新
 */
async function refreshVideoFormats(videoId: string): Promise<void> {
  try {
    console.log(`Background refreshing formats for ${videoId}`);
    await getVideoFormatsWithFallback(videoId);
    console.log(`Successfully refreshed formats for ${videoId}`);
  } catch (error) {
    console.error(`Failed to refresh formats for ${videoId}:`, error);
  }
}

// ytdlp-serviceから提供されるselectOptimalFormatを使用する代わりに
// バックワードコンパチビリティのために残しています
/**
 * 最適な再生フォーマットを選択
 */
export function localSelectOptimalFormat(formats: VideoFormat[], preferMobile = false): VideoFormat | null {
  if (!formats || formats.length === 0) {
    return null;
  }

  // モバイル向け最適化
  if (preferMobile) {
    // モバイルでは中画質の方が安定する場合が多い
    const mobileFormats = formats.filter(format => 
      format.hasVideo && 
      format.hasAudio && 
      format.container === 'mp4' && 
      format.qualityLabel && 
      (format.qualityLabel.includes('480p') || format.qualityLabel.includes('360p'))
    );
    
    if (mobileFormats.length > 0) {
      // ビットレートで並べ替えて最良のものを返す
      return mobileFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    }
  }
  
  // 通常の高品質優先
  // まず音声と映像の両方があるフォーマットを選ぶ
  const combinedFormats = formats.filter(format => 
    format.hasVideo && 
    format.hasAudio && 
    (format.container === 'mp4' || format.container === 'webm')
  );
  
  if (combinedFormats.length > 0) {
    // 品質ラベルで並べ替え、高品質を優先
    return combinedFormats.sort((a, b) => {
      // 品質ラベルから数値を抽出 (例: "720p" -> 720)
      const getHeight = (label: string) => {
        const match = label.match(/(\d+)p/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      const heightA = getHeight(a.qualityLabel || '');
      const heightB = getHeight(b.qualityLabel || '');
      
      // 高さが同じ場合はビットレートで比較
      if (heightA === heightB) {
        return (b.bitrate || 0) - (a.bitrate || 0);
      }
      
      return heightB - heightA;
    })[0];
  }
  
  // 最終手段として任意のビデオフォーマットを返す
  const videoFormats = formats.filter(format => format.hasVideo);
  
  if (videoFormats.length > 0) {
    return videoFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
  }
  
  // どれも見つからない場合は最初のフォーマットを返す
  return formats[0];
}

/**
 * 最適な再生フォーマットを高速に取得
 */
export async function getFastPlaybackUrl(req: Request, res: Response): Promise<void> {
  const videoId = req.params.videoId;
  const isMobile = req.query.mobile === 'true';
  const startTime = Date.now();
  
  try {
    // キャッシュからチェック
    const cachedData = getFromCache(videoId);
    
    if (cachedData) {
      // キャッシュデータを即座に使用（検証を待たない）
      console.log(`Using cached formats for playback of ${videoId}`);
      
      // 最適なフォーマットを選択
      const optimalFormat = localSelectOptimalFormat(cachedData.formats, isMobile);
      
      if (optimalFormat && optimalFormat.url) {
        const endTime = Date.now();
        console.log(`Optimal format selected from cache in ${endTime - startTime}ms`);
        
        // カスタムプレーヤーページを返す
        const html = getFastPlayerHtml(
          videoId,
          cachedData.videoDetails.title,
          optimalFormat.url,
          cachedData.videoDetails.thumbnailUrl,
          cachedData.formats
            .filter((f: any) => f.hasVideo && f.hasAudio && f.url)
            .map((f: any) => ({
              url: f.url,
              quality: f.qualityLabel,
              type: f.mimeType
            }))
        );
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
        
        // バックグラウンドでURLの検証と更新を行う（レスポンスをブロックしない）
        setTimeout(() => {
          validateCachedUrls(cachedData.formats)
            .then(urlsValid => {
              if (!urlsValid) {
                console.log(`Cache for ${videoId} is invalid, refreshing in background`);
                return refreshVideoFormats(videoId);
              } else {
                // キャッシュが古い場合はバックグラウンドで更新
                const cacheAge = Date.now() - cachedData.formats[0].cacheTimestamp;
                if (cacheAge > CACHE_REFRESH_INTERVAL) {
                  return refreshVideoFormats(videoId);
                }
              }
            })
            .catch(err => console.error(`Background cache operation failed for ${videoId}:`, err));
        }, 100);
        
        return;
      }
    }
    
    // キャッシュにない場合は新たに取得
    console.log(`No valid cache for ${videoId}, fetching new formats`);
    const formats = await getVideoFormatsWithFallback(videoId);
    
    // 最適なフォーマットを選択
    const optimalFormat = localSelectOptimalFormat(formats.formats, isMobile);
    
    if (!optimalFormat || !optimalFormat.url) {
      throw new Error('適切な再生フォーマットが見つかりませんでした');
    }
    
    const endTime = Date.now();
    console.log(`Optimal format selected from API in ${endTime - startTime}ms`);
    
    // カスタムプレーヤーページを返す
    const html = getFastPlayerHtml(
      videoId,
      formats.videoDetails.title,
      optimalFormat.url,
      formats.videoDetails.thumbnailUrl,
      formats.formats
        .filter((f: any) => f.hasVideo && f.hasAudio && f.url)
        .map((f: any) => ({
          url: f.url,
          quality: f.qualityLabel,
          type: f.mimeType
        }))
    );
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
  } catch (error) {
    console.error(`Error getting fast playback URL for ${videoId}:`, error);
    res.status(500).json({
      error: '再生URLの取得に失敗しました',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallback: `/api/youtube/proxy-player/${videoId}`
    });
  }
}

/**
 * HLSストリーミングURLを生成（m3u8形式）
 */
export async function generateHlsStream(req: Request, res: Response): Promise<void> {
  const { videoId } = req.params;
  
  try {
    // フォーマットを取得
    const cachedData = getFromCache(videoId);
    let formats;
    let videoDetails;
    
    if (cachedData) {
      // キャッシュデータをすぐに使用
      formats = cachedData.formats;
      videoDetails = cachedData.videoDetails;
      
      // バックグラウンドで検証
      setTimeout(() => {
        validateCachedUrls(cachedData.formats)
          .then(stillValid => {
            if (!stillValid) {
              console.log(`HLS cache for ${videoId} is invalid, refreshing in background`);
              refreshVideoFormats(videoId).catch(err => 
                console.error(`Background HLS cache refresh failed for ${videoId}:`, err)
              );
            }
          })
          .catch(err => console.error(`HLS cache validation failed for ${videoId}:`, err));
      }, 100);
    } else {
      // キャッシュがない場合は新たに取得
      const data = await getVideoFormatsWithFallback(videoId);
      formats = data.formats;
      videoDetails = data.videoDetails;
    }
    
    // 利用可能なフォーマットをフィルタリング
    const availableFormats = formats.filter((f: any) => 
      f.hasVideo && f.hasAudio && f.url && 
      (f.container === 'mp4' || f.container === 'webm')
    );
    
    if (availableFormats.length === 0) {
      throw new Error('再生可能なフォーマットが見つかりませんでした');
    }
    
    // 利用可能な品質を解像度で並べ替え
    const sortedFormats = availableFormats.sort((a: any, b: any) => {
      const getHeight = (label: string) => {
        const match = label.match(/(\d+)p/);
        return match ? parseInt(match[1], 10) : 0;
      };
      
      return getHeight(b.qualityLabel || '') - getHeight(a.qualityLabel || '');
    });
    
    // HLSプレイリストを生成
    let m3u8Content = '#EXTM3U\n';
    m3u8Content += '#EXT-X-VERSION:3\n';
    
    // 各品質のストリームを追加
    sortedFormats.forEach((format: any) => {
      const height = format.qualityLabel.match(/(\d+)p/) ? format.qualityLabel.match(/(\d+)p/)![1] : '0';
      const bandwidth = format.bitrate || 0;
      
      m3u8Content += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${height}x${Math.round(parseInt(height) * 16/9)},NAME="${format.qualityLabel}"\n`;
      m3u8Content += `${format.url}\n`;
    });
    
    // レスポンスを返す
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5分間のキャッシュ
    res.send(m3u8Content);
    
  } catch (error) {
    console.error(`Error generating HLS stream for ${videoId}:`, error);
    res.status(500).json({
      error: 'HLSストリームの生成に失敗しました',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}