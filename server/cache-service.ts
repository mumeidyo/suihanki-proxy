/**
 * キャッシュサービス
 * 
 * 動画情報のキャッシュを管理し、APIリクエストの削減とパフォーマンス向上を図ります。
 * このモジュールではファイルシステムとメモリの両方を使用したハイブリッドキャッシュを提供します。
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

// 型定義
interface CachedVideoFormat {
  url: string;
  mimeType: string;
  qualityLabel: string;
  hasAudio: boolean;
  hasVideo: boolean;
  container: string;
  contentLength?: string;
  bitrate?: number;
  cacheTimestamp: number;
}

interface CachedVideoDetails {
  title: string;
  description: string;
  lengthSeconds: string;
  thumbnailUrl: string;
}

interface CachedVideoData {
  formats: CachedVideoFormat[];
  videoDetails: CachedVideoDetails;
  expiry: number;
}

// キャッシュ設定
const CACHE_DIR = path.join(os.tmpdir(), 'youtube-cache');
const CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2時間
const URL_CHECK_TIMEOUT = 800; // 0.8秒でURLの有効性確認タイムアウト

/**
 * ファイルキャッシュのディレクトリを初期化する
 */
export function initCacheDirectory(): string {
  if (!fs.existsSync(CACHE_DIR)) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    } catch (err) {
      console.error('Failed to create cache directory:', err);
    }
  }
  return CACHE_DIR;
}

/**
 * ビデオIDからキャッシュキーを生成する
 */
function getCacheKey(videoId: string): string {
  return path.join(CACHE_DIR, `video-${videoId}.json`);
}

/**
 * ビデオフォーマットをキャッシュから取得する
 * 
 * 注: ユーザーのプライバシーおよび要件により、検索結果は他のユーザー間で共有されません
 */
export function getFromCache(videoId: string): CachedVideoData | null {
  // キャッシュ機能を無効にして常に新しい情報を取得
  console.log(`キャッシュは無効化されています - video ${videoId} の最新情報を取得します`);
  return null;
  
  /* 以前のキャッシュ機能（無効化）
  try {
    const cacheFile = getCacheKey(videoId);
    
    if (!fs.existsSync(cacheFile)) {
      return null;
    }
    
    const fileData = fs.readFileSync(cacheFile, 'utf8');
    
    if (!fileData) {
      return null;
    }
    
    const parsedData: CachedVideoData = JSON.parse(fileData);
    
    // キャッシュの有効期限をチェック
    if (parsedData.expiry < Date.now()) {
      // 期限切れの場合は削除
      try {
        fs.unlinkSync(cacheFile);
      } catch (err) {
        console.error(`Failed to delete expired cache file for ${videoId}:`, err);
      }
      return null;
    }
    
    return parsedData;
  } catch (error) {
    console.error(`Error reading cache for ${videoId}:`, error);
    return null;
  }
  */
}

/**
 * ビデオフォーマットをキャッシュに保存する
 * 
 * 注: ユーザーのプライバシーおよび要件により、検索結果は保存されません
 */
export function saveToCache(
  videoId: string,
  formats: CachedVideoFormat[],
  videoDetails: CachedVideoDetails
): void {
  // キャッシュ機能を無効にして情報を保存しない
  console.log(`キャッシュ保存機能は無効化されています - video ${videoId} の情報は保存されません`);
  
  /* 以前のキャッシュ保存機能（無効化）
  try {
    // キャッシュディレクトリが存在することを確認
    initCacheDirectory();
    
    // フォーマットにタイムスタンプを追加
    const timestampedFormats = formats.map(format => ({
      ...format,
      cacheTimestamp: Date.now()
    }));
    
    // キャッシュデータを作成
    const cacheData: CachedVideoData = {
      formats: timestampedFormats,
      videoDetails,
      expiry: Date.now() + CACHE_EXPIRY
    };
    
    // ファイルに保存
    fs.writeFileSync(
      getCacheKey(videoId),
      JSON.stringify(cacheData, null, 2),
      'utf8'
    );
    
    console.log(`Cache saved for video ${videoId}`);
  } catch (error) {
    console.error(`Error saving cache for ${videoId}:`, error);
  }
  */
}

/**
 * キャッシュの有効性を確認する（URLが有効かどうか）
 * 
 * 注: キャッシュ機能が無効なため、常にfalseを返します
 */
export async function validateCachedUrls(formats: CachedVideoFormat[]): Promise<boolean> {
  // キャッシュ機能を無効にしているため、常に無効（false）を返す
  console.log('キャッシュURLの検証は無効化されています');
  return false;
  
  /* 以前のキャッシュ検証機能（無効化）
  if (!formats || formats.length === 0) {
    return false;
  }
  
  // キャッシュが古すぎる場合は無効と見なす（24時間以上前）
  const oldestAllowedTimestamp = Date.now() - 24 * 60 * 60 * 1000;
  if (formats[0].cacheTimestamp < oldestAllowedTimestamp) {
    return false;
  }
  
  // 最初のフォーマットのURLをチェック（全てチェックすると時間がかかる）
  const firstFormat = formats[0];
  
  if (!firstFormat.url) {
    return false;
  }
  
  try {
    const isValid = await checkUrlValidity(firstFormat.url);
    return isValid;
  } catch (error) {
    console.error('Error validating cached URL:', error);
    return false;
  }
  */
}

/**
 * URLの有効性をチェックする
 */
async function checkUrlValidity(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const timeout = setTimeout(() => {
      console.log(`URL validation timed out for ${url}`);
      resolve(false);
    }, URL_CHECK_TIMEOUT);
    
    const request = protocol.request(
      url,
      { method: 'HEAD', timeout: URL_CHECK_TIMEOUT },
      (response) => {
        clearTimeout(timeout);
        
        // 2xxと3xxのステータスコードは成功と見なす
        const isSuccessful = response.statusCode !== undefined && 
                             response.statusCode >= 200 && 
                             response.statusCode < 400;
        
        resolve(isSuccessful);
      }
    );
    
    request.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    
    request.end();
  });
}

/**
 * キャッシュを定期的にクリーンアップする
 */
export function startCacheCleanupTask(): NodeJS.Timeout {
  console.log('Starting cache cleanup task');
  
  // 定期的にキャッシュをクリーンアップ
  return setInterval(() => {
    try {
      const now = Date.now();
      const files = fs.readdirSync(CACHE_DIR);
      
      let cleaned = 0;
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const filePath = path.join(CACHE_DIR, file);
        
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const parsedData: CachedVideoData = JSON.parse(data);
          
          if (parsedData.expiry < now) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (err) {
          // 読み取りまたはパースエラーの場合はファイルを削除
          try {
            fs.unlinkSync(filePath);
            cleaned++;
          } catch (unlinkErr) {
            console.error(`Failed to delete invalid cache file ${file}:`, unlinkErr);
          }
        }
      }
      
      if (cleaned > 0) {
        console.log(`Cache cleanup completed: ${cleaned} files removed`);
      }
    } catch (error) {
      console.error('Error during cache cleanup:', error);
    }
  }, 30 * 60 * 1000); // 30分ごとに実行
}

// キャッシュディレクトリを初期化
initCacheDirectory();

// キャッシュのクリーンアップを開始
const cleanupTask = startCacheCleanupTask();

// プロセス終了時にクリーンアップタスクを停止
process.on('exit', () => {
  if (cleanupTask) {
    clearInterval(cleanupTask);
  }
});