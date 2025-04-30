import type { Request, Response } from "express";
import { storage } from "./storage";
import { youtubeDownloadSchema } from "@shared/schema";
import ytdl from "ytdl-core";
import youtubeDlExec from "youtube-dl-exec";
import ytDlpExec from "yt-dlp-exec";
import { ChildProcess, spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";
import { exec } from "child_process";

/**
 * YouTube動画をダウンロードするエンドポイントのハンドラー
 * シンプルなytdl-coreを使用したダウンロード方法
 */
// 一時ディレクトリ設定
function ensureTmpDirExists() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

// 起動時にディレクトリを確認
ensureTmpDirExists();

export async function handleYoutubeDownload(req: Request, res: Response) {
  try {
    // リクエストパラメータのバリデーション
    const { videoId, format, quality } = youtubeDownloadSchema.parse({
      videoId: req.query.videoId,
      format: req.query.format || "mp4",
      quality: req.query.quality || "highest"
    });
    
    // Content-Typeヘッダーの設定
    if (format === 'mp3') {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else {
      res.setHeader('Content-Type', 'video/mp4');
    }
    
    try {
      // Try to get video info from database first
      let videoInfo = await storage.getVideo(videoId);
      let videoTitle = videoInfo?.title || `YouTube-${videoId}`;
      
      // ファイル名をサニタイズ（安全な文字のみに）
      const sanitizedTitle = videoTitle
        .replace(/[\\/:*?"<>|]/g, '_')  // 不正な文字を置換
        .replace(/\s+/g, '_')          // スペースをアンダースコアに
        .replace(/[^\x00-\x7F]/g, '') // ASCII文字のみ
        .substring(0, 50);             // 長さ制限
        
      // 拡張子の設定
      const extension = format === 'mp3' ? '.mp3' : '.mp4';
      const filename = `${sanitizedTitle}${extension}`;
      
      // セキュアなContent-Dispositionヘッダーの設定
      // ファイル名にASCII文字以外が含まれる場合の対応も含む
      const encodedFilename = encodeURIComponent(filename);
      res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`);
      
      // If not found in database, fetch from YouTube
      if (!videoInfo) {
        try {
          // Try multiple methods to get video info
          let infoObtained = false;
          
          // Method 1: Try ytdl-core first (fastest but might fail with some videos)
          try {
            console.log(`Fetching video info for ${videoId} using ytdl-core`);
            const ytInfo = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
            
            // Save to database for future use
            videoInfo = await storage.saveVideo({
              videoId: videoId,
              title: ytInfo.videoDetails.title || 'Unknown Title',
              channelTitle: ytInfo.videoDetails.author?.name || 'Unknown Channel',
              description: ytInfo.videoDetails.description || '',
              thumbnailUrl: ytInfo.videoDetails.thumbnails[0]?.url || '',
              publishedAt: ytInfo.videoDetails.publishDate || '',
              duration: ytInfo.videoDetails.lengthSeconds,
              viewCount: ytInfo.videoDetails.viewCount,
            });
            
            videoTitle = ytInfo.videoDetails.title;
            infoObtained = true;
          } catch (ytdlError) {
            console.error("Error fetching video info with ytdl-core:", ytdlError);
          }
          
          // Method 2: Try yt-dlp next (more reliable but slower)
          if (!infoObtained) {
            try {
              console.log(`Fetching video info for ${videoId} using yt-dlp`);
              const result = await ytDlpExec(`https://www.youtube.com/watch?v=${videoId}`, {
                dumpSingleJson: true,
                skipDownload: true,
                noCheckCertificate: true,
                noWarnings: true,
                addHeader: 'referer:youtube.com',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
              });
              
              if (typeof result === 'string') {
                const info = JSON.parse(result);
                
                // Save to database
                videoInfo = await storage.saveVideo({
                  videoId: videoId,
                  title: info.title || 'Unknown Title',
                  channelTitle: info.uploader || info.channel || 'Unknown Channel',
                  description: info.description || '',
                  thumbnailUrl: info.thumbnail || '',
                  publishedAt: info.upload_date ? 
                    `${info.upload_date.slice(0,4)}-${info.upload_date.slice(4,6)}-${info.upload_date.slice(6,8)}` : 
                    new Date().toISOString(),
                  duration: info.duration?.toString() || '0',
                  viewCount: info.view_count?.toString() || '0',
                });
                
                videoTitle = info.title;
                infoObtained = true;
              }
            } catch (ytdlpError) {
              console.error("Error fetching video info with yt-dlp:", ytdlpError);
            }
          }
          
          // Method 3: Try youtube-dl-exec as last resort
          if (!infoObtained) {
            try {
              console.log(`Fetching video info for ${videoId} using youtube-dl-exec`);
              const result = await youtubeDlExec(`https://www.youtube.com/watch?v=${videoId}`, {
                dumpSingleJson: true,
                skipDownload: true,
                noCheckCertificates: true,
                noWarnings: true,
                addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36']
              });
              
              if (typeof result === 'string') {
                const info = JSON.parse(result);
                
                // Save to database
                videoInfo = await storage.saveVideo({
                  videoId: videoId,
                  title: info.title || 'Unknown Title',
                  channelTitle: info.uploader || info.channel || 'Unknown Channel',
                  description: info.description || '',
                  thumbnailUrl: info.thumbnail || '',
                  publishedAt: info.upload_date ? 
                    `${info.upload_date.slice(0,4)}-${info.upload_date.slice(4,6)}-${info.upload_date.slice(6,8)}` : 
                    new Date().toISOString(),
                  duration: info.duration?.toString() || '0',
                  viewCount: info.view_count?.toString() || '0',
                });
                
                videoTitle = info.title;
              }
            } catch (ytdlExecError) {
              console.error("Error fetching video info with youtube-dl-exec:", ytdlExecError);
            }
          }
          
        } catch (error) {
          console.error("All methods failed to fetch video info:", error);
          // Continue even if we can't get complete info
        }
      }
      
      // Content-Disposition と Content-Type は既に上部で設定済み
      // Record download start for tracking

      console.log(`Starting download for video: ${videoId}, format: ${format}, quality: ${quality}`);
      
      // Record download history (async, don't wait for completion)
      storage.incrementDownloadCount(videoId).catch(err => {
        console.error("Failed to increment download count:", err);
      });
      
      storage.addDownloadHistory({
        videoId,
        format,
        quality,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || '',
      }).catch(err => {
        console.error("Failed to add download history:", err);
      });
      
      // Try multiple download methods with fallbacks
      // Method 1: yt-dlp (most reliable with newest YouTube changes)
      const downloadWithYtDlp = async (): Promise<void> => {
        console.log(`Trying yt-dlp for ${format} download of ${videoId} with quality ${quality}`);
        
        let ytdlpProcess: ChildProcess;
        
        // フォーマットに応じた処理
        if (format === 'mp3') {
          // MP3のダウンロード
          const audioQualityValue = quality === '320' ? 0 : 5; // 320kbpsか128kbps
          
          // パフォーマンス最適化
          const options: any = {
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: audioQualityValue,
            output: '-', // 標準出力に送信
            noCheckCertificate: true,
            noWarnings: true,
            retries: 3,
            embedMetadata: true
          };
          
          ytdlpProcess = ytDlpExec(`https://www.youtube.com/watch?v=${videoId}`, options) as unknown as ChildProcess;
        } else {
          // Video format with quality selection - シンプル化して信頼性を向上
          let formatOption;
          
          if (quality === 'highest' || quality === '1080p') {
            formatOption = 'best[height<=1080]';
          } else if (quality === 'medium' || quality === '720p') {
            formatOption = 'best[height<=720]';
          } else if (quality === '480p') {
            formatOption = 'best[height<=480]';
          } else if (quality === 'lowest' || quality === '360p') {
            formatOption = 'best[height<=360]';
          } else {
            formatOption = 'best'; // デフォルトは最高品質
          }
          
          // パフォーマンス最適化と信頼性向上
          const options: any = {
            format: formatOption,
            output: '-', // 標準出力に送信
            mergeOutputFormat: 'mp4',
            noCheckCertificate: true,
            noWarnings: true,
            retries: 3,
            embedMetadata: true,
            addHeader: ['referer:youtube.com', 'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36']
          };
          
          ytdlpProcess = ytDlpExec(`https://www.youtube.com/watch?v=${videoId}`, options) as unknown as ChildProcess;
        }
        
        return new Promise<void>((resolve, reject) => {
          // プロセスの標準出力をレスポンスにパイプ
          if (ytdlpProcess.stdout) {
            ytdlpProcess.stdout.pipe(res);
          } else {
            reject(new Error("Failed to get stdout from yt-dlp process"));
            return;
          }
          
          // エラーハンドリング
          if (ytdlpProcess.stderr) {
            ytdlpProcess.stderr.on('data', (data: any) => {
              console.error(`yt-dlp stderr: ${data}`);
            });
          }
          
          // プロセスエラーのハンドリング
          ytdlpProcess.on('error', (err: any) => {
            console.error('yt-dlp download error:', err);
            reject(err);
          });
          
          // プロセス終了時の処理
          ytdlpProcess.on('close', (code: any) => {
            console.log(`yt-dlp process exited with code ${code}`);
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`yt-dlp process exited with code ${code}`));
            }
          });
        });
      };
      
      // Method 2: youtube-dl-exec (second best option)
      const downloadWithYoutubeDlExec = async (): Promise<void> => {
        console.log(`Trying youtube-dl-exec for ${format} download of ${videoId} with quality ${quality}`);
        
        let ytdlProcess: ChildProcess;
        
        // パフォーマンス最適化版オプション
        const commonOptions = {
          noCheckCertificates: true,
          noWarnings: true,
          preferFreeFormats: true
        };
        
        // フォーマットに応じた処理
        if (format === 'mp3') {
          // MP3のダウンロード
          const audioQualityValue = quality === '320' ? 0 : 5; // 320kbpsか128kbps
          
          // youtubeDlExecの戻り値をChildProcessにキャスト
          ytdlProcess = youtubeDlExec(`https://www.youtube.com/watch?v=${videoId}`, {
            ...commonOptions,
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: audioQualityValue,
            output: '-' // 標準出力に送信
          }) as unknown as ChildProcess;
        } else {
          // 動画フォーマットの場合、シンプル化したフォーマットを使用
          let formatOption;
          
          if (quality === 'highest' || quality === '1080p') {
            formatOption = 'best[height<=1080]';
          } else if (quality === 'medium' || quality === '720p') {
            formatOption = 'best[height<=720]';
          } else if (quality === '480p') {
            formatOption = 'best[height<=480]';
          } else if (quality === 'lowest' || quality === '360p') {
            formatOption = 'best[height<=360]';
          } else {
            formatOption = 'best'; // デフォルトは最高品質
          }
          
          // youtubeDlExecの戻り値をChildProcessにキャスト 
          ytdlProcess = youtubeDlExec(`https://www.youtube.com/watch?v=${videoId}`, {
            ...commonOptions,
            format: formatOption,
            output: '-', // 標準出力に送信
            mergeOutputFormat: 'mp4'
          }) as unknown as ChildProcess;
        }
        
        return new Promise<void>((resolve, reject) => {
          // プロセスの標準出力をレスポンスにパイプ
          if (ytdlProcess.stdout) {
            ytdlProcess.stdout.pipe(res);
          } else {
            reject(new Error("Failed to get stdout from youtube-dl process"));
            return;
          }
          
          // エラーハンドリング
          if (ytdlProcess.stderr) {
            ytdlProcess.stderr.on('data', (data: any) => {
              console.error(`youtube-dl stderr: ${data}`);
            });
          }
          
          // プロセスエラーのハンドリング
          ytdlProcess.on('error', (err: any) => {
            console.error('youtube-dl-exec download error:', err);
            reject(err);
          });
          
          // プロセス終了時の処理
          ytdlProcess.on('close', (code: any) => {
            console.log(`youtube-dl-exec process exited with code ${code}`);
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`youtube-dl-exec process exited with code ${code}`));
            }
          });
        });
      };
      
      // Method 3: ytdl-core (least reliable with recent YouTube changes, but fastest)
      const downloadWithYtdlCore = async (): Promise<void> => {
        console.log(`Trying ytdl-core for ${format} download of ${videoId} with quality ${quality}`);
        
        if (format === 'mp3') {
          // For MP3 format - FFmpeg経由でMP3に変換
          const ffmpegPath = process.env.FFMPEG_PATH || '/nix/store/3zc5jbvqzrn8zmva4fx5p0nh4yy03wk4-ffmpeg-6.1.1-bin/bin/ffmpeg';
          const audioStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
            quality: 'highestaudio',
            filter: 'audioonly'
          });
          
          return new Promise<void>((resolve, reject) => {
            try {
              console.log('Using FFmpeg to convert audio to MP3 format');
              
              // FFmpegを使ってMP3に変換
              const ffmpeg = spawn(ffmpegPath, [
                '-i', 'pipe:0',          // 標準入力から読み込み
                '-codec:a', 'libmp3lame', // MP3エンコーダ使用
                '-q:a', quality === '320' ? '0' : '5', // 音質設定
                '-f', 'mp3',             // MP3フォーマット指定
                'pipe:1'                 // 標準出力に書き込み
              ]);
              
              // エラーハンドリング
              ffmpeg.stderr.on('data', (data) => {
                console.log(`FFmpeg (stderr): ${data}`);
              });
              
              // ストリームの接続
              audioStream.pipe(ffmpeg.stdin);
              ffmpeg.stdout.pipe(res);
              
              // エラーハンドリング
              audioStream.on('error', (err) => {
                console.error('ytdl-core audio stream error:', err);
                reject(err);
              });
              
              ffmpeg.on('error', (err) => {
                console.error('FFmpeg process error:', err);
                reject(err);
              });
              
              ffmpeg.on('close', (code) => {
                if (code === 0) {
                  console.log('ytdl-core audio conversion completed successfully');
                  resolve();
                } else {
                  console.error(`FFmpeg process exited with code ${code}`);
                  reject(new Error(`FFmpeg process exited with code ${code}`));
                }
              });
            } catch (err) {
              console.error('Failed to start FFmpeg process:', err);
              reject(err);
            }
          });
        } else {
          // For video formats (MP4) - シンプル化し、安定性向上
          let ytdlOptions: any = { 
            quality: 'highestvideo',
            requestOptions: {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/'
              }
            }
          };
          
          if (quality === 'highest' || quality === '1080p') {
            ytdlOptions.quality = 'highestvideo';
          } else if (quality === 'medium' || quality === '720p') {
            ytdlOptions = { 
              ...ytdlOptions,
              filter: (format: any) => format.height && format.height <= 720 
            };
          } else if (quality === '480p') {
            ytdlOptions = { 
              ...ytdlOptions,
              filter: (format: any) => format.height && format.height <= 480 
            };
          } else if (quality === 'lowest' || quality === '360p') {
            ytdlOptions = { 
              ...ytdlOptions, 
              quality: 'lowestvideo' 
            };
          }
          
          const videoStream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, ytdlOptions);
          
          return new Promise<void>((resolve, reject) => {
            videoStream.pipe(res);
            
            videoStream.on('error', (err) => {
              console.error('ytdl-core video stream error:', err);
              reject(err);
            });
            
            videoStream.on('end', () => {
              console.log('ytdl-core video download completed');
              resolve();
            });
          });
        }
      };
      
      // Method 4: Direct system yt-dlp (most reliable, uses the latest installed version)
      const downloadWithSystemYtDlp = async (): Promise<void> => {
        console.log(`Trying system yt-dlp command for ${format} download of ${videoId} with quality ${quality}`);
        
        // 環境変数からyt-dlpとffmpegのパスを取得または適切なデフォルト値を使用
        const ytdlpPath = process.env.YT_DLP_PATH || '/home/runner/workspace/.pythonlibs/bin/yt-dlp';
        const ffmpegPath = process.env.FFMPEG_PATH || '/nix/store/3zc5jbvqzrn8zmva4fx5p0nh4yy03wk4-ffmpeg-6.1.1-bin/bin/ffmpeg';
        let args: string[] = [];
        
        if (format === 'mp3') {
          // MP3形式を使用（オーディオ）
          // パフォーマンス最適化版オプション
          args = [
            `https://www.youtube.com/watch?v=${videoId}`,
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', quality === '320' ? '0' : '5',
            '--ffmpeg-location', ffmpegPath,
            '--no-check-certificate',
            '--no-warnings',
            '--retries', '3',
            '-o', '-'  // 標準出力へ
          ];
        } else {
          // MP4の場合 - シンプル化して信頼性を向上
          let formatOption;
          
          if (quality === 'highest' || quality === '1080p') {
            formatOption = 'best[height<=1080]';
          } else if (quality === 'medium' || quality === '720p') {
            formatOption = 'best[height<=720]';
          } else if (quality === '480p') {
            formatOption = 'best[height<=480]';
          } else if (quality === 'lowest' || quality === '360p') {
            formatOption = 'best[height<=360]';
          } else {
            formatOption = 'best'; // デフォルトは最高品質
          }
          
          // パフォーマンス最適化版オプション
          args = [
            `https://www.youtube.com/watch?v=${videoId}`,
            '--format', formatOption,
            '--merge-output-format', 'mp4',
            '--ffmpeg-location', ffmpegPath,
            '--no-check-certificate',
            '--no-warnings',
            '--retries', '3',
            '-o', '-'  // 標準出力へ
          ];
        }
        
        return new Promise<void>((resolve, reject) => {
          try {
            console.log(`Executing system yt-dlp with args: ${args.join(' ')}`);
            const process = spawn(ytdlpPath, args);
            
            process.stdout.pipe(res);
            
            process.stderr.on('data', (data) => {
              console.error(`System yt-dlp stderr: ${data}`);
            });
            
            process.on('error', (err) => {
              console.error('System yt-dlp error:', err);
              reject(err);
            });
            
            process.on('close', (code) => {
              console.log(`System yt-dlp process exited with code ${code}`);
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`System yt-dlp process exited with code ${code}`));
              }
            });
          } catch (err) {
            console.error('Failed to spawn yt-dlp process:', err);
            reject(err);
          }
        });
      };
      
      // Try all download methods in sequence
      try {
        // First try system yt-dlp (most reliable)
        await downloadWithSystemYtDlp();
      } catch (systemYtdlpError) {
        console.error(`System yt-dlp download failed, trying yt-dlp-exec: ${systemYtdlpError}`);
        
        try {
          // Next try yt-dlp-exec
          await downloadWithYtDlp();
        } catch (ytdlpError) {
          console.error(`yt-dlp-exec download failed, trying youtube-dl-exec: ${ytdlpError}`);
          
          try {
            // Next try youtube-dl-exec
            await downloadWithYoutubeDlExec();
          } catch (ytdlExecError) {
            console.error(`youtube-dl-exec download failed, trying ytdl-core: ${ytdlExecError}`);
            
            try {
              // Finally try ytdl-core as last resort
              await downloadWithYtdlCore();
            } catch (ytdlCoreError) {
              console.error(`All download methods failed for ${videoId}: ${ytdlCoreError}`);
              if (!res.headersSent) {
                res.status(500).json({ 
                  message: "ダウンロード中にエラーが発生しました。しばらくしてから再試行してください。",
                  error: "All download methods failed"
                });
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error("Download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: "ダウンロード中にエラーが発生しました。しばらくしてから再試行してください。",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  } catch (validateError) {
    console.error("Validation error:", validateError);
    res.status(400).json({ message: "無効なリクエストパラメータです。" });
  }
}