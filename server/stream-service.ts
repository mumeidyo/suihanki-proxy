import { Request, Response } from 'express';
import ytdl from 'ytdl-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { storage } from './storage';
import { getVideoFormatsWithFallback, selectOptimalFormat } from './fast-video-service';

/**
 * Stream video using fast-video-service as a fallback when ytdl-core fails
 * This provides more robust streaming capabilities without depending on yt-dlp
 */
async function streamWithFallback(videoId: string, isAudioOnly: boolean, res: Response): Promise<void> {
  return new Promise<void>(async (resolve, reject) => {
    try {
      console.log(`Using fast-video-service fallback for video ${videoId}`);
      
      // Set content type
      res.setHeader('Content-Type', isAudioOnly ? 'audio/mp4' : 'video/mp4');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Get formats from our fast video service
      const formatData = await getVideoFormatsWithFallback(videoId);
      
      if (!formatData.formats || formatData.formats.length === 0) {
        throw new Error('No formats available');
      }
      
      // Select optimal format based on request type
      const optimalFormat = selectOptimalFormat(
        formatData.formats, 
        false // preferMobile
      );
      
      if (!optimalFormat || !optimalFormat.url) {
        throw new Error('No suitable format found for streaming');
      }
      
      console.log(`Selected format for ${videoId}: ${optimalFormat.qualityLabel}`);
      
      // Handle redirect to the source URL
      // Note: This doesn't actually stream the content through our server,
      // but redirects the client directly to the source URL
      res.redirect(optimalFormat.url);
      resolve();
      
    } catch (error) {
      console.error(`Error in fallback streaming for ${videoId}:`, error);
      
      // If headers haven't been sent, return error response
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to stream video',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      reject(error);
    }
  });
}

