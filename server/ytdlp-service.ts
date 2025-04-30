/**
 * YT-DLPサービス
 * 
 * yt-dlpコマンドラインツールを利用してYouTube動画情報を取得するサービス。
 * ytdl-coreの代替として、より安定したYouTubeデータアクセスを提供します。
 * 
 * 機能:
 * - YouTube動画情報の取得
 * - ボット検出バイパスのためのCookie認証
 * - 複数の環境（Replit、Render）に対応
 */

import { spawn } from 'child_process';
import { getFromCache, saveToCache } from './cache-service';
import path from 'path';
import * as fs from 'fs';

// yt-dlpバイナリのパス設定（環境に応じて異なるパスを使用）
// letを使用して後で変更可能にする
export let YT_DLP_PATH = '';
let COOKIES_DIR = '';

// 実行環境の検出（環境変数がなくても動作するように）
const isRender = process.env.RENDER === 'true' || process.cwd().includes('render');
const isReplit = process.env.REPL_ID !== undefined || process.cwd().includes('replit') || process.cwd().includes('/home/runner');

// 環境に基づいてyt-dlpパスを設定
if (isRender) {
  // Renderでは.pythonlibsディレクトリ内に配置される
  YT_DLP_PATH = '/opt/render/project/.pythonlibs/bin/yt-dlp';
  COOKIES_DIR = path.join('/tmp', 'har_and_cookies');
} else if (isReplit) {
  // Replitでは専用パスを使用
  YT_DLP_PATH = '/home/runner/workspace/bin/yt-dlp';
  if (!fs.existsSync(YT_DLP_PATH) && fs.existsSync('/home/runner/bin/yt-dlp')) {
    YT_DLP_PATH = '/home/runner/bin/yt-dlp';
  }
  COOKIES_DIR = path.join(process.cwd(), 'har_and_cookies');
} else if (process.env.YT_DLP_PATH) {
  // 環境変数が設定されている場合はそれを使用
  YT_DLP_PATH = process.env.YT_DLP_PATH;
  COOKIES_DIR = path.join(process.cwd(), 'har_and_cookies');
} else {
  // デフォルトでプロジェクトディレクトリ内のbinを使用
  YT_DLP_PATH = path.join(process.cwd(), 'bin', 'yt-dlp');
  COOKIES_DIR = path.join(process.cwd(), 'har_and_cookies');
}

console.log('検出された実行環境:', isRender ? 'Render' : isReplit ? 'Replit' : 'ローカル');
console.log('Using YT_DLP_PATH:', YT_DLP_PATH);

// Cookiesディレクトリの作成（必要な場合）
if (!fs.existsSync(COOKIES_DIR)) {
  try {
    fs.mkdirSync(COOKIES_DIR, { recursive: true });
    console.log(`Cookiesディレクトリを作成しました: ${COOKIES_DIR}`);
  } catch (err) {
    console.error(`Cookiesディレクトリの作成に失敗しました: ${err}`);
  }
}

const COOKIES_PATH = path.join(COOKIES_DIR, 'youtube_cookies.txt');

/**
 * Cookieファイルが存在するか確認
 */
function hasCookiesFile(): boolean {
  try {
    const exists = fs.existsSync(COOKIES_PATH);
    if (exists) {
      // ファイルサイズも確認（空でないか）
      const stats = fs.statSync(COOKIES_PATH);
      if (stats.size < 10) { // 最小サイズ
        console.warn('Cookie file exists but is too small (possibly empty or corrupted):', COOKIES_PATH);
        return false;
      }
      console.log(`Cookie file exists and valid: ${COOKIES_PATH} (${stats.size} bytes)`);
    } else {
      console.warn('Cookie file does not exist:', COOKIES_PATH);
    }
    return exists;
  } catch (error) {
    console.warn('Cookie file check failed:', error);
    return false;
  }
}

/**
 * Cookieファイルを保存する
 */
