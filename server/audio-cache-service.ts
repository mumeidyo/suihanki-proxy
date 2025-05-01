/**
 * 音声キャッシュサービス
 * 
 * YouTubeの音声をダウンロードしてローカルに保存し、ストリーミングするサービス
 * 音声ファイルは再生後に自動的に削除される
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { exec } from 'child_process';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

// キャッシュディレクトリのパス
// Render環境では/tmpを使用し、それ以外ではプロジェクトディレクトリ内のtmpを使用
const isRender = process.env.RENDER === 'true' || process.cwd().includes('render');
const CACHE_DIR = isRender 
  ? path.join('/tmp', 'audio-cache') 
  : path.join(process.cwd(), 'tmp', 'audio-cache');

console.log(`音声キャッシュディレクトリ設定: ${CACHE_DIR} (環境: ${isRender ? 'Render' : '通常'})`);

// 現在処理中の音声トラック
const activeDownloads = new Map<string, { 
  filePath: string,
  status: 'downloading' | 'ready' | 'error',
  message?: string,
  lastAccessed: number,
  downloadPromise?: Promise<string>
}>();

/**
 * 音声キャッシュディレクトリを作成
 */
export function initAudioCacheDirectory(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      console.log(`音声キャッシュディレクトリを作成しました: ${CACHE_DIR}`);
    }
  } catch (error) {
    console.error('音声キャッシュディレクトリの作成に失敗しました:', error);
  }
}

/**
 * YouTubeビデオIDからキャッシュキーを生成
 */
function getCacheKey(videoId: string): string {
  return crypto.createHash('md5').update(videoId).digest('hex');
}

/**
 * yt-dlpのパスを取得
 */
function getYtDlpPath(): string {
  // 環境変数から取得するか、デフォルトのパスを使用
  return process.env.YT_DLP_PATH || path.join(process.cwd(), 'bin', 'yt-dlp');
}

/**
 * YouTubeから音声をダウンロード
 */
async function downloadAudio(videoId: string): Promise<string> {
  const cacheKey = getCacheKey(videoId);
  const uniqueId = randomUUID().substring(0, 8);
  const fileName = `${cacheKey}_${uniqueId}.mp3`;
  const filePath = path.join(CACHE_DIR, fileName);
  
  // すでにアクティブダウンロードがある場合は既存のものを返す
  if (activeDownloads.has(videoId)) {
    const existing = activeDownloads.get(videoId)!;
    
    // ダウンロード中なら完了を待つ
    if (existing.status === 'downloading' && existing.downloadPromise) {
      console.log(`既存のダウンロードを待機中: ${videoId}`);
      return existing.downloadPromise;
    }
    
    // 準備完了しているならそのまま返す
    if (existing.status === 'ready' && fs.existsSync(existing.filePath)) {
      console.log(`既存の音声ファイルを使用: ${videoId} -> ${existing.filePath}`);
      existing.lastAccessed = Date.now();
      return existing.filePath;
    }
  }

  console.log(`音声ダウンロード開始: ${videoId} -> ${filePath}`);
  
  // ダウンロードプロミスを作成
  const downloadPromise = new Promise<string>((resolve, reject) => {
    const ytDlpPath = getYtDlpPath();
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // cookiesファイルを探す
    const cookiesPath = path.join(process.cwd(), 'har_and_cookies', 'youtube_cookies.txt');
    const cookiesArg = fs.existsSync(cookiesPath) ? `--cookies ${cookiesPath}` : '';
    
    // yt-dlpコマンドを構築
    const command = `${ytDlpPath} ${cookiesArg} -x --audio-format mp3 --audio-quality 0 -o "${filePath}" ${videoUrl}`;
    
    // コマンドを実行
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`音声ダウンロードエラー (${videoId}):`, error);
        if (activeDownloads.has(videoId)) {
          activeDownloads.set(videoId, {
            ...activeDownloads.get(videoId)!,
            status: 'error',
            message: error.message
          });
        }
        reject(error);
        return;
      }
      
      if (!fs.existsSync(filePath)) {
        const err = new Error(`ファイルが作成されませんでした: ${filePath}`);
        console.error(err.message);
        if (activeDownloads.has(videoId)) {
          activeDownloads.set(videoId, {
            ...activeDownloads.get(videoId)!,
            status: 'error',
            message: err.message
          });
        }
        reject(err);
        return;
      }
      
      console.log(`音声ダウンロード完了: ${videoId} -> ${filePath}`);
      
      if (activeDownloads.has(videoId)) {
        activeDownloads.set(videoId, {
          ...activeDownloads.get(videoId)!,
          status: 'ready',
          lastAccessed: Date.now()
        });
      }
      
      resolve(filePath);
    });
  });
  
  // マップにダウンロード情報を登録
  activeDownloads.set(videoId, {
    filePath,
    status: 'downloading',
    lastAccessed: Date.now(),
    downloadPromise
  });
  
  return downloadPromise;
}

