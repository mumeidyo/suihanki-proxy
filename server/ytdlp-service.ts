/**
 * YT-DLPサービス
 * 
 * yt-dlpコマンドラインツールを利用してYouTube動画情報を取得するサービス。
 * ytdl-coreの代替として、より安定したYouTubeデータアクセスを提供します。
 */

import { spawn } from 'child_process';
import { getFromCache, saveToCache } from './cache-service';
import path from 'path';

// yt-dlpバイナリのパス（環境変数から取得するか、フォールバックとして bin/yt-dlp を使用）
const YT_DLP_PATH = process.env.YT_DLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp');
console.log('Using YT_DLP_PATH:', YT_DLP_PATH);

// キャッシュ時間設定（1時間）
const CACHE_TTL = 60 * 60 * 1000;

// yt-dlpから返されるフォーマット情報のインターフェース
interface YtDlpFormat {
  format_id: string;
  url: string;
  ext: string;
  resolution?: string;
  format_note?: string;
  filesize?: number;
  tbr?: number;
  acodec: string;
  vcodec: string;
  width?: number;
  height?: number;
  fps?: number;
}

// 変換後のフォーマット情報のインターフェース（ytdl-core互換）
export interface VideoFormat {
  url: string;
  mimeType: string;
  qualityLabel: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  contentLength?: string;
  bitrate?: number;
  width?: number;
  height?: number;
  cacheTimestamp: number;
}

// 動画詳細情報のインターフェース（ytdl-core互換）
export interface VideoDetails {
  title: string;
  description: string;
  lengthSeconds: string;
  thumbnailUrl: string;
  channelTitle?: string;
  viewCount?: string;
}

// 動画情報のレスポンスインターフェース
export interface VideoInfo {
  formats: VideoFormat[];
  videoDetails: VideoDetails;
  fromCache?: boolean;
}

/**
 * yt-dlpを使用してYouTube動画情報を取得する
 */
export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  // まずキャッシュをチェック
  const cachedData = getFromCache(videoId);
  if (cachedData) {
    console.log(`Using cached data for video ${videoId}`);
    return {
      formats: cachedData.formats,
      videoDetails: cachedData.videoDetails,
      fromCache: true
    };
  }

  console.log(`Fetching video info for ${videoId} using yt-dlp`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  try {
    const rawInfo = await runYtDlp(url);
    if (!rawInfo) {
      throw new Error('Failed to get video info from yt-dlp');
    }
    
    // パースして必要な情報を抽出
    const info = JSON.parse(rawInfo);
    
    // フォーマット情報を変換
    const formats = convertFormats(info.formats || []);
    
    // 動画詳細情報を変換
    const videoDetails: VideoDetails = {
      title: info.title || 'Unknown Title',
      description: info.description || '',
      lengthSeconds: info.duration?.toString() || '0',
      thumbnailUrl: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelTitle: info.channel || 'Unknown Channel',
      viewCount: info.view_count?.toString() || '0'
    };
    
    // キャッシュに保存
    saveToCache(videoId, formats, videoDetails);
    
    return { formats, videoDetails };
  } catch (error) {
    console.error(`Error fetching video info for ${videoId}:`, error);
    throw error;
  }
}

/**
 * yt-dlpコマンドを実行する
 */
async function runYtDlp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificate',
      url
    ];
    
    // yt-dlpの存在を確認
    try {
      const { execSync } = require('child_process');
      const yt_dlp_version = execSync(`${process.env.YT_DLP_PATH} --version`, { encoding: 'utf8' }).trim();
      console.log(`yt-dlp version: ${yt_dlp_version}`);
    } catch (e) {
      console.warn(`Could not verify yt-dlp version: ${e.message}`);
    }
    
    console.log(`Running command: ${YT_DLP_PATH} ${args.join(' ')}`);
    
    const process = spawn(YT_DLP_PATH, args);
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        console.error(`yt-dlp exited with code ${code}. Error: ${stderr}`);
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
    
    process.on('error', (err) => {
      console.error('Failed to start yt-dlp process:', err);
      reject(err);
    });
    
    // 30秒のタイムアウト設定
    const timeout = setTimeout(() => {
      process.kill();
      reject(new Error('yt-dlp process timed out after 30 seconds'));
    }, 30000);
    
    process.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * yt-dlpのフォーマット情報をytdl-core互換の形式に変換する
 */
