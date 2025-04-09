import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Download, Zap } from "lucide-react";
import { formatDuration, formatPublishedDate } from "@/lib/youtube";
import { YoutubeVideoItem } from "@/types/youtube";
import { openUrl } from "@/lib/aboutBlank";

interface VideoCardProps {
  video: YoutubeVideoItem;
  onWatch: (videoId: string) => void;
  onDownload: (videoId: string) => void;
}

export default function VideoCard({ video, onWatch, onDownload }: VideoCardProps) {
  const {
    id,
    snippet,
    contentDetails,
    statistics
  } = video;

  const videoId = typeof id === 'object' ? id.videoId : id;
  const thumbnailUrl = snippet.thumbnails.high?.url || snippet.thumbnails.medium?.url || '';
  const duration = contentDetails?.duration || '';
  // 正しい形式に変換
  const formattedDuration = duration ? formatDuration(duration) : '';
  const formattedViews = statistics?.viewCount
    ? `${parseInt(statistics.viewCount).toLocaleString()} 回視聴`
    : '';
  const formattedDate = formatPublishedDate(snippet.publishedAt);

  // 直接プロキシプレーヤーページを開くための関数
  const openProxyPlayer = () => {
    // プロキシプレーヤーのURLを作成
    const playerUrl = `/api/youtube/proxy-player/${videoId}`;
    // 新しいタブで開く (about:blankモード対応)
    openUrl(playerUrl);
  };
  
  // プログレッシブプレーヤーページを開くための関数
  const openProgressivePlayer = () => {
    // プログレッシブプレーヤーのURLを作成
    const playerUrl = `/api/youtube/progressive/${videoId}`;
    // 新しいタブで開く (about:blankモード対応)
    openUrl(playerUrl);
  };

  return (
    <Card className="overflow-hidden flex flex-col h-full">
      <div 
        className="relative pt-[56.25%] cursor-pointer" 
        onClick={() => {
          console.log('サムネイルクリック ->', videoId); 
          onWatch(videoId);
        }}
      >
        <img
          src={thumbnailUrl}
          alt={snippet.title}
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        {formattedDuration && (
          <span className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
            {formattedDuration}
          </span>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 flex items-center justify-center transition-all duration-200">
          <div className="bg-black bg-opacity-60 rounded-full p-3 opacity-0 hover:opacity-100 transition-opacity">
            <Play className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>
      <div 
        className="p-4 flex-grow cursor-pointer hover:bg-muted/50" 
        onClick={() => {
          console.log('情報領域クリック ->', videoId); 
          onWatch(videoId);
        }}
      >
        <h3 className="font-medium text-base mb-1 line-clamp-2">{snippet.title}</h3>
        <p className="text-muted-foreground text-sm mb-2">{snippet.channelTitle}</p>
        <div className="flex items-center text-xs text-muted-foreground">
          {formattedViews && (
            <>
              <span>{formattedViews}</span>
              <span className="mx-1">•</span>
            </>
          )}
          <span>{formattedDate}</span>
        </div>
      </div>
      <div className="px-4 pb-2 mt-auto flex flex-wrap gap-2 justify-between">
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="text-sm"
            onClick={openProxyPlayer}
          >
            <Play className="h-4 w-4 mr-1" />通常再生
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="text-sm"
            onClick={openProgressivePlayer}
          >
            <Zap className="h-4 w-4 mr-1" />高速再生
          </Button>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="text-sm"
          onClick={() => onDownload(videoId)}
        >
          <Download className="h-4 w-4 mr-1" />保存
        </Button>
      </div>
      
      {/* 動画情報の要約（タイトルと視聴回数を表示） */}
      <div className="px-4 pb-4 mt-1">
        <div className="bg-muted/30 rounded p-2 text-xs">
          <p className="font-medium line-clamp-1">{snippet.title}</p>
          <div className="flex justify-between items-center mt-1">
            <span className="text-muted-foreground">{snippet.channelTitle}</span>
            {statistics?.viewCount && (
              <span className="text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                {parseInt(statistics.viewCount).toLocaleString()} 回視聴
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