/**
 * 音声ファイルを削除
 * 
 * @param videoId 削除する動画ID
 * @param forceDelete trueの場合はすぐに削除、falseの場合は遅延削除（先行読み込みのため）
 */
export function removeAudioFile(videoId: string, forceDelete: boolean = false): void {
  if (activeDownloads.has(videoId)) {
    const download = activeDownloads.get(videoId)!;
    
    // ファイルが存在する場合は削除
    if (fs.existsSync(download.filePath)) {
      if (forceDelete) {
        // 強制削除モード（即時削除）
        try {
          fs.unlinkSync(download.filePath);
          console.log(`音声ファイルを即時削除しました: ${download.filePath}`);
          // マップからエントリを削除
          activeDownloads.delete(videoId);
        } catch (error) {
          console.error(`音声ファイル削除エラー: ${download.filePath}`, error);
        }
      } else {
        // 遅延削除モード（30秒後に削除）
        console.log(`音声ファイルを遅延削除予約: ${download.filePath} (30秒後)`);
        
        // アクセス時間を更新して、他のリクエストでも使えるようにする
        download.lastAccessed = Date.now();
        
        setTimeout(() => {
          if (fs.existsSync(download.filePath)) {
            try {
              fs.unlinkSync(download.filePath);
              console.log(`音声ファイルを遅延削除しました: ${download.filePath}`);
            } catch (e) {
              console.error(`遅延削除エラー: ${download.filePath}`, e);
            }
          }
          activeDownloads.delete(videoId);
        }, 30000); // 30秒後に削除
      }
    } else {
      // ファイルが存在しない場合はマップからエントリのみ削除
      activeDownloads.delete(videoId);
    }
  }
}

/**
 * キャッシュのクリーンアップタスク
 * (古いファイルを定期的に削除)
 */
export function startAudioCacheCleanupTask(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`音声キャッシュクリーンアップタスクを開始しました（間隔: ${intervalMs}ms）`);
  
  return setInterval(() => {
    try {
      // 30分以上アクセスされていないファイルを削除
      const now = Date.now();
      const expiredTime = 30 * 60 * 1000; // 30分
      
      // アクティブダウンロードから古いエントリを削除
      Array.from(activeDownloads.entries()).forEach(([videoId, download]) => {
        if (now - download.lastAccessed > expiredTime) {
          if (fs.existsSync(download.filePath)) {
            try {
              fs.unlinkSync(download.filePath);
              console.log(`期限切れの音声ファイルを削除しました: ${download.filePath}`);
            } catch (error) {
              console.error(`期限切れの音声ファイル削除エラー: ${download.filePath}`, error);
            }
          }
          
          activeDownloads.delete(videoId);
        }
      });
      
      // キャッシュディレクトリ内の未管理ファイルも確認
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR);
        
        for (const file of files) {
          try {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            
            // 1時間以上前のファイルは削除
            if (now - stats.mtimeMs > 60 * 60 * 1000) {
              fs.unlinkSync(filePath);
              console.log(`古い未管理の音声ファイルを削除しました: ${filePath}`);
            }
          } catch (error) {
            console.error(`キャッシュクリーンアップエラー:`, error);
          }
        }
      }
    } catch (error) {
      console.error('音声キャッシュクリーンアップエラー:', error);
    }
  }, intervalMs);
}