// Make sure the tmp directory exists
function ensureTmpDirExists() {
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

/**
 * Direct streaming service for YouTube videos
 * This replaces the proxy functionality with a direct streaming approach
 */
export async function streamVideo(req: Request, res: Response): Promise<void> {
  const videoId = req.params.videoId;
  if (!videoId) {
    res.status(400).json({ error: 'Video ID is required' });
    return;
  }

  try {
    // Try to get video info from database first
    let videoInfo = await storage.getVideo(videoId);
    let info;
    
    // If not found in database, fetch from YouTube
    if (!videoInfo) {
      try {
        // Try with ytdl-core first with more options
        info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
          requestOptions: {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
              'Cache-Control': 'max-age=0'
            }
          }
        });
        
        // Save to database for future use
        videoInfo = await storage.saveVideo({
          videoId: videoId,
          title: info.videoDetails.title || 'Unknown Title',
          channelTitle: info.videoDetails.author?.name || 'Unknown Channel',
          description: info.videoDetails.description || '',
          thumbnailUrl: info.videoDetails.thumbnails[0]?.url || '',
          publishedAt: info.videoDetails.publishDate || '',
          duration: info.videoDetails.lengthSeconds,
          viewCount: info.videoDetails.viewCount,
        });
      } catch (ytdlError) {
        console.error('ytdl-core info fetch failed, trying with fast-video-service:', ytdlError);
        
        // Try with fast-video-service as fallback for metadata
        try {
          // Get video formats using our enhanced service
          const formatData = await getVideoFormatsWithFallback(videoId);
          
          if (!formatData || !formatData.videoDetails) {
            throw new Error('Failed to get format data');
          }
          
          // Save to database with fallback data
          videoInfo = await storage.saveVideo({
            videoId: videoId,
            title: formatData.videoDetails.title || 'Unknown Title',
            channelTitle: 'YouTube Channel', // Simplified fallback
            description: formatData.videoDetails.description || '',
            thumbnailUrl: formatData.videoDetails.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            publishedAt: new Date().toISOString(), // Fallback to current date
            duration: formatData.videoDetails.lengthSeconds || '0',
            viewCount: '0', // No view count in fallback
          });
          
          // Create compatible info structure for later use
          info = {
            formats: formatData.formats.map((f: any) => ({
              itag: 'custom',
              url: f.url,
              mimeType: f.mimeType || 'video/mp4',
              hasAudio: f.hasAudio,
              hasVideo: f.hasVideo,
              qualityLabel: f.qualityLabel || 'default',
              bitrate: f.bitrate || 0,
              container: f.container || 'mp4'
            })),
            videoDetails: {
              title: formatData.videoDetails.title,
              author: { name: 'YouTube Creator' },
              description: formatData.videoDetails.description || '',
              lengthSeconds: formatData.videoDetails.lengthSeconds,
              thumbnails: [{ url: formatData.videoDetails.thumbnailUrl }],
              viewCount: '0'
            }
          };
        } catch (fallbackError) {
          console.error('All methods failed to get video info:', fallbackError);
          throw new Error('Failed to get video information with multiple methods');
        }
      }
    } else {
      // If we have video info in database but still need format info
      try {
        info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      } catch (ytdlInfoError) {
        console.warn('Using ytdl-core failed, trying fast-video-service for formats:', ytdlInfoError);
        
        // Try with our fast-video-service as fallback
        try {
          const formatData = await getVideoFormatsWithFallback(videoId);
          
          if (!formatData || !formatData.videoDetails) {
            throw new Error('Failed to get video details');
          }
          
          // Construct compatible info object
          info = {
            videoDetails: {
              title: formatData.videoDetails.title,
              author: { name: 'YouTube Creator' },
              description: formatData.videoDetails.description || '',
              lengthSeconds: formatData.videoDetails.lengthSeconds,
              thumbnails: [{ url: formatData.videoDetails.thumbnailUrl }],
              viewCount: '0'
            },
            formats: formatData.formats
          };
        } catch (fallbackError) {
          // Creating minimal info structure for extreme fallback
          console.warn('Fast-video-service also failed, using minimal info:', fallbackError);
          info = {
            formats: [{ itag: 'best', hasAudio: true, hasVideo: true }],
            videoDetails: {
              title: videoInfo.title,
              author: { name: videoInfo.channelTitle },
              description: videoInfo.description,
              lengthSeconds: videoInfo.duration,
              thumbnails: [{ url: videoInfo.thumbnailUrl }],
              viewCount: videoInfo.viewCount
            }
          };
        }
      }
    }
    
    // First check if this is likely a pure audio request (e.g. from MusicPlayer)
    const isAudioRequest = req.headers['accept']?.includes('audio/') || 
                         req.query.audio === 'true' ||
                         req.path.includes('stream-audio');
    
    let format;
    if (isAudioRequest) {
      // For music player, prefer audio-only formats for better performance
      try {
        format = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly'
        });
        console.log('Selected audio-only format for music streaming:', format.itag);
      } catch (audioFormatError) {
        console.warn('Could not find audio-only format, falling back to combined format:', audioFormatError);
        // If audio-only fails, try audioandvideo as fallback
        format = ytdl.chooseFormat(info.formats, { 
          quality: 'highest',
          filter: 'audioandvideo'
        });
      }
    } else {
      // For video player, use combined audio+video format
      try {
        format = ytdl.chooseFormat(info.formats, { 
          quality: 'highest',
          filter: 'audioandvideo'
        });
      } catch (videoFormatError) {
        console.warn('Could not find audioandvideo format, trying audio-only as fallback:', videoFormatError);
        format = ytdl.chooseFormat(info.formats, { 
          quality: 'highestaudio',
          filter: 'audioonly'
        });
      }
    }
    
    if (format) {
      // Stream directly to client
      const contentType = isAudioRequest ? 'audio/mp4' : (format.mimeType || 'video/mp4');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Add CORS headers for better compatibility
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
      
      // Log streaming attempt
      console.log(`Streaming ${isAudioRequest ? 'audio' : 'video'} for ID: ${videoId}, format: ${format.itag}`);
            
      // Try direct streaming with ytdl-core first
      try {
        const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
          format: format,
          quality: isAudioRequest ? 'highestaudio' : 'highest'
        });
        
        // Handle stream errors
        let hadStreamError = false;
        stream.on('error', (err) => {
          hadStreamError = true;
          console.error('Stream error with ytdl-core:', err);
          
          // Only fall back if headers haven't been sent yet
          if (!res.headersSent) {
            console.log('Falling back to fast-video-service for streaming...');
            streamWithFallback(videoId, isAudioRequest, res).catch(fallbackErr => {
              console.error('Both streaming methods failed:', fallbackErr);
              if (!res.headersSent) {
                res.status(500).json({ 
                  error: 'All streaming methods failed',
                  message: fallbackErr instanceof Error ? fallbackErr.message : 'Unknown error'
                });
              }
            });
          }
        });
        
        // Add a short timeout to detect immediate errors
        const timeoutId = setTimeout(() => {
          if (hadStreamError) return; // Already handled by error event
          stream.pipe(res);
        }, 1000);
        
        // If we receive data, pipe to response
        stream.once('data', () => {
          clearTimeout(timeoutId);
          if (!hadStreamError) stream.pipe(res);
        });
      } catch (streamError) {
        // If ytdl-core throws immediately, try fallback
        console.error('ytdl-core streaming failed immediately:', streamError);
        await streamWithFallback(videoId, isAudioRequest, res);
      }
      
      // Record streaming in history
      await storage.addDownloadHistory({
        videoId,
        format: format.container || 'mp4',
        quality: 'highest',
        timestamp: new Date().toISOString(),
        ipAddress: req.ip || '',
      });
      
    } else {
      res.status(500).json({ error: 'No suitable format found for streaming' });
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ 
      error: 'Failed to stream video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get direct video URLs for embedding in player
 */
export async function getDirectVideoUrls(req: Request, res: Response): Promise<void> {
  const videoId = req.params.videoId;
  if (!videoId) {
    res.status(400).json({ error: 'Video ID is required' });
    return;
  }

  try {
    // Start timing for performance logging
    const startTime = Date.now();
    console.log(`Fetching direct URL for ${videoId}`);

    // Try getting info with ytdl-core first with advanced options
    try {
      const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        }
      });
      
      // Extract useful formats (audio and video)
      const formats = info.formats
        .filter(format => 
          (format.hasAudio && format.hasVideo) || // Combined formats
          (format.hasVideo && format.qualityLabel) || // Video-only formats
          (format.hasAudio && !format.hasVideo) // Audio-only formats
        )
        .map(format => ({
          url: format.url,
          mimeType: format.mimeType,
          qualityLabel: format.qualityLabel,
          hasAudio: format.hasAudio,
          hasVideo: format.hasVideo,
          container: format.container,
          contentLength: format.contentLength,
          bitrate: format.bitrate
        }));
        
      // Get video details
      const videoDetails = {
        title: info.videoDetails.title,
        description: info.videoDetails.description,
        lengthSeconds: info.videoDetails.lengthSeconds,
        thumbnailUrl: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
      };
      
      // Store video in database if not already present
      try {
        await storage.saveVideo({
          videoId: videoId,
          title: info.videoDetails.title || 'Unknown Title',
          channelTitle: info.videoDetails.author?.name || 'Unknown Channel',
          description: info.videoDetails.description || '',
          thumbnailUrl: videoDetails.thumbnailUrl || '',
          publishedAt: info.videoDetails.publishDate || '',
          duration: info.videoDetails.lengthSeconds,
          viewCount: info.videoDetails.viewCount,
        });
      } catch (dbError) {
        console.error('Error saving video to database:', dbError);
        // Continue even if database storage fails
      }
      
      // Log the timing information
      const elapsedTime = Date.now() - startTime;
      console.log(`Direct URL fetch completed in ${elapsedTime}ms`);

      // Return the formats and video details
      res.json({
        formats,
        videoDetails
      });
      return;
    } catch (ytdlError) {
      console.error('ytdl-core failed to get formats, trying fast-video-service:', ytdlError);
      
      // Fallback to our fast-video-service
      try {
        // Get video formats using enhanced service
        const formatData = await getVideoFormatsWithFallback(videoId);
        
        if (!formatData || !formatData.formats) {
          throw new Error('Failed to get format data');
        }
        
        // Convert formats to match expected structure
        const formats = formatData.formats.map((format: any) => ({
          url: format.url,
          mimeType: format.mimeType || 'video/mp4',
          qualityLabel: format.qualityLabel || 'default',
          hasAudio: format.hasAudio || false,
          hasVideo: format.hasVideo || false,
          container: format.container || 'mp4',
          contentLength: format.contentLength,
          bitrate: format.bitrate || 0
        }));
        
        // Get video details
        const videoDetails = {
          title: formatData.videoDetails?.title || `YouTube Video (${videoId})`,
          description: formatData.videoDetails?.description || '',
          lengthSeconds: formatData.videoDetails?.lengthSeconds || '0',
          thumbnailUrl: formatData.videoDetails?.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
        };
        
        // Store in database if we have details
        await storage.saveVideo({
          videoId: videoId,
          title: videoDetails.title,
          channelTitle: 'YouTube Channel', // Fallback value
          description: videoDetails.description || '',
          thumbnailUrl: videoDetails.thumbnailUrl,
          publishedAt: new Date().toISOString(),
          duration: videoDetails.lengthSeconds,
          viewCount: '0',
        });
        
        // Log the timing information
        const elapsedTime = Date.now() - startTime;
        console.log(`Fast-video-service direct URL fetch completed in ${elapsedTime}ms`);
        
        // Return the formats and video details
        res.json({
          formats,
          videoDetails
        });
        return;
      } catch (fallbackError) {
        console.error('Both methods failed to get video formats:', fallbackError);
        throw new Error('Failed to get video formats with multiple methods');
      }
    }
  } catch (error) {
    console.error(`Error getting direct URLs for ${videoId}:`, error);
    res.status(500).json({ 
      error: '動画のストリーミングに失敗しました',
      message: error instanceof Error ? error.message : 'Unknown error',
      fallbackUrl: `/api/youtube/download?videoId=${videoId}&format=mp4&quality=highest`
    });
  }
}

