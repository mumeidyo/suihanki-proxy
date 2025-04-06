import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import VideoPlayer from "@/components/VideoPlayer";
import { YoutubeSearchResponse, YoutubeVideoItem } from "@/types/youtube";
import { Loader, Search, TrendingUp, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { YoutubeVideo } from "@shared/schema";

export default function ViewerTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [searchType, setSearchType] = useState("video");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ユーザー識別子を取得する関数
  const getUserIdentifier = useCallback(() => {
    try {
      // デバイスIDの取得（UserSetupで保存されたもの）
      const cookies = document.cookie.split(';').map(cookie => cookie.trim());
      const encodedDeviceIdKey = btoa('device_id').substring(0, 8);
      
      for (const cookie of cookies) {
        if (cookie.startsWith(`${encodedDeviceIdKey}=`)) {
          const encodedValue = cookie.substring(encodedDeviceIdKey.length + 1);
          try {
            return atob(encodedValue);
          } catch (e) {
            console.warn('不正なエンコードデータです。');
          }
        }
      }
      
      // フォールバック: 一時的な識別子を生成
      const tempId = btoa(navigator.userAgent + navigator.language + window.screen.width).substring(0, 16);
      return tempId;
    } catch (e) {
      // エラーが発生した場合はランダムな文字列を返す
      return Math.random().toString(36).substring(2, 15);
    }
  }, []);

  // ユーザー識別子
  const userIdentifier = getUserIdentifier();
  
  // 人気の動画を取得 - ユーザー識別子を含める
  const { data: popularVideos, isLoading: popularLoading } = useQuery<YoutubeVideo[]>({
    queryKey: [`/api/youtube/popular?uid=${encodeURIComponent(userIdentifier)}`],
    enabled: !searchQuery,
  });
  
  // 検索クエリ - ユーザー識別子を含める
  const { data: searchResults, isLoading: searchLoading } = useQuery<YoutubeSearchResponse>({
    queryKey: [`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&type=${searchType}&uid=${encodeURIComponent(userIdentifier)}`],
    enabled: searchQuery.length > 0,
  });

  // ユーザーが検索した場合
  const handleSearch = (query: string, filter?: string) => {
    setSearchQuery(query);
    setActiveVideoId(null); // 検索時にアクティブなビデオをリセット
    if (filter) {
      setSearchType(filter);
    }
  };

  // 動画を視聴する（ユーザーが明示的に選択した場合のみ）
  const handleWatchVideo = (videoId: string) => {
    setActiveVideoId(videoId);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 動画をダウンロード
  const handleDownloadVideo = (videoId: string) => {
    // Navigate to download tab with video
    setLocation(`/downloader?videoId=${videoId}`);
  };

  // 人気のビデオをVideoItem形式に変換
  const convertToVideoItem = (video: YoutubeVideo): YoutubeVideoItem => {
    return {
      kind: "youtube#searchResult",
      etag: video.videoId,
      id: {
        kind: "youtube#video",
        videoId: video.videoId
      },
      snippet: {
        publishedAt: video.publishedAt || "",
        channelId: "",
        title: video.title,
        description: video.description || "",
        thumbnails: {
          default: { url: video.thumbnailUrl || "" },
          medium: { url: video.thumbnailUrl || "" },
          high: { url: video.thumbnailUrl || "" }
        },
        channelTitle: video.channelTitle,
        liveBroadcastContent: "",
        publishTime: video.publishedAt || ""
      }
    };
  };

  // Extract video items from search results
  const videos = searchResults?.items.filter(
    (item) => {
      if (typeof item.id === 'object') {
        return item.id && 'kind' in item.id && item.id.kind === "youtube#video";
      }
      return typeof item.id === 'string';
    }
  ) as YoutubeVideoItem[] || [];

  // ローディング状態の統合
  const isLoading = searchLoading || (popularLoading && !searchQuery);
  
  // 検索がまだ実行されていない初期状態かどうか
  const isInitialState = !searchQuery && (!popularVideos || popularVideos.length === 0);

  return (
    <>
      <SearchBar 
        onSearch={handleSearch} 
        showFilters={true} 
        placeholder="YouTubeの動画を検索..."
      />

      {/* Video Player (when a video is selected) */}
      {activeVideoId && (
        <VideoPlayer 
          videoId={activeVideoId} 
          onDownload={handleDownloadVideo} 
        />
      )}

      {/* Results Section */}
      <div className="mb-6">
        {!isInitialState && (
          <>
            {searchQuery ? (
              <h2 className="text-lg font-medium mb-4 text-foreground dark:text-foreground">
                「{searchQuery}」の検索結果
              </h2>
            ) : (
              <h2 className="text-lg font-medium mb-4 text-foreground dark:text-foreground flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-muted-foreground dark:text-muted-foreground" />
                おすすめの動画
              </h2>
            )}
          </>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-card dark:bg-card rounded-lg shadow-md dark:shadow-lg p-8 flex justify-center items-center dark:border dark:border-border">
            <div className="text-center">
              <Loader className="h-8 w-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground dark:text-muted-foreground">動画を読み込み中...</p>
            </div>
          </div>
        )}

        {/* Search Results */}
        {!isLoading && searchQuery && videos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {videos.map((video) => (
              <VideoCard
                key={typeof video.id === 'object' ? video.id.videoId : video.id}
                video={video}
                onWatch={handleWatchVideo}
                onDownload={handleDownloadVideo}
              />
            ))}
          </div>
        )}

        {/* Popular Videos (when no search query) */}
        {!isLoading && !searchQuery && popularVideos && popularVideos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {popularVideos.map((video) => (
              <VideoCard
                key={video.videoId}
                video={convertToVideoItem(video)}
                onWatch={handleWatchVideo}
                onDownload={handleDownloadVideo}
              />
            ))}
          </div>
        )}

        {/* Empty Search Results */}
        {!isLoading && searchQuery && videos.length === 0 && (
          <div className="bg-card dark:bg-card rounded-lg shadow-md dark:shadow-lg p-8 text-center dark:border dark:border-border">
            <Search className="h-12 w-12 text-muted-foreground dark:text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium text-foreground dark:text-foreground mb-2">結果が見つかりませんでした</h3>
            <p className="text-muted-foreground dark:text-muted-foreground">別のキーワードで検索してみてください。</p>
          </div>
        )}

        {/* Initial State - Welcome Screen */}
        {isInitialState && (
          <div className="bg-card dark:bg-card rounded-lg shadow-md dark:shadow-lg p-8 text-center dark:border dark:border-border">
            <Play className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-foreground dark:text-foreground">sui-han-ki Tubeへようこそ</h2>
            <p className="text-muted-foreground dark:text-muted-foreground mb-6">
              YouTube動画の視聴とダウンロードができるプライバシー重視のプラットフォームです。
              検索バーに動画名やYouTube URLを入力して始めましょう。
            </p>
            <div className="flex flex-col gap-2 max-w-xs mx-auto text-left">
              <p className="text-sm text-muted-foreground dark:text-muted-foreground flex items-center">
                <span className="inline-block w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mr-2">1</span>
                検索バーに動画名やURLを入力
              </p>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground flex items-center">
                <span className="inline-block w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mr-2">2</span>
                見たい動画をクリック
              </p>
              <p className="text-sm text-muted-foreground dark:text-muted-foreground flex items-center">
                <span className="inline-block w-4 h-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center mr-2">3</span>
                安全に動画を視聴・ダウンロード
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
