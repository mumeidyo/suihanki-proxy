import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Play, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// YouTube動画IDを抽出する関数
function extractYouTubeID(url: string): string | null {
  if (!url) return null;
  
  // YouTube URL形式の正規表現
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[7].length === 11) ? match[7] : null;
}

export default function ProxyTab() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  // URL入力からビデオIDを抽出
  useEffect(() => {
    const extractedId = extractYouTubeID(url);
    setVideoId(extractedId);
    
    if (url && !extractedId) {
      setError("有効なYouTube URLを入力してください");
    } else {
      setError(null);
    }
  }, [url]);
  
  // プロキシプレーヤーを開く
  const openProxyPlayer = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでプロキシプレーヤーを開く
    window.open(`/api/youtube/proxy-player/${videoId}`, "_blank");
  };
  
  // ダイレクトストリームを開く
  const openDirectStream = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでダイレクトストリームを開く
    window.open(`/api/youtube/direct-stream/${videoId}`, "_blank");
  };
  
  // Androidプレーヤーを開く
  const openAndroidPlayer = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでAndroidプレーヤーを開く
    window.open(`/api/youtube/android-player/${videoId}`, "_blank");
  };
  
  const openEmbedPlayer = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでエンベッドプレーヤーを開く
    window.open(`/api/youtube/embed/${videoId}`, "_blank");
  };
  
  const openSuperFastPlayer = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでスーパーファストプレーヤーを開く
    window.open(`/api/youtube/superfast/${videoId}`, "_blank");
  };
  
  const openProgressivePlayer = () => {
    if (!videoId) {
      toast({
        title: "エラー",
        description: "有効なYouTube URLを入力してください",
        variant: "destructive"
      });
      return;
    }
    
    // 新しいタブでプログレッシブプレーヤーを開く
    window.open(`/api/youtube/progressive/${videoId}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>YouTubeプロキシプレーヤー</CardTitle>
          <CardDescription>
            YouTubeの動画URLを入力して、プロキシで視聴します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="YouTube URLを入力してください"
                  className="pl-8"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <Button onClick={openProxyPlayer} className="gap-1">
                <Play className="h-4 w-4" />
                <span>再生</span>
              </Button>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {videoId && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                <Button variant="outline" onClick={openDirectStream} className="justify-start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  ダイレクトプレーヤー
                </Button>
                <Button variant="outline" onClick={openAndroidPlayer} className="justify-start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Androidプレーヤー
                </Button>
                <Button variant="outline" onClick={openEmbedPlayer} className="justify-start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  埋め込みプレーヤー
                </Button>
                <Button variant="outline" onClick={openSuperFastPlayer} className="justify-start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  超高速プレーヤー
                </Button>
                <Button variant="outline" onClick={openProgressivePlayer} className="justify-start">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  プログレッシブプレーヤー
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>使い方</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium mb-1">プロキシプレーヤー</h3>
              <p className="text-muted-foreground">
                標準的なプロキシプレーヤーです。ビデオが別サーバー経由で読み込まれます。
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">ダイレクトプレーヤー</h3>
              <p className="text-muted-foreground">
                ビデオを直接ストリーミングするプレーヤーです。より高速に読み込めます。
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">Androidプレーヤー</h3>
              <p className="text-muted-foreground">
                Androidデバイス向けに最適化されたプレーヤーです。モバイル端末での視聴に適しています。
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">埋め込みプレーヤー</h3>
              <p className="text-muted-foreground">
                シンプルな埋め込み型プレーヤーです。軽量で読み込みが速いです。
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">超高速プレーヤー</h3>
              <p className="text-muted-foreground">
                最も高速なプレーヤーです。ビデオフォーマットを自動選択し、即時再生を開始します。
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-1">プログレッシブプレーヤー</h3>
              <p className="text-muted-foreground">
                プログレッシブ読み込みに対応したプレーヤーです。ビデオ全体がダウンロードされる前に再生を開始します。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}