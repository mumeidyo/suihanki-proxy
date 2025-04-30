import { useState, useEffect, FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Lightbulb, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { showGlobalError } from "@/components/ErrorNotification";
import { useQuery } from "@tanstack/react-query";
import { YoutubeVideo } from "@shared/schema";
import { useLocation } from "wouter";
import { openUrl } from "@/lib/aboutBlank";

export default function DownloaderTab() {
  const [downloadUrl, setDownloadUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [location] = useLocation();

  // Extract videoId from URL parameter if present
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1]);
    const urlVideoId = params.get("videoId");
    if (urlVideoId) {
      setVideoId(urlVideoId);
    }
  }, [location]);

  // Fetch video details if we have a videoId
  const { data: videoInfo, isLoading: isVideoLoading } = useQuery<YoutubeVideo>({
    queryKey: [`/api/youtube/video/${videoId}`],
    enabled: !!videoId
  });

  const clearDownloadUrl = () => {
    setDownloadUrl("");
  };

  const handleDownloadRequest = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!downloadUrl) {
      toast({
        title: "YouTube URLを入力してください",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Extract video ID from URL
      let extractedVideoId = "";
      
      if (downloadUrl.includes("youtu.be/")) {
        extractedVideoId = downloadUrl.split("youtu.be/")[1]?.split(/[?#]/)[0];
      } else if (downloadUrl.includes("youtube.com/watch")) {
        const urlParams = new URLSearchParams(downloadUrl.split("?")[1]);
        extractedVideoId = urlParams.get("v") || "";
      } else if (downloadUrl.includes("youtube.com/embed/")) {
        extractedVideoId = downloadUrl.split("youtube.com/embed/")[1]?.split(/[?#]/)[0];
      } else if (downloadUrl.includes("youtube.com/shorts/")) {
        // YouTube Shorts対応
        extractedVideoId = downloadUrl.split("youtube.com/shorts/")[1]?.split(/[?#]/)[0];
      } else if (/^[a-zA-Z0-9_-]{11}$/.test(downloadUrl)) {
        // If it's just the video ID (11 characters)
        extractedVideoId = downloadUrl;
      }
      
      if (!extractedVideoId) {
        throw new Error("有効なYouTube URLではありません");
      }
      
      // Set the videoId for direct downloading
      setVideoId(extractedVideoId);
      
      // 情報取得を試みるが、失敗しても進める
      try {
        // API経由で情報取得を試みる
        await fetch(`/api/youtube/video/${extractedVideoId}`);
      } catch (apiError) {
        console.error("API error:", apiError);
        // 情報取得に失敗してもダウンロードはできるようにエラーを無視
      }
      
      // ダウンロードオプションを直接表示
      toast({
        title: "URLを認識しました",
        description: "下のボタンからダウンロード形式を選択してください",
      });
      
    } catch (error) {
      showGlobalError(error instanceof Error ? error.message : "ダウンロード情報の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormatDownload = (format: string, quality: string) => {
    if (!videoId) return;
    
    const downloadUrl = `/api/youtube/download?videoId=${videoId}&format=${format}&quality=${quality}`;
    
    // 新しいタブまたはウィンドウでダウンロードURLを開く（about:blankモード対応）
    openUrl(downloadUrl);
    
    toast({
      title: "ダウンロードを開始しました",
      description: format === "mp4" ? "動画をダウンロードしています" : "音声をダウンロードしています",
    });
  };

  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-medium mb-4 text-neutral-800">YouTube ダウンローダー</h2>
      <p className="text-gray-600 mb-4">YouTube動画のURLを入力して、ダウンロードしたい形式を選択してください。</p>
      
      <form onSubmit={handleDownloadRequest} className="mb-6">
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-grow">
            <Input
              type="text"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              placeholder="YouTube URL (例: https://www.youtube.com/watch?v=... または https://www.youtube.com/shorts/...)"
              required
              className="w-full px-4 py-3 pr-10"
            />
            {downloadUrl && (
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={clearDownloadUrl}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button type="submit" className="px-6 py-3 flex items-center justify-center">
            <Search className="h-4 w-4 mr-1" />
            動画を検索
          </Button>
        </div>
      </form>
      
      {/* Download Loader */}
      {(isLoading || isVideoLoading) && (
        <div className="border-t pt-6">
          <div className="flex justify-center items-center p-8">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-700 mb-1">ダウンロード情報を取得中...</p>
              <p className="text-gray-500 text-sm">しばらくお待ちください</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Downloader Result - 動画情報あり */}
      {!isLoading && !isVideoLoading && videoInfo && (
        <div className="border-t pt-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="md:w-64 flex-shrink-0">
              <img
                src={videoInfo.thumbnailUrl || ""}
                alt={videoInfo.title}
                className="w-full rounded-lg shadow-sm"
              />
            </div>
            <div className="flex-grow">
              <h3 className="font-medium text-lg mb-1">{videoInfo.title}</h3>
              <p className="text-gray-600 mb-2">{videoInfo.channelTitle}</p>
              <div className="flex items-center text-sm text-gray-500 mb-4">
                {videoInfo.viewCount && (
                  <>
                    <span>{parseInt(videoInfo.viewCount).toLocaleString()} 回視聴</span>
                    <span className="mx-1">•</span>
                  </>
                )}
                {videoInfo.duration && (
                  <>
                    <span>{videoInfo.duration}</span>
                    <span className="mx-1">•</span>
                  </>
                )}
                {videoInfo.publishedAt && (
                  <span>{new Date(videoInfo.publishedAt).toLocaleDateString("ja-JP")}</span>
                )}
              </div>
              
              <div className="bg-gray-100 rounded-lg p-4">
                <h4 className="font-medium mb-3">ダウンロードオプション</h4>
                
                {/* Video Downloads */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">動画</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp4", "1080p")}
                    >
                      <span className="text-sm">MP4 - 1080p</span>
                      <span className="text-xs text-gray-500">高画質</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp4", "720p")}
                    >
                      <span className="text-sm">MP4 - 720p</span>
                      <span className="text-xs text-gray-500">中画質</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp4", "480p")}
                    >
                      <span className="text-sm">MP4 - 480p</span>
                      <span className="text-xs text-gray-500">低画質</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp4", "360p")}
                    >
                      <span className="text-sm">MP4 - 360p</span>
                      <span className="text-xs text-gray-500">最低画質</span>
                    </Button>
                  </div>
                </div>
                
                {/* Audio Downloads */}
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">音声のみ</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp3", "320")}
                    >
                      <span className="text-sm">MP3 - 高品質</span>
                      <span className="text-xs text-gray-500">320kbps相当</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-between"
                      onClick={() => handleFormatDownload("mp3", "128")}
                    >
                      <span className="text-sm">MP3 - 標準品質</span>
                      <span className="text-xs text-gray-500">128kbps相当</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 動画情報はないが、videoIdがある場合（情報取得に失敗した場合）でもダウンロードボタンを表示 */}
      {!isLoading && !isVideoLoading && !videoInfo && videoId && (
        <div className="border-t pt-6">
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <h4 className="font-medium">ダウンロードオプション</h4>
              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">動画情報取得失敗</span>
            </div>
            
            {/* Video Downloads */}
            <div className="mb-4">
              <h5 className="text-sm font-medium text-gray-700 mb-2">動画</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp4", "1080p")}
                >
                  <span className="text-sm">MP4 - 1080p</span>
                  <span className="text-xs text-gray-500">高画質</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp4", "720p")}
                >
                  <span className="text-sm">MP4 - 720p</span>
                  <span className="text-xs text-gray-500">中画質</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp4", "480p")}
                >
                  <span className="text-sm">MP4 - 480p</span>
                  <span className="text-xs text-gray-500">低画質</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp4", "360p")}
                >
                  <span className="text-sm">MP4 - 360p</span>
                  <span className="text-xs text-gray-500">最低画質</span>
                </Button>
              </div>
            </div>
            
            {/* Audio Downloads */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">音声のみ</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp3", "320")}
                >
                  <span className="text-sm">MP3 - 高品質</span>
                  <span className="text-xs text-gray-500">320kbps相当</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="justify-between"
                  onClick={() => handleFormatDownload("mp3", "128")}
                >
                  <span className="text-sm">MP3 - 標準品質</span>
                  <span className="text-xs text-gray-500">128kbps相当</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Download Tips */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 flex items-center mb-2">
          <Lightbulb className="h-4 w-4 mr-1 text-blue-600" />
          ダウンロードのヒント
        </h3>
        <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>ファイル名に特殊文字が含まれていると保存できない場合があります</li>
          <li>大きなファイルはダウンロードに時間がかかる場合があります</li>
          <li>著作権に注意して、個人的な使用のみに留めてください</li>
          <li>ダウンロードが始まらない場合は、URLを確認して再試行してください</li>
          <li>YouTube Shorts (https://www.youtube.com/shorts/...) のURLも対応しています</li>
        </ul>
      </div>
    </Card>
  );
}