/**
 * Generate an enhanced player page for educational use
 */
export async function getEnhancedPlayerPage(req: Request, res: Response): Promise<void> {
  const videoId = req.params.videoId;
  if (!videoId) {
    res.status(400).json({ error: 'Video ID is required' });
    return;
  }

  try {
    let info;
    let videoData;
    
    try {
      // Try with ytdl-core first
      info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
      
      // Store video in database if not already present
      try {
        videoData = await storage.saveVideo({
          videoId: videoId,
          title: info.videoDetails.title || 'Unknown Title',
          channelTitle: info.videoDetails.author?.name || 'Unknown Channel',
          description: info.videoDetails.description || '',
          thumbnailUrl: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1]?.url || '',
          publishedAt: info.videoDetails.publishDate || '',
          duration: info.videoDetails.lengthSeconds,
          viewCount: info.videoDetails.viewCount,
        });
      } catch (dbError) {
        console.error('Error saving video to database:', dbError);
        // Continue even if database storage fails
      }
    } catch (ytdlError) {
      console.error('ytdl-core info fetch failed, trying with fast-video-service:', ytdlError);
      
      // Try with our fast-video-service as fallback
      try {
        const formatData = await getVideoFormatsWithFallback(videoId);
        
        if (!formatData || !formatData.videoDetails) {
          throw new Error('Failed to get video details');
        }
        
        // Construct compatible info object
        info = {
          videoDetails: {
            title: formatData.videoDetails.title,
            author: { name: 'YouTube Creator' },
            description: formatData.videoDetails.description || '',
            lengthSeconds: formatData.videoDetails.lengthSeconds,
            thumbnails: [{ url: formatData.videoDetails.thumbnailUrl }],
            viewCount: '0'
          },
          formats: formatData.formats
        };
        
        // Save to database
        videoData = await storage.saveVideo({
          videoId: videoId,
          title: formatData.videoDetails.title || 'Unknown Title',
          channelTitle: 'YouTube Channel', // Fallback
          description: formatData.videoDetails.description || '',
          thumbnailUrl: formatData.videoDetails.thumbnailUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          publishedAt: new Date().toISOString(),
          duration: formatData.videoDetails.lengthSeconds || '0',
          viewCount: '0'
        });
      } catch (fallbackError) {
        console.error('All methods failed to get video info:', fallbackError);
        throw new Error('Failed to get video information with multiple methods');
      }
    }
    
    // Generate HTML for enhanced player
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${info.videoDetails.title} - Video Player</title>
        <style>
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            font-family: Arial, sans-serif;
            background-color: #0f0f0f;
            color: #fff;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
          }
          .player-container {
            width: 100%;
            aspect-ratio: 16/9;
            background-color: #000;
            position: relative;
          }
          video {
            width: 100%;
            height: 100%;
            background-color: #000;
          }
          .video-info {
            margin-top: 20px;
          }
          h1 {
            font-size: 1.5rem;
            margin: 0 0 10px 0;
          }
          .channel {
            color: #aaa;
            margin-bottom: 15px;
          }
          .description {
            margin-top: 15px;
            white-space: pre-wrap;
            color: #ccc;
            line-height: 1.4;
          }
          .controls {
            margin-top: 15px;
            display: flex;
            gap: 10px;
          }
          .controls button {
            background-color: #3ea6ff;
            border: none;
            color: #000;
            padding: 8px 15px;
            cursor: pointer;
            border-radius: 3px;
            font-weight: bold;
          }
          .controls button:hover {
            background-color: #2196f3;
          }
          .controls button.download {
            background-color: #4caf50;
          }
          .controls button.download:hover {
            background-color: #388e3c;
          }
          .controls select {
            padding: 8px;
            border-radius: 3px;
            background-color: #272727;
            color: #fff;
            border: 1px solid #444;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="player-container">
            <video id="video-player" controls autoplay></video>
          </div>
          
          <div class="video-info">
            <h1>${info.videoDetails.title}</h1>
            <div class="channel">${info.videoDetails.author.name}</div>
            
            <div class="controls">
              <select id="quality-selector">
                <option value="">選択してください</option>
                <!-- Options will be populated by JavaScript -->
              </select>
              <button id="play-btn">再生</button>
              <button id="download-btn" class="download">ダウンロード</button>
            </div>
            
            <div class="description">${info.videoDetails.description}</div>
          </div>
        </div>
        
        <script>
          document.addEventListener('DOMContentLoaded', async () => {
            const videoId = '${videoId}';
            const videoPlayer = document.getElementById('video-player');
            const qualitySelector = document.getElementById('quality-selector');
            const playBtn = document.getElementById('play-btn');
            const downloadBtn = document.getElementById('download-btn');
            
            // Fetch available formats
            try {
              const response = await fetch(\`/api/youtube/get-direct-urls/\${videoId}\`);
              const data = await response.json();
              
              if (data.formats && data.formats.length > 0) {
                // Populate quality selector with available formats
                const combinedFormats = data.formats.filter(f => f.hasAudio && f.hasVideo);
                
                // Sort by quality (highest first)
                combinedFormats.sort((a, b) => {
                  if (!a.bitrate || !b.bitrate) return 0;
                  return b.bitrate - a.bitrate;
                });
                
                // Add options to selector
                combinedFormats.forEach((format, index) => {
                  const option = document.createElement('option');
                  option.value = index;
                  option.textContent = \`\${format.qualityLabel || 'Standard'} (\${format.container})\`;
                  qualitySelector.appendChild(option);
                });
                
                // Set default video source (highest quality)
                if (combinedFormats.length > 0) {
                  videoPlayer.src = combinedFormats[0].url;
                }
                
                // Handle quality selection
                playBtn.addEventListener('click', () => {
                  const selectedIndex = qualitySelector.value;
                  if (selectedIndex !== '') {
                    const selectedFormat = combinedFormats[selectedIndex];
                    videoPlayer.src = selectedFormat.url;
                    videoPlayer.play();
                  }
                });
                
                // Handle download button
                downloadBtn.addEventListener('click', () => {
                  window.location.href = \`/api/youtube/download?videoId=\${videoId}&format=mp4&quality=highest\`;
                });
              }
            } catch (error) {
              console.error('Error fetching video formats:', error);
              // Fallback to direct stream
              videoPlayer.src = \`/api/youtube/stream-video/\${videoId}\`;
            }
          });
        </script>
      </body>
      </html>
    `;
    
    // Record access in history
    await storage.addProxyHistory({
      videoId,
      title: info.videoDetails.title || 'Unknown',
      timestamp: new Date().toISOString(),
      ipAddress: req.ip || '',
      userAgent: req.headers['user-agent'] || '',
      success: true
    });
    
    // Send the HTML response
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error generating enhanced player page:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Error Loading Video</h1>
          <p>Failed to load video: ${error instanceof Error ? error.message : 'Unknown error'}</p>
          <a href="/">Return to Home</a>
        </body>
      </html>
    `);
  }
}