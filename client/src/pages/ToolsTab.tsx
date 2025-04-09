import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, ExternalLink, Image, Moon, Sun, Save, Upload } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { isAboutBlankModeEnabled } from "@/lib/aboutBlank";
import ThemeToggle from "@/components/ThemeToggle";

export default function ToolsTab() {
  const { toast } = useToast();
  const [useAboutBlank, setUseAboutBlank] = useState(false);
  const [customIconUrl, setCustomIconUrl] = useState("");

  const handleAboutBlankToggle = (checked: boolean) => {
    setUseAboutBlank(checked);
    
    // ローカルストレージに設定を保存（aboutBlank.ts の isAboutBlankModeEnabled() で使用される）
    localStorage.setItem("useAboutBlank", checked ? "true" : "false");
    
    // ユーザーに通知
    toast({
      title: "設定を更新しました",
      description: checked 
        ? "リンクのクリック時にabout:blank内でコンテンツを開くように設定しました" 
        : "通常モードでリンクを開くように設定しました",
    });
  };

  const handleIconChange = () => {
    if (!customIconUrl.trim()) {
      toast({
        title: "URLが必要です",
        description: "アイコン画像のURLを入力してください",
        variant: "destructive",
      });
      return;
    }

    // ローカルストレージにアイコンURLを保存
    localStorage.setItem("customIconUrl", customIconUrl);
    
    // ファビコンの更新
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (link) {
      link.href = customIconUrl;
    } else {
      const newLink = document.createElement("link");
      newLink.rel = "icon";
      newLink.href = customIconUrl;
      document.head.appendChild(newLink);
    }

    toast({
      title: "アプリアイコンを更新しました",
      description: "ページを再読み込みするとすべての場所で反映されます",
    });
  };
  
  // 設定をバックアップする関数
  const backupSettings = () => {
    // 保存するローカルストレージキーのリスト
    const keysToBackup = [
      "app-theme", 
      "app-background", 
      "customIconUrl", 
      "useAboutBlank", 
      "autoplay", 
      "highQuality", 
      "aggressiveCaching", 
      "disableAnalytics", 
      "saveHistory"
    ];
    
    // 設定オブジェクトを作成
    const backupData: Record<string, string | null> = {};
    keysToBackup.forEach(key => {
      backupData[key] = localStorage.getItem(key);
    });
    
    // JSONとしてシリアライズ
    const jsonData = JSON.stringify(backupData, null, 2);
    
    // ダウンロード用のリンクを作成
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sui-han-ki-settings-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // クリーンアップ
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    toast({
      title: "設定をバックアップしました",
      description: "設定情報をJSONファイルとして保存しました",
    });
  };
  
  // 設定を復元する関数
  const restoreSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = e.target?.result as string;
        const settings = JSON.parse(jsonData);
        
        // 設定を復元
        Object.entries(settings).forEach(([key, value]) => {
          if (value !== null) {
            localStorage.setItem(key, value as string);
          }
        });
        
        // ファビコンの更新（もし存在すれば）
        if (settings.customIconUrl) {
          setCustomIconUrl(settings.customIconUrl as string);
          const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (link) {
            link.href = settings.customIconUrl as string;
          }
        }
        
        // about:blankモードの更新
        if (settings.useAboutBlank !== null) {
          setUseAboutBlank(settings.useAboutBlank === "true");
        }
        
        toast({
          title: "設定を復元しました",
          description: "バックアップから設定を正常に復元しました。一部の設定は再読み込み後に反映されます。",
        });
        
        // テーマが変更されている場合には画面を更新する必要があるかもしれない
        if (settings["app-theme"]) {
          // テーマ変更イベントを発行
          const themeChangedEvent = new CustomEvent("themeChanged", {
            detail: { theme: settings["app-theme"], colorName: settings["app-background"] || "default" }
          });
          document.dispatchEvent(themeChangedEvent);
        }
        
      } catch (error) {
        console.error("設定の復元中にエラーが発生しました:", error);
        toast({
          title: "エラー",
          description: "設定ファイルの読み込み中にエラーが発生しました。ファイル形式が正しいか確認してください。",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
    
    // ファイル入力をリセット（同じファイルを再度選択できるように）
    event.target.value = "";
  };

  // コンポーネントマウント時にローカルストレージから設定を読み込み
  useEffect(() => {
    // about:blankモードの状態を取得
    const isEnabled = isAboutBlankModeEnabled();
    setUseAboutBlank(isEnabled);
    
    // アイコンURLを取得
    const savedIconUrl = localStorage.getItem("customIconUrl");
    if (savedIconUrl) {
      setCustomIconUrl(savedIconUrl);
    }
  }, []);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            設定
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>アプリアイコン設定</CardTitle>
                <CardDescription>
                  アプリケーションのファビコン（ブラウザタブのアイコン）をカスタマイズできます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="iconUrl">アイコンのURL</Label>
                  <Input
                    id="iconUrl"
                    placeholder="https://example.com/icon.png"
                    value={customIconUrl}
                    onChange={(e) => setCustomIconUrl(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleIconChange} className="w-full">
                  <Image className="h-4 w-4 mr-2" />
                  アイコンを変更
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>テーマ設定</CardTitle>
                <CardDescription>
                  アプリケーションの色テーマを変更できます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="theme">テーマモード</Label>
                    <p className="text-sm text-muted-foreground">
                      ライト（白）モードとダーク（黒）モードを切り替えられます
                    </p>
                  </div>
                  <ThemeToggle />
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  選択したテーマ設定はブラウザに保存され、次回アクセス時も維持されます。
                </p>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>表示設定</CardTitle>
                <CardDescription>
                  アプリケーションの表示や動作に関する設定を変更できます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="aboutBlank">about:blankモード</Label>
                    <p className="text-sm text-muted-foreground">
                      リンクがabout:blank内で開かれるようになります
                    </p>
                  </div>
                  <Switch
                    id="aboutBlank"
                    checked={useAboutBlank}
                    onCheckedChange={handleAboutBlankToggle}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  about:blankモードをオンにすると、コンテンツがより匿名に表示されます。
                </p>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>パフォーマンス設定</CardTitle>
                <CardDescription>
                  アプリケーションの表示や動作に関する設定を変更できます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoplayToggle">自動再生</Label>
                    <p className="text-sm text-muted-foreground">
                      動画の読み込み完了後に自動的に再生を開始します
                    </p>
                  </div>
                  <Switch
                    id="autoplayToggle"
                    checked={localStorage.getItem("autoplay") !== "false"}
                    onCheckedChange={(checked) => {
                      localStorage.setItem("autoplay", checked ? "true" : "false");
                      toast({
                        title: "設定を更新しました",
                        description: checked 
                          ? "動画の自動再生を有効にしました" 
                          : "動画の自動再生を無効にしました",
                      });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="highQualityToggle">高画質優先</Label>
                    <p className="text-sm text-muted-foreground">
                      可能な場合は高画質の動画ストリームを優先します
                    </p>
                  </div>
                  <Switch
                    id="highQualityToggle"
                    checked={localStorage.getItem("highQuality") === "true"}
                    onCheckedChange={(checked) => {
                      localStorage.setItem("highQuality", checked ? "true" : "false");
                      toast({
                        title: "設定を更新しました",
                        description: checked 
                          ? "高画質モードを有効にしました" 
                          : "高画質モードを無効にしました（低速回線に最適）",
                      });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="aggressiveCachingToggle">積極的キャッシング</Label>
                    <p className="text-sm text-muted-foreground">
                      動画情報を積極的にキャッシュして読み込み速度を向上させます
                    </p>
                  </div>
                  <Switch
                    id="aggressiveCachingToggle"
                    checked={localStorage.getItem("aggressiveCaching") !== "false"}
                    onCheckedChange={(checked) => {
                      localStorage.setItem("aggressiveCaching", checked ? "true" : "false");
                      toast({
                        title: "設定を更新しました",
                        description: checked 
                          ? "積極的キャッシングを有効にしました" 
                          : "積極的キャッシングを無効にしました",
                      });
                    }}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  これらの設定は動画の読み込み速度とパフォーマンスに影響します。接続環境に応じて調整してください。
                </p>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>その他の設定</CardTitle>
                <CardDescription>
                  アプリケーションの表示や動作に関する設定を変更できます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="disableAnalyticsToggle">分析の無効化</Label>
                    <p className="text-sm text-muted-foreground">
                      使用状況の分析データ収集を無効にします
                    </p>
                  </div>
                  <Switch
                    id="disableAnalyticsToggle"
                    checked={localStorage.getItem("disableAnalytics") === "true"}
                    onCheckedChange={(checked) => {
                      localStorage.setItem("disableAnalytics", checked ? "true" : "false");
                      toast({
                        title: "設定を更新しました",
                        description: checked 
                          ? "分析データの収集を無効にしました" 
                          : "分析データの収集を許可しました",
                      });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="saveHistoryToggle">視聴履歴の保存</Label>
                    <p className="text-sm text-muted-foreground">
                      視聴した動画の履歴をブラウザに保存します
                    </p>
                  </div>
                  <Switch
                    id="saveHistoryToggle"
                    checked={localStorage.getItem("saveHistory") !== "false"}
                    onCheckedChange={(checked) => {
                      localStorage.setItem("saveHistory", checked ? "true" : "false");
                      toast({
                        title: "設定を更新しました",
                        description: checked 
                          ? "視聴履歴の保存を有効にしました" 
                          : "視聴履歴の保存を無効にしました",
                      });
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="clearHistoryButton">履歴のクリア</Label>
                    <p className="text-sm text-muted-foreground">
                      保存された視聴履歴をすべて削除します
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // 視聴履歴をクリア
                      const keysToKeep = [
                        "app-theme", 
                        "app-background", 
                        "customIconUrl", 
                        "useAboutBlank", 
                        "autoplay", 
                        "highQuality", 
                        "aggressiveCaching", 
                        "disableAnalytics", 
                        "saveHistory"
                      ];
                      
                      // 設定キー以外のすべてのlocalStorageアイテムを削除
                      Object.keys(localStorage).forEach(key => {
                        if (!keysToKeep.includes(key)) {
                          localStorage.removeItem(key);
                        }
                      });
                      
                      toast({
                        title: "履歴をクリアしました",
                        description: "保存されていたすべての視聴履歴を削除しました",
                      });
                    }}
                  >
                    クリア
                  </Button>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  履歴やプライバシーに関する設定を変更できます。設定はこのブラウザ内でのみ有効です。
                </p>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>バックアップと復元</CardTitle>
                <CardDescription>
                  アプリケーションの設定をバックアップしたり、以前のバックアップから復元したりできます。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>設定のバックアップ</Label>
                  <p className="text-sm text-muted-foreground">
                    現在の設定をJSONファイルとして保存します
                  </p>
                  <Button onClick={backupSettings} className="w-full mt-2">
                    <Save className="h-4 w-4 mr-2" />
                    設定をバックアップ
                  </Button>
                </div>
                
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="restore-file">設定の復元</Label>
                  <p className="text-sm text-muted-foreground">
                    以前にバックアップした設定ファイルから復元します
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="restore-file"
                      type="file"
                      accept=".json"
                      onChange={restoreSettings}
                      className="flex-1"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  設定のバックアップは別のデバイスやブラウザでも使用できます。復元後にページの再読み込みをおすすめします。
                </p>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}