function convertFormats(ytdlpFormats: YtDlpFormat[]): VideoFormat[] {
  return ytdlpFormats
    .filter(format => format.url) // URLがあるフォーマットのみを対象に
    .map(format => {
      // ビデオ・オーディオコーデック情報から形式を判定
      const hasVideo = format.vcodec !== 'none';
      const hasAudio = format.acodec !== 'none';
      
      // MIMEタイプの判定
      let mimeType = 'video/mp4';
      if (format.ext === 'webm') {
        mimeType = 'video/webm';
      } else if (format.ext === 'm4a') {
        mimeType = 'audio/mp4';
      } else if (format.ext === 'opus' || format.ext === 'ogg') {
        mimeType = 'audio/ogg';
      }
      
      // 品質ラベルの生成
      let qualityLabel = format.format_note || '';
      if (format.height) {
        qualityLabel = `${format.height}p`;
        if (format.fps) {
          qualityLabel += `${format.fps}`;
        }
      } else if (!qualityLabel && hasAudio && !hasVideo) {
        qualityLabel = 'audio only';
      }
      
      return {
        url: format.url,
        mimeType: mimeType,
        qualityLabel: qualityLabel,
        hasAudio,
        hasVideo,
        container: format.ext || 'mp4',
        contentLength: format.filesize?.toString(),
        bitrate: format.tbr,
        width: format.width,
        height: format.height,
        cacheTimestamp: Date.now()
      };
    });
}

/**
 * 最適な再生フォーマットを選択する
 */
export function selectOptimalFormat(formats: VideoFormat[], preferMobile = false): VideoFormat | null {
  if (!formats || formats.length === 0) {
    return null;
  }
  
  // モバイル向け最適化設定
  const targetHeight = preferMobile ? 480 : 720;
  
  // 両方のストリームを含むフォーマットを優先
  const combinedFormats = formats.filter(f => f.hasVideo && f.hasAudio);
  
  if (combinedFormats.length > 0) {
    // 画質に基づいてソート
    const sortedByQuality = [...combinedFormats].sort((a, b) => {
      const aHeight = a.height || 0;
      const bHeight = b.height || 0;
      
      // 目標解像度に近いものを優先
      const aDiff = Math.abs(aHeight - targetHeight);
      const bDiff = Math.abs(bHeight - targetHeight);
      
      return aDiff - bDiff;
    });
    
    return sortedByQuality[0];
  }
  
  // 別々のストリームを選択する必要がある場合
  const videoFormats = formats.filter(f => f.hasVideo);
  const audioFormats = formats.filter(f => f.hasAudio && !f.hasVideo);
  
  if (videoFormats.length > 0 && audioFormats.length > 0) {
    // 一番適切な動画フォーマット
    const bestVideo = videoFormats.sort((a, b) => {
      const aHeight = a.height || 0;
      const bHeight = b.height || 0;
      const aDiff = Math.abs(aHeight - targetHeight);
      const bDiff = Math.abs(bHeight - targetHeight);
      return aDiff - bDiff;
    })[0];
    
    // 一番適切な音声フォーマット
    const bestAudio = audioFormats.sort((a, b) => 
      (b.bitrate || 0) - (a.bitrate || 0)
    )[0];
    
    // 動画フォーマットを返す（音声なしでも）
    return bestVideo;
  }
  
  // 最後の手段として、利用可能なフォーマットから最初のものを返す
  return formats[0];
}