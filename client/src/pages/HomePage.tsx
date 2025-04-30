import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import SearchBar from "@/components/SearchBar";
import VideoCard from "@/components/VideoCard";
import { YoutubeSearchResponse, YoutubeVideoItem } from "@/types/youtube";
import { YoutubeVideo } from "@shared/schema";
import { useLocation } from "wouter";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch recent videos
  const { data: recentVideos, isLoading: recentLoading } = useQuery<YoutubeVideo[]>({
    queryKey: ['/api/youtube/recent'],
  });

  // Fetch popular videos
  const { data: popularVideos, isLoading: popularLoading } = useQuery<YoutubeVideo[]>({
    queryKey: ['/api/youtube/popular'],
  });

  // Search query
  const { data: searchResults, isLoading: searchLoading } = useQuery<YoutubeSearchResponse>({
    queryKey: [`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`],
    enabled: searchQuery.length > 0,
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleWatchVideo = (videoId: string) => {
    setLocation(`/enhanced-player/${videoId}`);
  };

  const handleDownloadVideo = (videoId: string) => {
    setLocation(`/downloader?videoId=${videoId}`);
  };

  // Convert YoutubeVideo to YoutubeVideoItem format for VideoCard component
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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">動画ストリーミングプラットフォーム</h1>
      
      <Card className="mb-6">
        <CardContent className="pt-6">
          <SearchBar 
            onSearch={handleSearch}
            placeholder="YouTubeビデオを検索..."
            buttonText="検索"
          />
        </CardContent>
      </Card>

      {searchQuery ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">検索結果: {searchQuery}</h2>
          
          {searchLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="w-full h-40 mb-2" />
                    <Skeleton className="w-3/4 h-4 mb-2" />
                    <Skeleton className="w-1/2 h-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchResults?.items && searchResults.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.items.map((video) => (
                <VideoCard
                  key={typeof video.id === 'string' ? video.id : video.id.videoId}
                  video={video}
                  onWatch={handleWatchVideo}
                  onDownload={handleDownloadVideo}
                />
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-500">検索結果が見つかりませんでした</p>
          )}
        </div>
      ) : (
        <Tabs defaultValue="recent" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="recent">最近追加された動画</TabsTrigger>
            <TabsTrigger value="popular">人気の動画</TabsTrigger>
          </TabsList>
          
          <TabsContent value="recent">
            {recentLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="w-full h-40 mb-2" />
                      <Skeleton className="w-3/4 h-4 mb-2" />
                      <Skeleton className="w-1/2 h-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : recentVideos && recentVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentVideos.map((video) => (
                  <VideoCard
                    key={video.videoId}
                    video={convertToVideoItem(video)}
                    onWatch={handleWatchVideo}
                    onDownload={handleDownloadVideo}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">
                まだ視聴した動画がありません
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="popular">
            {popularLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="w-full h-40 mb-2" />
                      <Skeleton className="w-3/4 h-4 mb-2" />
                      <Skeleton className="w-1/2 h-4" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : popularVideos && popularVideos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {popularVideos.map((video) => (
                  <VideoCard
                    key={video.videoId}
                    video={convertToVideoItem(video)}
                    onWatch={handleWatchVideo}
                    onDownload={handleDownloadVideo}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">
                まだダウンロードした動画がありません
              </p>
            )}
          </TabsContent>
        </Tabs>
      )}
      
      <Card className="mb-6 bg-blue-50">
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-2">新機能のお知らせ</h2>
          <p className="mb-4">
            プロキシ機能の代わりに、高品質なダイレクトストリーミング機能を追加しました。
            「拡張プレイヤー」機能で動画を視聴すると、より快適な体験ができます。
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => setLocation('/viewer')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              ビデオを探す
            </button>
            <button 
              onClick={() => setLocation('/downloader')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              ダウンロードする
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}