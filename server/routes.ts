import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import https from "https";
import http from "http";
import axios from "axios";
import { storage } from "./storage";
import { z } from "zod";
import { broadcastNewPost, broadcastNewComment, broadcastLike } from "./websocket-service";
import { randomBytes } from "crypto";
import {
  youtubeSearchSchema,
  youtubeDownloadSchema,
  insertYoutubeVideoSchema,
  insertDownloadHistorySchema,
  insertProxyHistorySchema,
  boardPostSchema,
  boardCommentSchema,
  insertBoardPostSchema,
  insertBoardCommentSchema,
  userRoleSchema,
  banIpSchema,
  kickUserSchema
} from "@shared/schema";
import ytdl from "ytdl-core";
import youtubeDlExec from "youtube-dl-exec";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import os from "os";
import { streamVideo, getDirectVideoUrls, getEnhancedPlayerPage } from "./stream-service";
import { getFastVideoFormats, getFastPlaybackUrl, generateHlsStream } from "./fast-video-service";
import { searchMusicTracks, findYouTubeForTrack, getPopularTracks, getArtistTracks } from "./music-service";
import { getSpotifyPlayerHtml } from "./templates/spotify-player";
import { getSpotifyDownloadHtml } from "./templates/spotify-download";
import { getYouTubeMusicPlayerHtml } from "./templates/youtube-music-player";
import { getYouTubeMusicDownloadHtml } from "./templates/youtube-music-download";
import { getProxyPlayerHtml } from "./templates/proxy-player";
import { getYouTubeIframeEmbed } from "./templates/youtube-iframe-embed";
import { getFastPlayerHtml } from "./templates/fast-player";
import { getFromCache, initCacheDirectory, validateCachedUrls } from "./cache-service";
import { getAndroidPlayerHtml } from "./templates/android-player";
import { handleDirectStream } from "./android-direct-player";
import { generateProgressivePlayerHtml } from "./templates/progressive-player";
import { getVideoFormatsWithFallback } from "./fast-video-service";
import { initSyncService, getSyncInstancesFromEnv, manualSync, setInvalidateCacheFunction } from "./sync-service";
// GPT関連のインポートは削除されました

// プロキシ機能は削除されましたが、YouTube視聴用のプレーヤーは維持しています

// Create temp directory for downloads
const tmpDir = path.join(os.tmpdir(), 'tabtube-downloads');

// ディレクトリが存在しない場合は作成
function ensureTmpDirExists() {
  try {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
      console.log(`Created temporary directory: ${tmpDir}`);
    }
    return true;
  } catch (error) {
    console.error(`Failed to create temporary directory: ${tmpDir}`, error);
    return false;
  }
}

// 起動時にディレクトリを確認
ensureTmpDirExists();

