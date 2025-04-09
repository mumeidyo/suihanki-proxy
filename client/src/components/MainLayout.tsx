import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayCircle, Globe, Download, Music, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import ViewerTab from "@/pages/ViewerTab";
import ProxyTab from "@/pages/ProxyTab";
import DownloaderTab from "@/pages/DownloaderTab";
import MusicTab from "@/pages/MusicTab";
import ToolsTab from "@/pages/ToolsTab";
import ErrorNotification from "@/components/ErrorNotification";
import ThemeToggle from "@/components/ThemeToggle";
import BackgroundSelector from "@/components/BackgroundSelector";

export default function MainLayout() {
  const [activeTab, setActiveTab] = useState("viewer");
  const [, setLocation] = useLocation();

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setLocation(`/${value === "viewer" ? "" : value}`);
  };

  return (
    <div className="min-h-screen text-foreground" id="main-layout">
      <div className="max-w-5xl mx-auto p-4 relative z-10">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <PlayCircle className="text-primary text-4xl mr-2" />
              <h1 className="text-3xl font-medium text-primary">sui-han-ki Tube & Proxy</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-foreground">テーマ:</span>
              <ThemeToggle />
              <BackgroundSelector />
            </div>
          </div>
          <p className="text-muted-foreground text-sm md:text-base text-center">
            YouTube Viewer, Web Proxy & Downloader
          </p>
        </header>

        {/* Main Tabs */}
        <div className="bg-card text-card-foreground rounded-lg shadow-md overflow-hidden mb-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="viewer">
                <PlayCircle className="h-4 w-4 mr-1" />
                視聴する
              </TabsTrigger>
              <TabsTrigger value="proxy">
                <Globe className="h-4 w-4 mr-1" />
                プロキシ
              </TabsTrigger>
              <TabsTrigger value="downloader">
                <Download className="h-4 w-4 mr-1" />
                ダウンロード
              </TabsTrigger>
              <TabsTrigger value="music">
                <Music className="h-4 w-4 mr-1" />
                曲
              </TabsTrigger>
              <TabsTrigger value="tools">
                <Wrench className="h-4 w-4 mr-1" />
                ツール
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Tab Content */}
        {activeTab === "viewer" && <ViewerTab />}
        {activeTab === "proxy" && <ProxyTab />}
        {activeTab === "downloader" && <DownloaderTab />}
        {activeTab === "music" && <MusicTab />}
        {activeTab === "tools" && <ToolsTab />}

        {/* Footer */}
        <footer className="mt-8 text-center text-muted-foreground text-sm pb-8">
          <p>このツールは学習(意味深)を目的としています。著作権法に従って適切に使用してください。</p>
          <p className="mt-2">© {new Date().getFullYear()} sui-han-ki Tube & Proxy - sui-han-ki,youtubeダウンローダー</p>
        </footer>
      </div>

      {/* Error Notification */}
      <ErrorNotification />
    </div>
  );
}