/**
 * 音声ストリーミングハンドラ
 * - 音声をダウンロードしてからストリーミング
 * - 音声ファイルは再生後に削除される
 */
// 次の曲を先読みするための関数
export async function preloadAudio(videoId: string): Promise<void> {
  if (!videoId) return;
  
  try {
    console.log(`音声先読み要求: ${videoId}`);
    
    // バックグラウンドでダウンロードを開始
    downloadAudio(videoId).then(filePath => {
      console.log(`音声先読み完了: ${videoId} -> ${filePath}`);
    }).catch(err => {
      console.error(`音声先読みエラー: ${videoId}`, err);
    });
  } catch (error) {
    console.error(`音声先読み処理エラー: ${videoId}`, error);
  }
}

export async function handleAudioStream(req: Request, res: Response): Promise<void> {
  const { videoId } = req.params;
  const nextVideoId = req.query.next as string | undefined;
  
  if (!videoId) {
    res.status(400).json({ error: 'VideoID is required' });
    return;
  }
  
  // 次の曲があれば先読み開始（バックグラウンド処理）
  if (nextVideoId && nextVideoId !== videoId) {
    setTimeout(() => {
      preloadAudio(nextVideoId);
    }, 100);
  }
  
  try {
    console.log(`音声ストリーミング要求: ${videoId}`);
    
    // 音声をダウンロード（すでにダウンロード済みならそのファイルを使用）
    const filePath = await downloadAudio(videoId);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`音声ファイルが見つかりません: ${filePath}`);
    }
    
    // ファイルサイズを取得
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // レンジリクエストの処理
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      file.pipe(res);
    } else {
      // 通常のリクエスト
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
    
    // 再生終了時（レスポンスが終了したとき）にファイルを遅延削除するためのイベントハンドラ
    res.on('finish', () => {
      console.log(`ストリーミング完了、音声ファイルを遅延削除予約: ${videoId}`);
      // 遅延削除（forceDelete=false）- 次の曲に備えて少しの間キャッシュに保持
      setTimeout(() => removeAudioFile(videoId, false), 1000);
    });
    
    res.on('error', (error) => {
      console.error(`ストリーミングエラー: ${videoId}`, error);
      // エラー時は即時削除（forceDelete=true）
      removeAudioFile(videoId, true);
    });
    
  } catch (error) {
    console.error(`音声ストリーミングエラー: ${videoId}`, error);
    
    // エラー時は元のURLにリダイレクト
    try {
      // フォールバック: 直接ストリーミングを試みる
      const fallbackUrl = `/api/youtube/stream-video/${videoId}?audio=true`;
      console.log(`フォールバックURLにリダイレクト: ${fallbackUrl}`);
      res.redirect(fallbackUrl);
    } catch (redirectError) {
      res.status(500).json({
        error: '音声ストリーミングに失敗しました',
        message: error instanceof Error ? error.message : '不明なエラー'
      });
    }
  }
}

/**
 * キャッシュの状態を取得（デバッグ用）
 */
export function getAudioCacheStatus(): any {
  const cacheEntries: any[] = [];
  
  Array.from(activeDownloads.entries()).forEach(([videoId, download]) => {
    cacheEntries.push({
      videoId,
      status: download.status,
      lastAccessed: new Date(download.lastAccessed).toISOString(),
      filePath: download.filePath,
      exists: fs.existsSync(download.filePath)
    });
  });
  
  return {
    cacheDirectory: CACHE_DIR,
    directoryExists: fs.existsSync(CACHE_DIR),
    activeDownloads: activeDownloads.size,
    entries: cacheEntries
  };
}
