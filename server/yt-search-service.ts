/**
 * YTサーチサービス
 * 
 * YouTubeの検索結果を取得するためのサービス。
 * Invidiousに依存せず、yt-dlpを使用して検索結果を取得します。
 */

import { spawn } from 'child_process';
import { YT_DLP_PATH } from './ytdlp-service';
import { storage } from './storage';

interface YtSearchResult {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount: string;
}

/**
 * yt-dlpを使用してYouTube検索を実行
 */
export async function searchWithYtDlp(query: string, maxResults: number = 20): Promise<YtSearchResult[]> {
  if (!query) {
    throw new Error('検索クエリが指定されていません');
  }

  console.log(`YT-DLP検索を実行: "${query}" (最大${maxResults}件)`);
  
  try {
    // yt-dlpコマンドの実行
    const args = [
      'ytsearch' + (maxResults > 1 ? maxResults : '') + ':' + query,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--no-check-certificate',
      '--skip-download'
    ];
    
    console.log(`yt-dlp検索コマンドの実行: ${YT_DLP_PATH} ${args.join(' ')}`);
    
    const results = await runYtDlpSearch(args);
    
    // 検索結果の整形
    return processSearchResults(results, maxResults);
  } catch (error) {
    console.error(`YT-DLP検索エラー (${query}):`, error);
    throw new Error(`検索中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

/**
 * yt-dlpコマンドを実行して検索結果を取得
 */
async function runYtDlpSearch(args: string[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      const childProcess = spawn(YT_DLP_PATH, args);
      
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
          try {
            // 各行がJSONオブジェクトとして出力されるため、行ごとに処理
            const results = stdout
              .split('\n')
              .filter(line => line.trim() !== '')
              .map(line => JSON.parse(line));
            
            resolve(results);
          } catch (jsonError) {
            console.error('JSON解析エラー:', jsonError);
            console.log('出力データ:', stdout.substring(0, 200) + '...');
            reject(new Error(`検索結果の解析に失敗しました: ${jsonError instanceof Error ? jsonError.message : '不明なエラー'}`));
          }
        } else {
          console.error(`yt-dlp終了コード ${code}: ${stderr}`);
          reject(new Error(`yt-dlp検索プロセスがエラーで終了しました (コード ${code})`));
        }
      });
      
      childProcess.on('error', (err: Error) => {
        console.error('yt-dlp検索プロセス起動エラー:', err);
        reject(err);
      });
      
      // 30秒のタイムアウト
      const timeout = setTimeout(() => {
        try {
          childProcess.kill('SIGTERM');
        } catch (killError) {
          console.error('検索プロセスの強制終了に失敗:', killError);
        }
        reject(new Error('検索処理がタイムアウトしました (30秒)'));
      }, 30000);
      
      childProcess.on('close', () => {
        clearTimeout(timeout);
      });
    } catch (spawnError) {
      console.error('yt-dlp検索プロセスの起動に失敗:', spawnError);
      reject(spawnError);
    }
  });
}

/**
 * 検索結果を処理して統一形式に変換
 */
function processSearchResults(results: any[], maxResults: number): YtSearchResult[] {
  const processedResults: YtSearchResult[] = [];
  
  // 各検索結果を処理
  for (const result of results) {
    if (processedResults.length >= maxResults) break;
    
    if (!result.id) continue;
    
    // 検索結果を整形
    const videoResult: YtSearchResult = {
      id: result.id,
      title: result.title || 'タイトルなし',
      description: result.description || '',
      thumbnailUrl: result.thumbnail || `https://i.ytimg.com/vi/${result.id}/hqdefault.jpg`,
      channelTitle: result.channel || result.uploader || 'チャンネル名不明',
      publishedAt: result.upload_date 
        ? `${result.upload_date.substring(0, 4)}-${result.upload_date.substring(4, 6)}-${result.upload_date.substring(6, 8)}T00:00:00Z`
        : new Date().toISOString(),
      duration: result.duration?.toString() || '0',
      viewCount: result.view_count?.toString() || '0'
    };
    
    processedResults.push(videoResult);
    
    // データベースに保存（バックグラウンド処理）
    try {
      storage.saveVideo({
        videoId: videoResult.id,
        title: videoResult.title,
        channelTitle: videoResult.channelTitle,
        description: videoResult.description,
        thumbnailUrl: videoResult.thumbnailUrl,
        publishedAt: videoResult.publishedAt,
        duration: videoResult.duration,
        viewCount: videoResult.viewCount
      }).catch(err => console.error(`検索結果のストレージ保存エラー (${videoResult.id}):`, err));
    } catch (storeError) {
      console.error(`検索結果のストレージ保存エラー (${videoResult.id}):`, storeError);
    }
  }
  
  return processedResults;
}

/**
 * 検索結果をYouTube API互換形式に変換
 */