export function saveCookies(cookieContent: string): boolean {
  try {
    if (!cookieContent || cookieContent.trim().length < 10) {
      console.error('Invalid cookie content: too short or empty');
      return false;
    }

    // クッキー形式を検証
    if (!cookieContent.includes('.youtube.com')) {
      console.warn('Warning: Cookie content does not contain .youtube.com domain, it may not be valid');
    }

    // har_and_cookiesディレクトリが存在することを確認
    const dir = path.dirname(COOKIES_PATH);
    if (!fs.existsSync(dir)) {
      console.log(`Creating cookies directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Cookieファイルを保存
    fs.writeFileSync(COOKIES_PATH, cookieContent);
    console.log(`Cookies saved to ${COOKIES_PATH} (${cookieContent.length} bytes)`);
    
    // 保存されていることを確認
    if (fs.existsSync(COOKIES_PATH)) {
      const stats = fs.statSync(COOKIES_PATH);
      console.log(`Verified cookie file saved: ${stats.size} bytes`);
      return true;
    } else {
      console.error('Cookie file was not saved properly');
      return false;
    }
  } catch (error) {
    console.error('Failed to save cookies:', error);
    return false;
  }
}

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
  
  // 複数回リトライする
  const maxRetries = 3;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`Retry attempt ${attempt}/${maxRetries} for video ${videoId}`);
      }
      
      const rawInfo = await runYtDlp(url);
      if (!rawInfo) {
        throw new Error('Failed to get video info from yt-dlp');
      }
      
      // パースして必要な情報を抽出
      const info = JSON.parse(rawInfo);
      
      // フォーマット情報を変換
      const formats = convertFormats(info.formats || []);
      
      // URLがない場合はスキップ (有効なフォーマットを確認)
      if (formats.length === 0) {
        console.warn(`No valid formats found for video ${videoId}`);
        throw new Error('No valid streaming formats available');
      }
      
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
      console.error(`Error fetching video info for ${videoId} (attempt ${attempt}/${maxRetries}):`, error);
      lastError = error;
      
      // リトライ前に少し待機 (徐々に増加するバックオフ)
      if (attempt < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1秒, 2秒, 4秒...
        console.log(`Waiting ${backoffMs}ms before next retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // すべてのリトライが失敗した場合
  console.error(`All ${maxRetries} attempts failed for video ${videoId}`);
  
  // フォールバック: ダミーデータを返さず、最後のエラーをスローして上位層に伝播させる
  throw lastError || new Error(`Failed to fetch video info for ${videoId} after ${maxRetries} attempts`);
}

/**
 * yt-dlpコマンドを実行する
 */
async function runYtDlp(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // yt-dlpバイナリの存在を確認
    try {
      const fs = require('fs');
      if (!fs.existsSync(YT_DLP_PATH)) {
        console.error(`yt-dlp binary not found at path: ${YT_DLP_PATH}`);
        // バイナリが見つからない場合のフォールバックパスを探す
        const alternativePaths = [
          // Render環境のパス
          '/opt/render/project/.pythonlibs/bin/yt-dlp',
          // グローバルインストール
          '/usr/bin/yt-dlp',
          '/usr/local/bin/yt-dlp',
          // Nixpkgs（Replit用）
          '/nix/store/bin/yt-dlp',
          // Replit環境
          '/home/runner/workspace/.pythonlibs/bin/yt-dlp',
          // 相対パス
          path.join(process.cwd(), 'bin', 'yt-dlp'),
          // Windows用
          path.join(process.cwd(), 'bin', 'yt-dlp.exe'),
          // システムパス
          'yt-dlp', // PATHに含まれていればこれで実行できる
        ];
        
        let found = false;
        for (const altPath of alternativePaths) {
          try {
            // 特別なケース: 'yt-dlp'だけの場合はwhichコマンドでチェック
            if (altPath === 'yt-dlp') {
              const { execSync } = require('child_process');
              try {
                // whichコマンドでパスを取得
                const whichResult = execSync('which yt-dlp', { encoding: 'utf8', timeout: 2000 }).trim();
                if (whichResult) {
                  console.log(`Found yt-dlp in PATH at: ${whichResult}`);
                  YT_DLP_PATH = whichResult;
                  found = true;
                  break;
                }
              } catch (e) {
                // whichコマンドが失敗した場合は無視
                console.log('which command failed, continuing search');
              }
              continue;
            }
            
            // 通常のパスチェック
            if (fs.existsSync(altPath)) {
              console.log(`Using alternative yt-dlp path: ${altPath}`);
              // YT_DLP_PATHを動的に変更（letを使用しているので問題なし）
              YT_DLP_PATH = altPath;
              found = true;
              break;
            }
          } catch (pathErr) {
            console.warn(`Error checking alternative path ${altPath}: ${pathErr}`);
          }
        }
        
        if (!found) {
          console.warn('Could not find yt-dlp binary in any expected location');
          // 最後の手段：システムコマンドとしてyt-dlpを使用
          YT_DLP_PATH = 'yt-dlp';
          console.log('Falling back to system command: yt-dlp');
        }
      }
    } catch (err) {
      console.warn(`Error checking yt-dlp binary: ${err}`);
    }
    
    // 基本的な引数を設定
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificate',
    ];
    
    // Cookieファイルがある場合は、それを使用
    if (hasCookiesFile()) {
      console.log(`Using cookies file: ${COOKIES_PATH}`);
      args.push('--cookies', COOKIES_PATH);
    } else {
      console.log('No cookies file found. YouTube might require authentication.');
    }
    
    // 最後にURLを追加
    args.push(url);
    
    // yt-dlpバージョンの確認 (診断用)
    try {
      const { execSync } = require('child_process');
      const versionCommand = `${YT_DLP_PATH} --version`;
      console.log(`Checking yt-dlp version with command: ${versionCommand}`);
      const yt_dlp_version = execSync(versionCommand, { encoding: 'utf8', timeout: 5000 }).trim();
      console.log(`yt-dlp version: ${yt_dlp_version}`);
    } catch (e: any) {
      console.warn(`Could not verify yt-dlp version: ${e.message || 'Unknown error'}`);
    }
    
    console.log(`Running command: ${YT_DLP_PATH} ${args.join(' ')}`);
    
    let childProcess: any;
    try {
      childProcess = spawn(YT_DLP_PATH, args);
    } catch (spawnError) {
      console.error('Critical error spawning yt-dlp process:', spawnError);
      reject(spawnError);
      return;
    }
    
    if (!childProcess || !childProcess.stdout || !childProcess.stderr) {
      console.error('Failed to create valid child process');
      reject(new Error('Failed to create valid yt-dlp process'));
      return;
    }
    
    let stdout = '';
    let stderr = '';
    
    childProcess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    
    childProcess.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });
    
    childProcess.on('close', (code: number | null) => {
      if (code === 0) {
        // 結果の検証
        try {
          if (!stdout || stdout.trim() === '') {
            console.warn('yt-dlp returned empty output with success code');
            reject(new Error('yt-dlp returned empty result'));
            return;
          }
          
          // JSONとして解析可能か確認
          JSON.parse(stdout);
          resolve(stdout);
        } catch (jsonError: any) {
          console.error('Failed to parse yt-dlp output as JSON:', jsonError);
          console.log('Output was:', stdout.substring(0, 200) + '...');
          reject(new Error(`Invalid JSON output from yt-dlp: ${jsonError.message || 'Parse error'}`));
        }
      } else {
        console.error(`yt-dlp exited with code ${code}. Error: ${stderr}`);
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
    
    childProcess.on('error', (err: Error) => {
      console.error('Failed to start or communicate with yt-dlp process:', err);
      reject(err);
    });
    
    // 45秒のタイムアウト設定 (より長めに)
    const timeout = setTimeout(() => {
      try {
        console.warn('yt-dlp process timed out after 45 seconds, killing process');
        childProcess.kill('SIGTERM');
      } catch (killError) {
        console.error('Error killing timed out process:', killError);
      }
      reject(new Error('yt-dlp process timed out after 45 seconds'));
    }, 45000);
    
    childProcess.on('close', () => {
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