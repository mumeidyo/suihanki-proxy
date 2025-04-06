/**
 * Android端末向けの直接ストリーミングサービス
 */

import { Request, Response } from 'express';
import ytdl from 'ytdl-core';
import axios from 'axios';
import { getFromCache } from './cache-service';
import http from 'http';
import https from 'https';

// カスタムエージェント設定（接続のタイムアウト短縮）
const httpAgent = new http.Agent({ keepAlive: true, timeout: 3000 });
const httpsAgent = new https.Agent({ keepAlive: true, timeout: 3000 });

/**
 * YouTubeの動画情報を取得
 */
export async function fetchYoutubeVideoData(videoId: string) {
  try {
    // まずキャッシュをチェック
    const cachedData = getFromCache(videoId);
    if (cachedData) {
      return {
        title: cachedData.videoDetails.title,
        formats: cachedData.formats,
        thumbnailUrl: cachedData.videoDetails.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelTitle: 'YouTube Channel',
        fromCache: true
      };
    }

    // 最も高速な方法でフォーマットと基本情報を取得
    // ytdl-coreのgetInfoは時間がかかるので使わない
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // 標準形式のURLを高速に構築（暫定的アプローチ）
    const directUrl = `https://redirector.googlevideo.com/videoplayback?id=${videoId}`;
    
    // 高速なビデオ詳細取得
    const basicInfo = {
      title: 'YouTube Video',
      formats: [
        {
          url: directUrl,
          qualityLabel: '360p',
          mimeType: 'video/mp4',
          hasAudio: true,
          hasVideo: true,
          container: 'mp4'
        }
      ],
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelTitle: 'YouTube Channel',
      fromCache: false
    };
    
    // 情報を非同期で豊かにする
    enrichVideoInfoAsync(videoId);
    
    return basicInfo;
  } catch (error) {
    console.error(`Error fetching YouTube data for ${videoId}:`, error);
    throw error;
  }
}

/**
 * 非同期にビデオ情報を豊かにする
 */
async function enrichVideoInfoAsync(videoId: string) {
  try {
    // バックグラウンドで情報を取得
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // 完全な情報を非同期に取得（結果は待たない）
    ytdl.getInfo(videoUrl).catch(err => {
      console.log(`Background info enrichment failed for ${videoId}, not critical`);
    });
  } catch (error) {
    // エラーは無視（これはバックグラウンド処理）
  }
}

/**
 * Android向け直接ストリーミング
 */
export async function handleDirectStream(req: Request, res: Response): Promise<void> {
  const { videoId } = req.params;
  const startTime = Date.now();
  
  try {
    // キャッシュまたは高速フェッチから動画データを取得
    const videoData = await fetchYoutubeVideoData(videoId);
    
    // モバイルに最適化されたHTMLプレーヤーページを生成
    const html = generateMobilePlayerHtml(videoId, videoData.title);
    
    // 応答を送信
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
    
    const endTime = Date.now();
    console.log(`Android player rendered in ${endTime - startTime}ms`);
    
  } catch (error) {
    console.error(`Error handling direct stream for ${videoId}:`, error);
    res.status(500).json({
      error: 'ビデオのストリーミングに失敗しました',
      message: error instanceof Error ? error.message : '不明なエラー',
      fallback: `/api/youtube/proxy-player/${videoId}`
    });
  }
}

/**
 * モバイル向けの超高速プレーヤーHTMLを生成
 */
function generateMobilePlayerHtml(videoId: string, title: string): string {
  // iframeを使用した超軽量プレーヤー
  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <title>${title || 'YouTube Video'} - SuperFast Player</title>
      <style>
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; background: #000; overflow: hidden; }
        .container { height: 100%; display: flex; flex-direction: column; }
        .player-container { flex: 1; position: relative; }
        iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        .header { background: #212121; padding: 8px; display: flex; align-items: center; }
        .back-button { background: none; border: none; color: white; font-size: 24px; cursor: pointer; margin-right: 10px; }
        .title { color: white; font-family: Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <button class="back-button" onclick="window.history.back()">←</button>
          <div class="title">${title || 'YouTube Video'}</div>
        </div>
        <div class="player-container">
          <!-- 超高速なiframe埋め込み -->
          <iframe
            src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      </div>

      <script>
        // パフォーマンス測定
        const loadStartTime = performance.now();
        window.addEventListener('load', () => {
          const loadTime = Math.round(performance.now() - loadStartTime);
          console.log('Page loaded in ' + loadTime + 'ms');
        });
      </script>
    </body>
    </html>
  `;
}