export function convertToYouTubeApiFormat(results: YtSearchResult[]): any[] {
  return results.map(item => ({
    kind: 'youtube#searchResult',
    etag: item.id,
    id: {
      kind: 'youtube#video',
      videoId: item.id
    },
    snippet: {
      publishedAt: item.publishedAt,
      channelId: '',
      title: item.title,
      description: item.description,
      thumbnails: {
        default: { url: item.thumbnailUrl.replace('/hqdefault.jpg', '/default.jpg') },
        medium: { url: item.thumbnailUrl.replace('/hqdefault.jpg', '/mqdefault.jpg') },
        high: { url: item.thumbnailUrl }
      },
      channelTitle: item.channelTitle,
      liveBroadcastContent: 'none',
      publishTime: item.publishedAt
    },
    contentDetails: {
      duration: item.duration ? `PT${Math.floor(parseInt(item.duration) / 60)}M${parseInt(item.duration) % 60}S` : 'PT0M0S'
    },
    statistics: {
      viewCount: item.viewCount
    }
  }));
}

/**
 * 人気動画を取得
 */
export async function getTrendingVideos(maxResults: number = 20, region: string = 'JP'): Promise<any[]> {
  try {
    // 最近データベースに追加された動画を人気動画として使用
    console.log(`データベースから最近の人気動画を取得 (${maxResults}件)`);
    const popularVideos = await storage.getPopularVideos(maxResults);
    
    // データベースに動画がある場合はそれを返す
    if (popularVideos && popularVideos.length > 0) {
      console.log(`${popularVideos.length}件の人気動画を取得しました`);
      
      // YouTube API互換の形式に変換
      return popularVideos.map(video => ({
        kind: 'youtube#video',
        id: {
          kind: 'youtube#video',
          videoId: video.videoId
        },
        snippet: {
          title: video.title || 'タイトルなし',
          description: video.description || '',
          thumbnails: {
            default: { url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/default.jpg` },
            medium: { url: video.thumbnailUrl?.replace('/hqdefault.jpg', '/mqdefault.jpg') || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg` },
            high: { url: video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg` }
          },
          channelTitle: video.channelTitle || 'チャンネル名不明',
          publishedAt: video.publishedAt || new Date().toISOString()
        },
        contentDetails: {
          duration: video.duration ? `PT${Math.floor(parseInt(video.duration) / 60)}M${parseInt(video.duration) % 60}S` : 'PT0M0S'
        },
        statistics: {
          viewCount: video.viewCount || '0'
        }
      }));
    }
    
    // データベースに動画がない場合はyt-dlpを使って人気動画を取得
    console.log('データベースに動画がないため、yt-dlpを使用して人気動画を取得します');
    
    // yt-dlpコマンドの実行
    const args = [
      'https://www.youtube.com/feed/trending?gl=JP', // 日本の人気動画を取得するためのURLパラメータを追加
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--no-check-certificate',
      '--skip-download',
      '--playlist-end', 
      maxResults.toString()
    ];
    
    // 日本向けの動画を優先的に取得するためのパラメータ
    args.push('--geo-bypass-country', 'JP');
    
    // regionパラメーターも尊重する（デバッグ用、基本的にはJPを使う）
    if (region && region !== 'JP' && region !== 'US') {
      console.log(`指定された地域コード: ${region}を使用`);
      args.pop(); // 既存のJPを削除
      args.pop();
      args.push('--geo-bypass-country', region);
    }
    
    console.log(`yt-dlp人気動画コマンドの実行: ${YT_DLP_PATH} ${args.join(' ')}`);
    
    try {
      const results = await runYtDlpSearch(args);
      
      // 検索結果の整形
      const processedResults = results.slice(0, maxResults).map(result => {
        const videoId = result.id || result.webpage_url?.split('v=')[1]?.split('&')[0] || '';
        
        return {
          kind: 'youtube#video',
          id: {
            kind: 'youtube#video',
            videoId: videoId
          },
          snippet: {
            title: result.title || 'タイトルなし',
            description: result.description || '',
            thumbnails: {
              default: { url: result.thumbnail || `https://i.ytimg.com/vi/${videoId}/default.jpg` },
              medium: { url: result.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
              high: { url: result.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }
            },
            channelTitle: result.channel || result.uploader || 'チャンネル名不明',
            publishedAt: result.upload_date 
              ? `${result.upload_date.substring(0, 4)}-${result.upload_date.substring(4, 6)}-${result.upload_date.substring(6, 8)}T00:00:00Z`
              : new Date().toISOString()
          },
          contentDetails: {
            duration: result.duration ? `PT${Math.floor(result.duration / 60)}M${result.duration % 60}S` : 'PT0M0S'
          },
          statistics: {
            viewCount: result.view_count?.toString() || '0'
          }
        };
      });
      
      // 各動画をストレージに保存（バックグラウンド処理）
      processedResults.forEach(video => {
        try {
          storage.saveVideo({
            videoId: video.id.videoId,
            title: video.snippet.title,
            channelTitle: video.snippet.channelTitle,
            description: video.snippet.description,
            thumbnailUrl: video.snippet.thumbnails.high.url,
            publishedAt: video.snippet.publishedAt,
            duration: video.contentDetails.duration,
            viewCount: video.statistics.viewCount
          }).catch(err => console.error(`人気動画のストレージ保存エラー (${video.id.videoId}):`, err));
        } catch (storeError) {
          console.error(`人気動画のストレージ保存エラー (${video.id.videoId}):`, storeError);
        }
      });
      
      return processedResults;
    } catch (ytDlpError) {
      console.error('yt-dlp人気動画取得エラー:', ytDlpError);
      // yt-dlpが失敗した場合は空の配列を返す
      return [];
    }
  } catch (error) {
    console.error('人気動画の取得エラー:', error);
    return [];
  }
}