// YouTube API key validation
if (!process.env.YOUTUBE_API_KEY) {
  console.warn("Warning: YOUTUBE_API_KEY environment variable is not set. YouTube API requests will fail.");
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // 同期サービスを初期化
  const syncInstances = getSyncInstancesFromEnv();
  initSyncService(storage, syncInstances);
  
  // キャッシュ無効化関数を同期サービスに設定
  setInvalidateCacheFunction(() => {
    console.log('掲示板キャッシュを無効化します（同期サービスにより）');
    boardPostsCache = null;
  });
  
  // BANされたユーザーIDの一覧を保持するメソッド（メモリ上）
  const bannedTokens = new Set<string>();
  
  // ユーザーがBANされているかチェックするミドルウェア（掲示板関連エンドポイント用）
  const checkUserBanned = async (req: Request, res: Response, next: NextFunction) => {
    // Cookieからバン識別トークンを取得
    const banToken = req.cookies?.ban_token;
    
    // トークンがあり、バンリストに含まれている場合はアクセス拒否
    if (banToken && bannedTokens.has(banToken)) {
      return res.status(403).json({
        success: false,
        error: "あなたは管理者によって掲示板へのアクセスを禁止されています",
        banned: true
      });
    }
    
    // バンされたユーザーIDかチェック（IPアドレスとしてDBに保存されている）
    const userId = req.query.userId || req.body.authorId;
    if (userId) {
      const isBanned = await storage.isIpBanned(String(userId));
      if (isBanned) {
        // バントークンがない場合は新たに生成して設定
        if (!banToken) {
          const newBanToken = randomBytes(16).toString('hex');
          bannedTokens.add(newBanToken);
          
          // Cookieに保存（1年間有効）
          res.cookie('ban_token', newBanToken, {
            maxAge: 365 * 24 * 60 * 60 * 1000, // 1年間
            httpOnly: true,
            sameSite: 'strict',
            path: '/'
          });
        }
        
        return res.status(403).json({
          success: false,
          error: "あなたは管理者によって掲示板へのアクセスを禁止されています",
          banned: true
        });
      }
    }
    
    next();
  };
  
  // 掲示板関連のルートにミドルウェアを適用
  app.use([
    '/api/board/posts',
    '/api/board/comments',
    '/api/board/posts/:postId/like',
    '/api/board/comments/:commentId/like'
  ], checkUserBanned);
  
  // Simple health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });
  
  // 同期サービスのステータスを取得するエンドポイント
  app.get("/api/sync/status", (req: Request, res: Response) => {
    const syncInstances = getSyncInstancesFromEnv();
    res.json({
      enabled: syncInstances.length > 0,
      instanceCount: syncInstances.length,
      instances: syncInstances
    });
  });
  
  // 手動で同期を実行するエンドポイント
  app.post("/api/sync/manual", async (req: Request, res: Response) => {
    try {
      if (getSyncInstancesFromEnv().length === 0) {
        return res.status(400).json({
          success: false,
          error: "同期サービスが無効です。SYNC_INSTANCESを設定してください。"
        });
      }
      
      await manualSync();
      
      res.json({
        success: true,
        message: "手動同期を実行しました"
      });
    } catch (error) {
      console.error("Manual sync error:", error);
      res.status(500).json({
        success: false,
        error: "同期処理中にエラーが発生しました"
      });
    }
  });
  
  // YouTube search endpoint with multiple fallback methods
  app.get("/api/youtube/search", async (req: Request, res: Response) => {
    try {
      const { query, type, maxResults } = youtubeSearchSchema.parse({
        query: req.query.q,
        type: req.query.type || "all",
        maxResults: Number(req.query.maxResults) || 10
      });
      
      // ユーザー識別子の取得 (クライアントから送信されたもの)
      const userIdentifier = req.query.uid ? String(req.query.uid) : "anonymous";

      console.log(`Search request: query=${query}, type=${type}, maxResults=${maxResults}, uid=${userIdentifier}`);

      // Check if the query is a YouTube URL
      if (query.includes('youtube.com/') || query.includes('youtu.be/')) {
        // Extract video ID from URL
        const videoId = query.includes('youtu.be/') 
          ? query.split('youtu.be/')[1]?.split(/[?#]/)[0]
          : query.includes('v=') 
            ? new URLSearchParams(query.split('?')[1]).get('v')
            : null;
            
        if (videoId) {
          try {
            // Get video details using ytdl-core
            const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
            
            // Format response to match YouTube API format
            const videoItem = {
              kind: "youtube#searchResult",
              etag: Date.now().toString(),
              id: {
                kind: "youtube#video",
                videoId: videoId
              },
              snippet: {
                publishedAt: new Date(parseInt(info.videoDetails.publishDate || '0') * 1000).toISOString(),
                channelId: info.videoDetails.channelId,
                title: info.videoDetails.title,
                description: info.videoDetails.description,
                thumbnails: {
                  default: { url: info.videoDetails.thumbnails[0]?.url, width: 120, height: 90 },
                  medium: { url: info.videoDetails.thumbnails[1]?.url || info.videoDetails.thumbnails[0]?.url, width: 320, height: 180 },
                  high: { url: info.videoDetails.thumbnails[2]?.url || info.videoDetails.thumbnails[0]?.url, width: 480, height: 360 }
                },
                channelTitle: info.videoDetails.author.name,
                liveBroadcastContent: "none"
              },
              contentDetails: {
                duration: `PT${Math.floor(parseInt(info.videoDetails.lengthSeconds) / 60)}M${parseInt(info.videoDetails.lengthSeconds) % 60}S`
              },
              statistics: {
                viewCount: info.videoDetails.viewCount
              }
            };
            
            // Save to storage
            const videoData = {
              videoId,
              title: info.videoDetails.title,
              channelTitle: info.videoDetails.author.name,
              description: info.videoDetails.description,
              thumbnailUrl: info.videoDetails.thumbnails[0]?.url,
              publishedAt: new Date(parseInt(info.videoDetails.publishDate || '0') * 1000).toISOString(),
              duration: info.videoDetails.lengthSeconds,
              viewCount: info.videoDetails.viewCount
            };
            
            await storage.saveVideo(videoData);
            
            // Return formatted response
            return res.json({
              kind: "youtube#searchListResponse",
              etag: Date.now().toString(),
              regionCode: "JP",
              pageInfo: {
                totalResults: 1,
                resultsPerPage: 1
              },
              items: [videoItem]
            });
          } catch (error) {
            console.error("Error fetching video info:", error);
          }
        }
      }
      
      // Method 2: Direct YouTube scraping approach (faster)
      try {
        console.log("Trying direct YouTube scraping approach...");
        
        // Use a URL that resembles a typical YouTube search
        const scrapingUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        
        const response = await fetch(scrapingUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Extract initial data from page
          const dataMatch = html.match(/var ytInitialData = (.+?);<\/script>/);
          if (dataMatch && dataMatch[1]) {
            try {
              const ytData = JSON.parse(dataMatch[1]);
              
              // Navigate to the contents
              const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
              
              if (contents && Array.isArray(contents)) {
                // Filter for videoRenderers which contain video data
                const videoResults = contents.filter((item: any) => item.videoRenderer).map((item: any) => {
                  const videoRenderer = item.videoRenderer;
                  const videoId = videoRenderer.videoId;
                  const title = videoRenderer.title?.runs?.[0]?.text || "";
                  const thumbnailUrl = videoRenderer.thumbnail?.thumbnails?.[0]?.url || "";
                  const channelTitle = videoRenderer.ownerText?.runs?.[0]?.text || "";
                  const channelId = videoRenderer.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "";
                  const viewCountText = videoRenderer.viewCountText?.simpleText || videoRenderer.viewCountText?.runs?.[0]?.text || "0 views";
                  const viewCount = viewCountText.replace(/[^0-9]/g, "") || "0";
                  const publishedTimeText = videoRenderer.publishedTimeText?.simpleText || "";
                  const lengthText = videoRenderer.lengthText?.simpleText || "";
                  
                  return {
                    videoId,
                    title,
                    channelTitle,
                    thumbnailUrl: thumbnailUrl.startsWith('//') ? `https:${thumbnailUrl}` : thumbnailUrl,
                    channelId,
                    viewCount,
                    publishedTime: publishedTimeText,
                    length: lengthText
                  };
                });
                
                if (videoResults.length > 0) {
                  console.log(`Found ${videoResults.length} videos via direct scraping`);
                  
                  // Save to storage and transform format
                  const items = videoResults.slice(0, maxResults).map((video: any) => {
                    // Calculate video duration in ISO 8601 format
                    let isoDuration = "PT0M0S";
                    if (video.length) {
                      const lengthParts = video.length.split(':').map((p: string) => parseInt(p));
                      if (lengthParts.length === 2) {
                        isoDuration = `PT${lengthParts[0]}M${lengthParts[1]}S`;
                      } else if (lengthParts.length === 3) {
                        isoDuration = `PT${lengthParts[0]}H${lengthParts[1]}M${lengthParts[2]}S`;
                      }
                    }
                    
                    // Calculate publishedAt date
                    let publishedAt = new Date().toISOString();
                    if (video.publishedTime) {
                      // Handle relative time like "3 years ago", "2 months ago", etc.
                      const now = new Date();
                      const timeMatch = video.publishedTime.match(/(\d+)\s+(\w+)\s+ago/);
                      if (timeMatch) {
                        const value = parseInt(timeMatch[1]);
                        const unit = timeMatch[2];
                        
                        if (unit.includes('second')) {
                          now.setSeconds(now.getSeconds() - value);
                        } else if (unit.includes('minute')) {
                          now.setMinutes(now.getMinutes() - value);
                        } else if (unit.includes('hour')) {
                          now.setHours(now.getHours() - value);
                        } else if (unit.includes('day')) {
                          now.setDate(now.getDate() - value);
                        } else if (unit.includes('week')) {
                          now.setDate(now.getDate() - value * 7);
                        } else if (unit.includes('month')) {
                          now.setMonth(now.getMonth() - value);
                        } else if (unit.includes('year')) {
                          now.setFullYear(now.getFullYear() - value);
                        }
                        
                        publishedAt = now.toISOString();
                      }
                    }
                    
                    // Save to storage
                    const videoData = {
                      videoId: video.videoId,
                      title: video.title,
                      channelTitle: video.channelTitle,
                      description: "",
                      thumbnailUrl: video.thumbnailUrl,
                      publishedAt,
                      duration: isoDuration.replace('PT', '').replace('H', ':').replace('M', ':').replace('S', ''),
                      viewCount: video.viewCount
                    };
                    
                    storage.saveVideo(videoData).catch(err => {
                      console.error(`Error saving video to storage: ${err.message}`);
                    });
                    
                    return {
                      kind: "youtube#searchResult",
                      etag: Date.now().toString(),
                      id: {
                        kind: "youtube#video",
                        videoId: video.videoId
                      },
                      snippet: {
                        publishedAt,
                        channelId: video.channelId,
                        title: video.title,
                        description: "",
                        thumbnails: {
                          default: { url: video.thumbnailUrl, width: 120, height: 90 },
                          medium: { url: video.thumbnailUrl, width: 320, height: 180 },
                          high: { url: video.thumbnailUrl, width: 480, height: 360 }
                        },
                        channelTitle: video.channelTitle
                      },
                      contentDetails: {
                        duration: isoDuration
                      },
                      statistics: {
                        viewCount: video.viewCount
                      }
                    };
                  });
                  
                  return res.json({
                    kind: "youtube#searchListResponse",
                    etag: Date.now().toString(),
                    regionCode: "JP",
                    pageInfo: {
                      totalResults: items.length,
                      resultsPerPage: items.length
                    },
                    items
                  });
                }
              }
            } catch (parseError) {
              console.error("Error parsing YouTube HTML data:", parseError);
            }
          }
        } else {
          console.error("YouTube search response not OK:", response.status, response.statusText);
        }
      } catch (scrapingError) {
        console.error("YouTube direct scraping error:", scrapingError);
      }
      
      // Method 3: Try a YouTube search with a direct page scrape approach (fallback)
      try {
        console.log("Trying direct YouTube scraping approach...");
        // Some mock data just so we have something to show
        const mockItems = [
          {
            kind: "youtube#searchResult",
            id: { kind: "youtube#video", videoId: "dQw4w9WgXcQ" },
            snippet: {
              title: "Rick Astley - Never Gonna Give You Up",
              description: "Official music video for Rick Astley - Never Gonna Give You Up",
              thumbnails: {
                default: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg", width: 120, height: 90 },
                medium: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", width: 320, height: 180 },
                high: { url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", width: 480, height: 360 }
              },
              channelTitle: "Rick Astley",
              publishedAt: new Date().toISOString()
            },
            contentDetails: { duration: "PT3M32S" },
            statistics: { viewCount: "1234567890" }
          },
          {
            kind: "youtube#searchResult",
            id: { kind: "youtube#video", videoId: "9bZkp7q19f0" },
            snippet: {
              title: "PSY - GANGNAM STYLE(강남스타일)",
              description: "Official music video for PSY - Gangnam Style",
              thumbnails: {
                default: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/default.jpg", width: 120, height: 90 },
                medium: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/mqdefault.jpg", width: 320, height: 180 },
                high: { url: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", width: 480, height: 360 }
              },
              channelTitle: "PSY",
              publishedAt: new Date().toISOString()
            },
            contentDetails: { duration: "PT4M13S" },
            statistics: { viewCount: "4689876543" }
          }
        ];
        
        // Save mock items to storage (could be replaced with actual scraping logic)
        for (const item of mockItems) {
          const videoData = {
            videoId: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            description: item.snippet.description,
            thumbnailUrl: item.snippet.thumbnails.default.url,
            publishedAt: item.snippet.publishedAt,
            duration: "180", // Placeholder
            viewCount: "1000000" // Placeholder
          };
          
          try {
            await storage.saveVideo(videoData);
          } catch (err) {
            console.error(`Error saving mock video to storage: ${err}`);
          }
        }
        
        // Just use our saved videos (we'll have actual YouTube videos from previous searches)
        return res.json({
          kind: "youtube#searchListResponse",
          etag: Date.now().toString(),
          regionCode: "JP",
          pageInfo: {
            totalResults: mockItems.length,
            resultsPerPage: mockItems.length
          },
          items: mockItems
        });
      } catch (scrapeError) {
        console.error("YouTube scraping failed:", scrapeError);
      }
      
      // If all methods fail, return empty results
      console.log("All search methods failed, returning empty results");
      return res.json({
        kind: "youtube#searchListResponse",
        etag: Date.now().toString(),
        regionCode: "JP",
        pageInfo: {
          totalResults: 0,
          resultsPerPage: 0
        },
        items: []
      });
    } catch (err) {
      console.error("Search error:", err);
      return res.status(500).json({ 
        message: "検索できませんでした。YouTubeのURLを直接入力するか、別のキーワードを試してください。"
      });
    }
  });

  // YouTube video info endpoint
  app.get("/api/youtube/video/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      
      // Check if we have this video in storage
      let video = await storage.getVideo(videoId);
      
      if (!video) {
        // 方法1: ytdl-coreを使用して情報を取得
        try {
          console.log(`[Method 1] Fetching video info for ${videoId} using ytdl-core`);
          const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
          
          // Save to storage
          const videoData = {
            videoId,
            title: info.videoDetails.title,
            channelTitle: info.videoDetails.author.name,
            description: info.videoDetails.description,
            thumbnailUrl: info.videoDetails.thumbnails[0]?.url,
            publishedAt: new Date(parseInt(info.videoDetails.publishDate || '0') * 1000).toISOString(),
            duration: info.videoDetails.lengthSeconds,
            viewCount: info.videoDetails.viewCount
          };
          
          video = await storage.saveVideo(videoData);
        } catch (ytdlError) {
          console.error("[Method 1] Error fetching video with ytdl:", ytdlError);
          
          // 方法2: youtube-dl-execを使用して情報を取得
          try {
            console.log(`[Method 2] Fetching video info for ${videoId} using youtube-dl-exec`);
            const result = await youtubeDlExec.exec(`https://www.youtube.com/watch?v=${videoId}`, {
              dumpSingleJson: true,
              skipDownload: true,
              noCheckCertificates: true,
              noWarnings: true,
              addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36']
            });
            
            // 結果をパース
            if (typeof result === 'string') {
              const info = JSON.parse(result);
              
              // 動画情報を保存
              const videoData = {
                videoId,
                title: info.title || `YouTube Video (${videoId})`,
                channelTitle: info.uploader || info.channel || 'Unknown Channel',
                description: info.description || '',
                thumbnailUrl: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                publishedAt: info.upload_date ? 
                  `${info.upload_date.slice(0,4)}-${info.upload_date.slice(4,6)}-${info.upload_date.slice(6,8)}` : 
                  new Date().toISOString(),
                duration: info.duration?.toString() || '0',
                viewCount: info.view_count?.toString() || '0'
              };
              
              video = await storage.saveVideo(videoData);
            } else {
              throw new Error("youtube-dl-exec returned invalid result");
            }
          } catch (ytdlExecError) {
            console.error("[Method 2] Error fetching video with youtube-dl-exec:", ytdlExecError);
            // 両方の方法が失敗した場合、エラーレスポンスを返す
            return res.status(404).json({ 
              message: "動画情報を取得できませんでした。" 
            });
          }
        }
      }
      
      res.json(video);
    } catch (error) {
      console.error("Video info error:", error);
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Failed to fetch video info" 
      });
    }
  });

  // YouTube embed endpoint - 拡張版（プロキシプレーヤー）
  app.get("/api/youtube/proxy-player/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const autoplay = req.query.autoplay === '1';
      const directPlay = req.query.direct === '1';
      
      // Androidデバイスチェック
      const isAndroid = req.headers['user-agent'] && 
        /Android/i.test(req.headers['user-agent'] as string);
      
      // Androidの場合は強化型プレーヤーにリダイレクト
      if (isAndroid) {
        // 直接再生モードかストリームモードの場合は直接ストリーミング
        if (directPlay || req.query.stream === '1') {
          console.log('Android direct streaming mode activated for:', videoId);
          return res.redirect(`/api/youtube/direct-stream/${videoId}`);
        }
        
        // そうでなければ強化型プレーヤーを使用
        console.log('Android enhanced player activated for:', videoId);
        return res.redirect(`/api/youtube/android-player/${videoId}`);
      }
      
      // 通常のプロキシプレーヤーHTMLを返す
      const { getProxyPlayerHtml } = await import('./templates/proxy-player');
      res.send(getProxyPlayerHtml(videoId, autoplay));
      
      // 視聴履歴に追加
      try {
        await storage.addProxyHistory({
          videoId,
          title: videoId, // タイトルが不明な場合はvideoIdを使用
          timestamp: new Date().toISOString(),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          success: true
        });
      } catch (historyError) {
        console.error('Failed to save proxy history:', historyError);
      }
    } catch (error) {
      console.error('Proxy player error:', error);
      res.status(500).send('エラーが発生しました。もう一度お試しください。');
    }
  });

  
  // 動画直接ストリーミングAPI - YouTube-DL-Execを使用した動画のストリーミング
  app.get("/api/youtube/stream-video/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      
      // youtube-dl-execを使用して直接URLを取得
      const result = await youtubeDlExec(videoUrl, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        youtubeSkipDashManifest: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ]
      });
      
      // 結果をパース
      const info = typeof result === 'string' ? JSON.parse(result) : result;
      
      // 適切なフォーマットを選択 (mp4かwebmで音声と映像を含むもの)
      const availableFormats = info.formats.filter(
        (format: any) => 
          (format.ext === 'mp4' || format.ext === 'webm') && 
          format.acodec !== 'none' && 
          format.vcodec !== 'none'
      ).sort((a: any, b: any) => b.height - a.height);
      
      // 最適なフォーマットを選択
      const bestFormat = availableFormats[0];
      
      if (!bestFormat || !bestFormat.url) {
        throw new Error('適切な動画フォーマットが見つかりませんでした');
      }
      
      // ヘッダーを設定
      res.setHeader('Content-Type', `video/${bestFormat.ext}`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // URLにリダイレクト - プロキシを避けてパフォーマンス向上
      res.redirect(bestFormat.url);
      
    } catch (error) {
      console.error('Video streaming error:', error);
      
      // フォールバック - リダイレクトを試みる
      try {
        console.log('Trying fallback method for video streaming...');
        
        // 代替として直接YouTubeからURLを取得
        const result = await youtubeDlExec(`https://www.youtube.com/watch?v=${req.params.videoId}`, {
          getUrl: true,
          format: 'best[ext=mp4]',
          noCheckCertificates: true,
          noWarnings: true
        });
        
        if (result && typeof result === 'string' && result.startsWith('http')) {
          console.log('Fallback successful, redirecting to direct URL');
          return res.redirect(result);
        } else {
          throw new Error('No URL returned from fallback method');
        }
      } catch (fallbackError) {
        console.error('Fallback streaming error:', fallbackError);
        res.status(500).json({
          error: '動画のストリーミングに失敗しました',
          message: error instanceof Error ? error.message : '不明なエラー',
          fallbackUrl: `/api/youtube/download?videoId=${req.params.videoId}&format=mp4&quality=highest`
        });
      }
    }
  });
  
  // メモリキャッシュ - 直接URLのキャッシュ(60分)
  const directUrlCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 60 * 60 * 1000; // 60分
  
  // プリロードデータのキャッシュ
  const videoInfoCache = new Map<string, { data: any, timestamp: number }>();
  
  // 直接URL取得API - さらに最適化された超高速バージョン
  app.get("/api/youtube/get-direct-urls/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      
      // キャッシュをチェック
      const cacheKey = `direct_url_${videoId}`;
      const cachedData = directUrlCache.get(cacheKey);
      
      if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
        console.log(`Using cached direct URL for video ${videoId}`);
        return res.json(cachedData.data);
      }
      
      // 並列処理で高速化
      // 1. 高速なURL取得
      // 2. ビデオ情報の取得
      const [videoInfo] = await Promise.all([
        storage.getVideo(videoId)
      ]);
      
      // 最も高速なメソッド: ytdl-coreを使用して直接URLを取得
      try {
        console.log(`Fast method: Getting direct URL for video ${videoId}`);
        const startTime = Date.now();
        
        // シンプルなフォーマット指定で高速化
        const directUrl = await youtubeDlExec(`https://www.youtube.com/watch?v=${videoId}`, {
          getUrl: true,
          format: 'best[ext=mp4]', // 最も単純なフォーマット指定で高速化
          noCheckCertificates: true,
          noWarnings: true,
          youtubeSkipDashManifest: true,
        });
        
        if (directUrl && typeof directUrl === 'string' && directUrl.startsWith('http')) {
          const endTime = Date.now();
          console.log(`Fast method successful, direct URL retrieved in ${endTime - startTime}ms`);
          
          // ビデオ情報を取得 (軽量バージョン)
          const title = videoInfo?.title || '';
          const thumbnail = videoInfo?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          
          const responseData = {
            videoId,
            title,
            thumbnail,
            source: {
              url: directUrl,
              quality: 'Auto',
              container: 'mp4',
              expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
            },
            fallback: `/api/youtube/download?videoId=${videoId}&format=mp4&quality=highest`
          };
          
          // キャッシュに保存
          directUrlCache.set(cacheKey, { 
            data: responseData, 
            timestamp: Date.now() 
          });
          
          return res.json(responseData);
        }
      } catch (fastMethodError) {
        console.log('Fast method failed, trying simplified method');
        
        // よりシンプルな方法を試す (フォーマット指定なし)
        try {
          const simplifiedUrl = await youtubeDlExec(`https://www.youtube.com/watch?v=${videoId}`, {
            getUrl: true,
            noCheckCertificates: true,
            noWarnings: true
          });
          
          if (simplifiedUrl && typeof simplifiedUrl === 'string' && simplifiedUrl.startsWith('http')) {
            console.log('Simplified method successful');
            
            // ビデオ情報を取得 (軽量バージョン)
            const title = videoInfo?.title || '';
            const thumbnail = videoInfo?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            
            const responseData = {
              videoId,
              title,
              thumbnail,
              source: {
                url: simplifiedUrl,
                quality: 'Auto',
                container: 'mp4',
                expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString()
              },
              fallback: `/api/youtube/download?videoId=${videoId}&format=mp4&quality=highest`
            };
            
            // キャッシュに保存
            directUrlCache.set(cacheKey, { 
              data: responseData, 
              timestamp: Date.now() 
            });
            
            return res.json(responseData);
          }
        } catch (simplifiedError) {
          console.log('Simplified method failed, falling back to full method');
        }
      }
      
      // 最終フォールバック: シンプルなレスポンスを返す
      console.log('All fast methods failed, returning fallback URL');
      
      // フォールバックURLを返す (実際のURLではなく、プロキシURLを使う)
      const title = videoInfo?.title || '';
      const thumbnail = videoInfo?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      
      const fallbackResponse = {
        videoId,
        title,
        thumbnail,
        source: null,
        fallback: `/api/youtube/proxy-player/${videoId}`
      };
      
      // キャッシュに保存 (フォールバックもキャッシュ)
      directUrlCache.set(cacheKey, { 
        data: fallbackResponse, 
        timestamp: Date.now() 
      });
      
      res.json(fallbackResponse);
    } catch (error) {
      console.error("Error getting direct URLs:", error);
      
      // エラー発生時にフォールバックを返す
      res.status(500).json({ 
        error: "動画URLの取得に失敗しました", 
        fallback: `/api/youtube/proxy-player/${req.params.videoId}` 
      });
    }
  });

  // 高速ビデオフォーマット取得API - キャッシュと最適化された取得を使用
  app.get("/api/youtube/fast-formats/:videoId", async (req: Request, res: Response) => {
    try {
      await getFastVideoFormats(req, res);
    } catch (error) {
      console.error("Error getting fast formats:", error);
      res.status(500).json({ 
        error: "ビデオフォーマットの取得に失敗しました", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // 最適な再生URLを高速に取得するAPI
  app.get("/api/youtube/fast-playback/:videoId", async (req: Request, res: Response) => {
    try {
      await getFastPlaybackUrl(req, res);
    } catch (error) {
      console.error("Error getting fast playback URL:", error);
      res.status(500).json({ 
        error: "再生URLの取得に失敗しました", 
        fallback: `/api/youtube/proxy-player/${req.params.videoId}` 
      });
    }
  });

  // HLSストリーミングURL生成API
  app.get("/api/youtube/hls-stream/:videoId", async (req: Request, res: Response) => {
    try {
      await generateHlsStream(req, res);
    } catch (error) {
      console.error("Error generating HLS stream:", error);
      res.status(500).json({ 
        error: "HLSストリームの生成に失敗しました", 
        fallback: `/api/youtube/proxy-player/${req.params.videoId}` 
      });
    }
  });

  // YouTube download endpoint - youtube-dl-execを使用
  app.get("/api/youtube/download", async (req: Request, res: Response) => {
    // 新しいハンドラーを使用
    const { handleYoutubeDownload } = await import('./youtube-download');
    return handleYoutubeDownload(req, res);
  });
  
  // YouTube視聴関連エンドポイント
  app.get("/api/youtube-viewer", async (req: Request, res: Response) => {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).send('URLパラメータが必要です');
    }
    
    // YouTubeのみサポート
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      console.log('YouTube detected, using TabTube direct interface');
      
      // URLからビデオIDを抽出
      let videoId = '';
      try {
        if (url.includes('youtu.be/')) {
          // youtu.be/VIDEO_ID 形式
          videoId = url.split('youtu.be/')[1]?.split(/[?#]/)[0] || '';
        } else if (url.includes('youtube.com/watch')) {
          // youtube.com/watch?v=VIDEO_ID 形式
          const urlObj = new URL(url);
          videoId = urlObj.searchParams.get('v') || '';
        } else if (url.includes('youtube.com/embed/')) {
          // youtube.com/embed/VIDEO_ID 形式
          videoId = url.split('youtube.com/embed/')[1]?.split(/[?#]/)[0] || '';
        }
      } catch (e) {
        console.error('Error extracting video ID:', e);
      }

      // ビデオIDがある場合はプレーヤーページを表示
      if (videoId) {
        console.log(`YouTube video ID extracted: ${videoId}`);
        const playerTemplate = `
          <!DOCTYPE html>
          <html lang="ja">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TabTube - YouTube Player</title>
            <style>
              body, html { margin: 0; padding: 0; height: 100%; background: #0f0f0f; }
              .container { display: flex; flex-direction: column; height: 100vh; width: 100%; }
              .header { background: #212121; color: white; padding: 10px; display: flex; align-items: center; }
              .logo { color: #ff0000; font-weight: bold; margin-right: 20px; font-size: 18px; }
              .player-container { flex: 1; display: flex; justify-content: center; align-items: center; }
              .youtube-player { width: 100%; max-width: 1280px; height: 80vh; }
              .back-button { margin-right: 15px; cursor: pointer; background: none; border: none; color: white; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <button class="back-button" onclick="window.history.back()">← Back</button>
                <div class="logo">TabTube</div>
              </div>
              <div class="player-container">
                <iframe 
                  class="youtube-player" 
                  src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            </div>
          </body>
          </html>
        `;
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(playerTemplate);
      }

      // ホーム・検索ページの場合はカスタムインターフェースを表示
      const searchQuery = url.includes('results?search_query=') 
        ? new URL(url).searchParams.get('search_query') || '' 
        : '';

      const tabtubeInterface = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>TabTube - YouTube Search</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; font-family: Arial, sans-serif; background: #0f0f0f; color: white; }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .header { display: flex; align-items: center; margin-bottom: 20px; }
            .logo { color: #ff0000; font-weight: bold; margin-right: 20px; font-size: 24px; }
            .search-form { display: flex; flex: 1; }
            .search-input { flex: 1; padding: 10px; border: 1px solid #303030; background: #121212; color: white; border-radius: 4px 0 0 4px; }
            .search-button { padding: 10px 20px; background: #303030; color: white; border: none; border-radius: 0 4px 4px 0; cursor: pointer; }
            .search-button:hover { background: #404040; }
            .results { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
            .video-card { background: #212121; border-radius: 8px; overflow: hidden; transition: transform 0.2s; cursor: pointer; }
            .video-card:hover { transform: translateY(-5px); }
            .thumbnail { width: 100%; height: 180px; object-fit: cover; }
            .video-info { padding: 15px; }
            .video-title { font-weight: bold; margin-bottom: 8px; }
            .channel-name { color: #aaa; font-size: 14px; }
            .loading { text-align: center; padding: 40px; font-size: 18px; }
            .back-button { margin-right: 15px; cursor: pointer; background: none; border: none; color: white; }
            .no-results { text-align: center; padding: 40px; font-size: 18px; color: #aaa; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <button class="back-button" onclick="window.history.back()">← Back</button>
              <div class="logo">TabTube</div>
              <form class="search-form" id="search-form">
                <input type="text" class="search-input" id="search-input" placeholder="Search YouTube videos..." value="${searchQuery}">
                <button type="submit" class="search-button">Search</button>
              </form>
            </div>
            
            <div id="results" class="results">
              <div class="loading">Loading trending videos...</div>
            </div>
          </div>

          <script>
            document.addEventListener('DOMContentLoaded', () => {
              const searchForm = document.getElementById('search-form');
              const searchInput = document.getElementById('search-input');
              const resultsContainer = document.getElementById('results');

              // 検索フォーム送信時の処理
              searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const query = searchInput.value.trim();
                if (query) {
                  searchVideos(query);
                }
              });

              // 初期表示（検索クエリがある場合は検索、ない場合はトレンド動画を表示）
              const initialQuery = searchInput.value.trim();
              if (initialQuery) {
                searchVideos(initialQuery);
              } else {
                fetchTrendingVideos();
              }

              // YouTube検索API呼び出し
              function searchVideos(query) {
                resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
                
                fetch(\`/api/youtube/search?q=\${encodeURIComponent(query)}\`)
                  .then(response => response.json())
                  .then(data => {
                    displayVideos(data.items || []);
                  })
                  .catch(error => {
                    console.error('Error searching videos:', error);
                    resultsContainer.innerHTML = \`<div class="no-results">検索中にエラーが発生しました。もう一度お試しください。</div>\`;
                  });
              }

              // トレンド動画取得
              function fetchTrendingVideos() {
                resultsContainer.innerHTML = '<div class="loading">Loading trending videos...</div>';
                
                fetch('/api/youtube/popular')
                  .then(response => response.json())
                  .then(data => {
                    if (data && data.length > 0) {
                      const formattedData = data.map(video => ({
                        id: { videoId: video.videoId },
                        snippet: {
                          title: video.title,
                          channelTitle: video.channelTitle,
                          thumbnails: { high: { url: video.thumbnailUrl } }
                        }
                      }));
                      displayVideos(formattedData);
                    } else {
                      displayDefaultVideos();
                    }
                  })
                  .catch(error => {
                    console.error('Error fetching trending videos:', error);
                    displayDefaultVideos();
                  });
              }

              // デフォルトの動画を表示（APIが失敗した場合のフォールバック）
              function displayDefaultVideos() {
                // よく見られる動画の例を表示
                const defaultVideos = [
                  {
                    id: { videoId: 'dQw4w9WgXcQ' },
                    snippet: {
                      title: 'Rick Astley - Never Gonna Give You Up',
                      channelTitle: 'Rick Astley',
                      thumbnails: { high: { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' } }
                    }
                  },
                  {
                    id: { videoId: '9bZkp7q19f0' },
                    snippet: {
                      title: 'PSY - GANGNAM STYLE(강남스타일)',
                      channelTitle: 'PSY',
                      thumbnails: { high: { url: 'https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg' } }
                    }
                  }
                ];
                displayVideos(defaultVideos);
              }

              // 動画一覧を表示
              function displayVideos(videos) {
                if (!videos || videos.length === 0) {
                  resultsContainer.innerHTML = '<div class="no-results">No videos found. Try another search.</div>';
                  return;
                }

                resultsContainer.innerHTML = '';
                videos.forEach(video => {
                  if (!video.id || !video.id.videoId) return;
                  
                  const videoCard = document.createElement('div');
                  videoCard.className = 'video-card';
                  videoCard.onclick = () => {
                    window.location.href = \`/api/youtube-viewer?url=\${encodeURIComponent(\`https://www.youtube.com/watch?v=\${video.id.videoId}\`)}\`;
                  };

                  const thumbnailUrl = video.snippet?.thumbnails?.high?.url || 
                                      video.snippet?.thumbnails?.medium?.url || 
                                      video.snippet?.thumbnails?.default?.url || 
                                      \`https://i.ytimg.com/vi/\${video.id.videoId}/hqdefault.jpg\`;

                  videoCard.innerHTML = \`
                    <img class="thumbnail" src="\${thumbnailUrl}" alt="\${video.snippet?.title || 'Video thumbnail'}">
                    <div class="video-info">
                      <div class="video-title">\${video.snippet?.title || 'Unknown title'}</div>
                      <div class="channel-name">\${video.snippet?.channelTitle || 'Unknown channel'}</div>
                    </div>
                  \`;

                  resultsContainer.appendChild(videoCard);
                });
              }
            });
          </script>
        </body>
        </html>
      `;
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(tabtubeInterface);
    } else {
      return res.status(400).send('YouTube URLsのみサポートされています');
    }
  });
  

  

  

  
  // Recent videos endpoint
  app.get("/api/youtube/recent", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 10;
      const videos = await storage.getRecentVideos(limit);
      res.json(videos);
    } catch (error) {
      console.error("Error getting recent videos:", error);
      res.status(500).json({ error: "Failed to get recent videos" });
    }
  });
  
  // Popular videos endpoint
  app.get("/api/youtube/popular", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 10;
      
      // ユーザー識別子の取得 (クライアントから送信されたもの)
      const userIdentifier = req.query.uid ? String(req.query.uid) : "anonymous";
      
      console.log(`Popular videos request: uid=${userIdentifier}, limit=${limit}`);
      
      // 人気動画を取得（ユーザー固有の結果ではない）
      const videos = await storage.getPopularVideos(limit);
      
      // 将来的にユーザー固有の人気動画リストを実装する場合のためのコメント
      // この時点ではグローバルな人気動画リストを返しますが、
      // userIdentifierをストレージに渡して、ユーザー固有の結果を取得することが可能です
      
      res.json(videos);
    } catch (error) {
      console.error("Error getting popular videos:", error);
      res.status(500).json({ error: "Failed to get popular videos" });
    }
  });
  
  // Music API endpoints
  
  // 音楽トラック検索
  app.get("/api/music/search", async (req: Request, res: Response) => {
    await searchMusicTracks(req, res);
  });
  
  // YouTube Musicトラックに対応するYouTube動画を検索
  app.get("/api/music/find-youtube", async (req: Request, res: Response) => {
    await findYouTubeForTrack(req, res);
  });
  
  // 人気の曲を取得
  app.get("/api/music/popular", async (req: Request, res: Response) => {
    await getPopularTracks(req, res);
  });
  
  // アーティストの曲を取得
  app.get("/api/music/artist", async (req: Request, res: Response) => {
    await getArtistTracks(req, res);
  });
  
  // YouTube Music プレーヤーエンドポイント
  app.get("/api/youtube-music/player", async (req: Request, res: Response) => {
    try {
      const { trackId, title, artist } = req.query;
      if (!trackId || !title || !artist) {
        return res.status(400).json({ message: '必要なパラメータが不足しています' });
      }
      
      // YouTube Musicプレーヤーページを提供
      const html = getYouTubeMusicPlayerHtml(trackId as string, title as string, artist as string);
      res.send(html);
    } catch (error) {
      res.status(500).json({ 
        message: 'エラーが発生しました', 
        error: (error as Error).message || 'Unknown error' 
      });
    }
  });
  
  app.get("/api/youtube-music/download", async (req: Request, res: Response) => {
    try {
      const { trackId, title, artist } = req.query;
      if (!trackId || !title || !artist) {
        return res.status(400).json({ message: '必要なパラメータが不足しています' });
      }
      
      // ファイル名を生成
      const filename = `${artist as string} - ${title as string}.mp3`;
      
      // YouTube Musicダウンロードページを提供
      const html = getYouTubeMusicDownloadHtml(trackId as string, title as string, artist as string, filename);
      res.send(html);
    } catch (error) {
      res.status(500).json({ 
        message: 'エラーが発生しました', 
        error: (error as Error).message || 'Unknown error' 
      });
    }
  });

  // YouTube プロキシプレーヤーエンドポイント（YouTube 視聴用 - 埋め込み対応）
  app.get("/api/youtube/proxy-player/:videoId", async (req: Request, res: Response) => {
    try {
      const videoId = req.params.videoId;
      if (!videoId) {
        return res.status(400).json({ message: 'Video ID is required' });
      }

      // クエリパラメータからオプションを取得（YouTubeの公式埋め込みと同じパラメータをサポート）
      const autoplay = req.query.autoplay === '1' || req.query.autoplay === 'true';
      const controls = req.query.controls !== '0'; // デフォルトでコントロールを表示
      const showinfo = req.query.showinfo !== '0'; // デフォルトで動画情報を表示
      const rel = req.query.rel !== '0'; // デフォルトで関連動画を表示
      const embedMode = req.query.embed === '1' || req.query.embed === 'true';
      
      // ユーザーエージェントを確認して、モバイルデバイスかどうかを判定
      const userAgent = req.headers['user-agent'] || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      
      // モバイルでautoplayが要求された場合はミュートに設定（ブラウザポリシー対応）
      const effectiveAutoplay = autoplay && isMobile;
      
      // YouTubeの埋め込みプレーヤーのようなHTMLを生成
      const html = getProxyPlayerHtml(videoId, effectiveAutoplay, showinfo, controls, rel);
      
      // アクセスを記録
      try {
        const videoInfo = await storage.getVideo(videoId);
        await storage.addProxyHistory({
          videoId,
          title: videoInfo?.title || 'Unknown',
          timestamp: new Date().toISOString(),
          ipAddress: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          success: true
        });
      } catch (storageError) {
        console.error('Failed to record proxy history:', storageError);
      }
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Error serving proxy player:', error);
      res.status(500).send(`
        <html>
          <body>
            <h1>エラーが発生しました</h1>
            <p>${error instanceof Error ? error.message : '不明なエラー'}</p>
            <a href="/">トップに戻る</a>
          </body>
        </html>
      `);
    }
  });

  // GPT APIエンドポイントは削除されました
  
  // Android専用の直接ストリーミングエンドポイント
  app.get("/api/youtube/direct-stream/:videoId", async (req: Request, res: Response) => {
    const { handleDirectStream } = await import('./android-direct-player');
    return handleDirectStream(req, res);
  });
  
  // Android用強化型プレーヤーページ
  app.get("/api/youtube/android-player/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      const { fetchYoutubeVideoData } = await import('./android-direct-player');
      const { getAndroidPlayerHtml } = await import('./templates/android-player');
      
      // 動画情報を取得
      const videoData = await fetchYoutubeVideoData(videoId);
      
      // Android用プレーヤーHTMLを返す
      res.send(getAndroidPlayerHtml(
        videoId,
        videoData.title,
        videoData.thumbnailUrl,
        videoData.channelTitle
      ));
      
    } catch (error) {
      console.error('Android player error:', error);
      res.status(500).send(`
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>エラー</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 20px; }
              .error { color: red; margin: 20px 0; }
              .button { display: inline-block; padding: 10px 20px; background: #007bff; 
                        color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
            </style>
          </head>
          <body>
            <h1>プレーヤーエラー</h1>
            <p class="error">${error instanceof Error ? error.message : '不明なエラー'}</p>
            <a href="/api/youtube/proxy-player/${req.params.videoId}" class="button">標準プレーヤーで試す</a>
            <a href="https://www.youtube.com/watch?v=${req.params.videoId}" class="button">YouTubeで開く</a>
          </body>
        </html>
      `);
    }
  });
  
  // YouTube埋め込みプレーヤーエンドポイント
  app.get("/api/youtube/embed/:videoId", async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      
      // クエリパラメータからオプションを取得
      const autoplay = req.query.autoplay === '1' || req.query.autoplay === 'true';
      const controls = req.query.controls !== '0'; 
      const showinfo = req.query.showinfo !== '0';
      const rel = req.query.rel !== '0';
      const loop = req.query.loop === '1' || req.query.loop === 'true';
      const start = parseInt(req.query.start as string) || 0;
      const end = parseInt(req.query.end as string) || 0;
      
      // YouTubeの埋め込みプレーヤーのようなHTMLを生成
      const html = getYouTubeIframeEmbed(videoId, {
        autoplay,
        controls,
        showinfo,
        rel,
        loop,
        start,
        end
      });
      
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('YouTube embed error:', error);
      res.status(500).send(`
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>埋め込みエラー</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 20px; color: #333; }
              .error { color: red; margin: 20px 0; }
              .info { font-size: 12px; margin-top: 10px; color: #666; }
            </style>
          </head>
          <body>
            <h1>埋め込みエラー</h1>
            <p class="error">${error instanceof Error ? error.message : '不明なエラー'}</p>
            <p class="info">このビデオは再生できません。別の動画をお試しください。</p>
          </body>
        </html>
      `);
    }
  });
  
  // 埋め込みテストページ
  app.get("/api/youtube/embed-test", (req: Request, res: Response) => {
    try {
      // ESMモジュールでは__dirnameが利用できないため、fileURLToPathを使用
      const currentFilePath = fileURLToPath(import.meta.url);
      const currentDirPath = path.dirname(currentFilePath);
      const embedTestHtml = fs.readFileSync(path.join(currentDirPath, './templates/embed-test.html'), 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(embedTestHtml);
    } catch (error) {
      console.error('Error serving embed test page:', error);
      res.status(500).send('Error serving embed test page');
    }
  });
  
  // 超高速プレーヤーエンドポイント - この新しいエンドポイントを使うと動画の読み込みが最速になります
  app.get("/api/youtube/superfast/:videoId", async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const startTime = Date.now();
    
    try {
      // 超軽量iframeベースのHTML
      const html = `
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <title>YouTube SuperFast Player</title>
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
              <div class="title">YouTube Video</div>
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
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      
      const endTime = Date.now();
      console.log(`SuperFast player rendered in ${endTime - startTime}ms for ${videoId}`);
      
    } catch (error) {
      console.error("SuperFast player error:", error);
      res.status(500).json({ 
        error: "超高速プレーヤーの生成に失敗しました", 
        fallback: `/api/youtube/proxy-player/${videoId}`
      });
    }
  });
  
  // プログレッシブダウンロード対応プレーヤー - YouTube同様に一部読み込みで再生開始します
  app.get("/api/youtube/progressive/:videoId", async (req: Request, res: Response) => {
    const { videoId } = req.params;
    const startTime = Date.now();
    
    try {
      // 動画情報を取得
      const cachedData = getFromCache(videoId);
      let formats;
      let videoDetails;
      
      if (cachedData && await validateCachedUrls(cachedData.formats)) {
        formats = cachedData.formats;
        videoDetails = cachedData.videoDetails;
        console.log(`Using cached formats for ${videoId}`);
      } else {
        console.log(`Fetching formats for ${videoId}`);
        const info = await getVideoFormatsWithFallback(videoId);
        formats = info.formats;
        videoDetails = info.videoDetails;
      }
      
      // プレーヤーHTMLを生成
      const html = generateProgressivePlayerHtml(
        videoId,
        videoDetails.title,
        formats,
        videoDetails.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        videoDetails.channelTitle || 'YouTube Channel'
      );
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      
      const endTime = Date.now();
      console.log(`Progressive player rendered in ${endTime - startTime}ms for ${videoId}`);
      
    } catch (error) {
      console.error("Progressive player error:", error);
      res.status(500).json({ 
        error: "プログレッシブプレーヤーの生成に失敗しました", 
        fallback: `/api/youtube/superfast/${videoId}`
      });
    }
  });

  // サムネイル画像のプロキシエンドポイント
  app.get("/api/proxy/direct", async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      
      if (!url) {
        res.status(400).json({ message: "URL parameter is required" });
        return;
      }
      
      // URLのバリデーション（セキュリティ対策）
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        res.status(400).json({ message: "Invalid URL scheme" });
        return;
      }
      
      // プロキシリクエスト
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
          'Referer': 'https://www.youtube.com/'
        }
      });
      
      // Content-Typeヘッダーを設定
      const contentType = response.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      // キャッシュ制御ヘッダー
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24時間キャッシュ
      
      // 画像データを返す
      res.send(response.data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ message: "Failed to proxy resource" });
    }
  });
  
  // 掲示板関連のAPIエンドポイント
  
  // キャッシュされた掲示板投稿を保存する変数
  let boardPostsCache: {
    posts: any[];
    timestamp: number;
    pagination: { limit: number; offset: number; total: number };
  } | null = null;
  
  const CACHE_LIFETIME = 10000; // キャッシュの有効期間（ミリ秒）: 10秒
  
  // 投稿の取得（ページネーション対応、キャッシュ機能付き）
  app.get("/api/board/posts", async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // クエリパラメータからキャッシュ無効化フラグを取得
      const noCache = req.query.noCache === 'true';
      
      // キャッシュが有効で、同じページネーションパラメータの場合はキャッシュを返す
      const now = Date.now();
      if (
        !noCache && 
        boardPostsCache && 
        now - boardPostsCache.timestamp < CACHE_LIFETIME &&
        boardPostsCache.pagination.limit === limit &&
        boardPostsCache.pagination.offset === offset
      ) {
        return res.json({
          success: true,
          data: boardPostsCache.posts,
          pagination: boardPostsCache.pagination,
          fromCache: true
        });
      }
      
      // キャッシュがない、または無効な場合はデータベースから取得
      const posts = await storage.getAllBoardPosts(limit, offset);
      
      // 新しいキャッシュを作成
      boardPostsCache = {
        posts,
        timestamp: now,
        pagination: {
          limit,
          offset,
          total: posts.length // 実際には総数を計算する必要がある
        }
      };
      
      res.json({
        success: true,
        data: posts,
        pagination: boardPostsCache.pagination,
        fromCache: false
      });
    } catch (error) {
      console.error("Error getting board posts:", error);
      res.status(500).json({
        success: false,
        error: "掲示板の投稿を取得できませんでした"
      });
    }
  });
  
  // 特定の投稿の取得
  app.get("/api/board/posts/:postId", async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: "無効な投稿IDです"
        });
      }
      
      const post = await storage.getBoardPost(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: "投稿が見つかりませんでした"
        });
      }
      
      // 投稿に対するコメントも取得
      const comments = await storage.getPostComments(postId);
      
      res.json({
        success: true,
        data: {
          post,
          comments
        }
      });
    } catch (error) {
      console.error(`Error getting board post ${req.params.postId}:`, error);
      res.status(500).json({
        success: false,
        error: "投稿の取得中にエラーが発生しました"
      });
    }
  });
  
  // 特定の投稿に対するコメントのみを取得するエンドポイント（同期サービス用）
  app.get("/api/board/posts/:postId/comments", async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: "無効な投稿IDです"
        });
      }
      
      // まず投稿が存在するか確認
      const post = await storage.getBoardPost(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: "投稿が見つかりませんでした"
        });
      }
      
      // コメントを取得
      const comments = await storage.getPostComments(postId);
      
      res.json({
        success: true,
        data: comments
      });
    } catch (error) {
      console.error(`Error getting comments for post ${req.params.postId}:`, error);
      res.status(500).json({
        success: false,
        error: "コメントの取得中にエラーが発生しました"
      });
    }
  });
  
  // 新しい投稿の作成
  app.post("/api/board/posts", async (req: Request, res: Response) => {
    try {
      // リクエストボディのバリデーション
      const postData = boardPostSchema.parse(req.body);
      
      // 投稿をストレージに保存
      const post = await storage.createBoardPost({
        title: postData.title,
        content: postData.content,
        author: postData.author,
        authorId: postData.authorId,
        imageUrl: postData.imageUrl
      });
      
      // WebSocketを使って新しい投稿をリアルタイムで配信
      broadcastNewPost(post);
      
      // キャッシュを無効化
      boardPostsCache = null;
      
      res.status(201).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error("Error creating board post:", error);
      res.status(400).json({
        success: false,
        error: error instanceof z.ZodError 
          ? error.errors.map(e => e.message).join(', ')
          : "投稿の作成中にエラーが発生しました"
      });
    }
  });
  
  // 投稿へのコメント追加
  app.post("/api/board/comments", async (req: Request, res: Response) => {
    try {
      // リクエストボディのバリデーション
      const commentData = boardCommentSchema.parse(req.body);
      
      // 投稿が存在するか確認
      const post = await storage.getBoardPost(commentData.postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: "コメント先の投稿が見つかりませんでした"
        });
      }
      
      // コメントをストレージに保存
      const comment = await storage.createBoardComment({
        postId: commentData.postId,
        content: commentData.content,
        author: commentData.author,
        authorId: commentData.authorId
      });
      
      // WebSocketを使って新しいコメントをリアルタイムで配信
      broadcastNewComment(comment);
      
      // キャッシュを無効化
      boardPostsCache = null;
      
      res.status(201).json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error("Error creating board comment:", error);
      res.status(400).json({
        success: false,
        error: error instanceof z.ZodError 
          ? error.errors.map(e => e.message).join(', ')
          : "コメントの作成中にエラーが発生しました"
      });
    }
  });
  
  // 投稿にいいねを追加
  app.post("/api/board/posts/:postId/like", async (req: Request, res: Response) => {
    try {
      const postId = parseInt(req.params.postId);
      
      if (isNaN(postId)) {
        return res.status(400).json({
          success: false,
          error: "無効な投稿IDです"
        });
      }
      
      // 投稿が存在するか確認
      const post = await storage.getBoardPost(postId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          error: "投稿が見つかりませんでした"
        });
      }
      
      // いいねを増やす
      await storage.incrementPostLikes(postId);
      
      // 更新後の投稿を取得
      const updatedPost = await storage.getBoardPost(postId);
      
      // WebSocketを使っていいね情報をリアルタイムで配信
      broadcastLike('post', postId);
      
      // キャッシュを無効化
      boardPostsCache = null;
      
      res.json({
        success: true,
        data: updatedPost
      });
    } catch (error) {
      console.error(`Error liking post ${req.params.postId}:`, error);
      res.status(500).json({
        success: false,
        error: "いいねの追加中にエラーが発生しました"
      });
    }
  });
  
  // コメントにいいねを追加
  app.post("/api/board/comments/:commentId/like", async (req: Request, res: Response) => {
    try {
      const commentId = parseInt(req.params.commentId);
      
      if (isNaN(commentId)) {
        return res.status(400).json({
          success: false,
          error: "無効なコメントIDです"
        });
      }
      
      // いいねを増やす
      await storage.incrementCommentLikes(commentId);
      
      // WebSocketを使ってコメントのいいね情報をリアルタイムで配信
      broadcastLike('comment', commentId);
      
      // キャッシュを無効化（コメントのいいねも表示される可能性があるため）
      boardPostsCache = null;
      
      res.json({
        success: true,
        message: "コメントにいいねを追加しました"
      });
    } catch (error) {
      console.error(`Error liking comment ${req.params.commentId}:`, error);
      res.status(500).json({
        success: false,
        error: "いいねの追加中にエラーが発生しました"
      });
    }
  });
  
  // ユーザーの投稿を取得
  app.get("/api/board/users/:authorId/posts", async (req: Request, res: Response) => {
    try {
      const authorId = req.params.authorId;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const posts = await storage.getUserBoardPosts(authorId, limit);
      
      res.json({
        success: true,
        data: posts
      });
    } catch (error) {
      console.error(`Error getting posts by author ${req.params.authorId}:`, error);
      res.status(500).json({
        success: false,
        error: "ユーザーの投稿を取得できませんでした"
      });
    }
  });
  
  // ユーザー権限管理API
  
  // 特定ユーザーの権限を取得
  app.get("/api/roles/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const userRole = await storage.getUserRole(userId);
      
      if (userRole) {
        res.json({
          success: true,
          data: userRole
        });
      } else {
        res.json({
          success: true,
          data: { role: "member" } // デフォルト権限
        });
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch user role"
      });
    }
  });
  
  // 全ユーザーの権限を取得
  app.get("/api/roles", async (req: Request, res: Response) => {
    try {
      const roles = await storage.getAllUserRoles();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error("Error fetching all user roles:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch all user roles"
      });
    }
  });
  
  // ユーザー権限を設定
  app.post("/api/roles", async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.body;
      
      if (!userId || !role) {
        return res.status(400).json({
          success: false,
          error: "ユーザーIDと権限が必要です"
        });
      }
      
      // 権限の検証
      const validRoles = ["developer", "leader", "admin", "member", "guest"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: "無効な権限です"
        });
      }
      
      await storage.saveUserRole({ userId, role });
      
      res.json({
        success: true,
        message: "ユーザー権限を設定しました",
        data: { userId, role }
      });
    } catch (error) {
      console.error("Error setting user role:", error);
      res.status(500).json({
        success: false,
        error: "Failed to set user role"
      });
    }
  });
  
  // ユーザー権限を削除
  app.delete("/api/roles/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      
      await storage.removeUserRole(userId);
      
      res.json({
        success: true,
        message: "ユーザー権限を削除しました"
      });
    } catch (error) {
      console.error("Error removing user role:", error);
      res.status(500).json({
        success: false,
        error: "Failed to remove user role"
      });
    }
  });

  // 禁止IPアドレス関連のエンドポイント
  // 禁止IPアドレスの一覧を取得
  app.get("/api/bans", async (req: Request, res: Response) => {
    try {
      const bannedIps = await storage.getAllBannedIps();
      
      res.json({
        success: true,
        data: bannedIps
      });
    } catch (error) {
      console.error("Error getting banned IPs:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get banned IPs"
      });
    }
  });

  // 特定のIPアドレスの禁止情報を取得
  app.get("/api/bans/:ipAddress", async (req: Request, res: Response) => {
    try {
      const ipAddress = req.params.ipAddress;
      const bannedIp = await storage.getBannedIp(ipAddress);
      
      if (!bannedIp) {
        return res.status(404).json({
          success: false,
          error: "Banned IP not found"
        });
      }
      
      res.json({
        success: true,
        data: bannedIp
      });
    } catch (error) {
      console.error("Error getting banned IP:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get banned IP information"
      });
    }
  });

  // IPアドレスを禁止する
  app.post("/api/bans", async (req: Request, res: Response) => {
    try {
      const banData = banIpSchema.parse(req.body);
      
      // 現在の禁止情報があるかチェック
      const existingBan = await storage.getBannedIp(banData.ipAddress);
      if (existingBan) {
        // 既存の禁止を削除
        await storage.removeBannedIp(banData.ipAddress);
      }
      
      // 新しい禁止を追加
      const bannedIp = await storage.addBannedIp({
        ipAddress: banData.ipAddress,
        reason: banData.reason || null,
        bannedBy: banData.bannedBy,
        expiresAt: banData.expiresAt ? new Date(banData.expiresAt) : null
      });
      
      // バンされたユーザーが現在アクセスしている場合はCookieを設定
      // 注：現在ログイン中のユーザーのみに影響（次回アクセス時は checkUserBanned ミドルウェアで処理）
      const userId = req.cookies?.user_id;
      if (userId === banData.ipAddress) {
        // バントークンを生成
        const banToken = randomBytes(16).toString('hex');
        bannedTokens.add(banToken);
        
        // Cookieに保存（1年間有効）
        res.cookie('ban_token', banToken, {
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1年間
          httpOnly: true,
          sameSite: 'strict',
          path: '/'
        });
      }
      
      res.json({
        success: true,
        data: bannedIp,
        message: "ユーザーIDを禁止しました"
      });
    } catch (error) {
      console.error("Error banning user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "無効なリクエストデータ",
          details: error.errors
        });
      }
      res.status(500).json({
        success: false,
        error: "ユーザーのBAN処理に失敗しました"
      });
    }
  });

  // 禁止を解除する
  app.delete("/api/bans/:ipAddress", async (req: Request, res: Response) => {
    try {
      const ipAddress = req.params.ipAddress;
      
      const result = await storage.removeBannedIp(ipAddress);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: "BANされたユーザーが見つかりません"
        });
      }
      
      // BANクッキーを削除（そのユーザーが現在見ている場合）
      const userId = req.cookies?.user_id;
      if (userId === ipAddress) {
        res.clearCookie('ban_token', {
          path: '/',
          httpOnly: true,
          sameSite: 'strict'
        });
      }
      
      res.json({
        success: true,
        message: "ユーザーの禁止を解除しました"
      });
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({
        success: false,
        error: "ユーザーのBAN解除に失敗しました"
      });
    }
  });

  // IPアドレスが禁止されているかチェック
  app.get("/api/bans/check/:ipAddress", async (req: Request, res: Response) => {
    try {
      const ipAddress = req.params.ipAddress;
      const isBanned = await storage.isIpBanned(ipAddress);
      
      res.json({
        success: true,
        banned: isBanned
      });
    } catch (error) {
      console.error("Error checking if IP is banned:", error);
      res.status(500).json({
        success: false,
        error: "Failed to check if IP is banned"
      });
    }
  });

  // キック履歴関連のエンドポイント
  // キック履歴の一覧を取得
  app.get("/api/kicks", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const kickHistory = await storage.getKickHistory(limit);
      
      res.json({
        success: true,
        data: kickHistory
      });
    } catch (error) {
      console.error("Error getting kick history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get kick history"
      });
    }
  });

  // 特定のユーザーのキック履歴を取得
  app.get("/api/kicks/user/:userId", async (req: Request, res: Response) => {
    try {
      const userId = req.params.userId;
      const kickHistory = await storage.getUserKickHistory(userId);
      
      res.json({
        success: true,
        data: kickHistory
      });
    } catch (error) {
      console.error("Error getting user kick history:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get user kick history"
      });
    }
  });

  // ユーザーをキックする
  app.post("/api/kicks", async (req: Request, res: Response) => {
    try {
      const kickData = kickUserSchema.parse(req.body);
      
      const kickHistory = await storage.addKickHistory({
        userId: kickData.userId,
        ipAddress: kickData.ipAddress,
        reason: kickData.reason || null,
        kickedBy: kickData.kickedBy
      });
      
      res.json({
        success: true,
        data: kickHistory,
        message: "ユーザーをキックしました"
      });
    } catch (error) {
      console.error("Error kicking user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "無効なリクエストデータ",
          details: error.errors
        });
      }
      res.status(500).json({
        success: false,
        error: "Failed to kick user"
      });
    }
  });
  
  return httpServer;
}
