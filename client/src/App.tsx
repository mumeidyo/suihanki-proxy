import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import ViewerTab from "@/pages/ViewerTab";
import DownloaderTab from "@/pages/DownloaderTab";
import ToolsTab from "@/pages/ToolsTab";
import { BoardTab } from "@/pages/BoardTab";
import AdminTab from "@/pages/AdminTab";
import MusicTab from "@/pages/MusicTab";
import NavBar from "@/components/NavBar";
import ErrorNotification from "@/components/ErrorNotification";
import { UserSetup } from "@/components/UserSetup";
import { Music } from "lucide-react";

// 共通レイアウト
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="bg-primary text-white p-2 rounded-lg mr-3">
                <Music className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">SUI Music Player</h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  音楽を簡単に検索して再生
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Bar - 全ページで共通 */}
        <div className="mb-8 sticky top-0 z-40">
          <NavBar />
        </div>

        {/* Main Content */}
        <div className="mb-20 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm pb-8">
          <p>このアプリは音楽の検索と再生を目的としています。著作権に配慮して適切にご利用ください。</p>
          <p className="mt-2">© {new Date().getFullYear()} SUI Music Player - 快適な音楽体験</p>
        </footer>
      </div>

      {/* Error Notification */}
      <ErrorNotification />
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={ViewerTab} />
        <Route path="/downloader" component={DownloaderTab} />
        <Route path="/tools" component={ToolsTab} />
        <Route path="/board" component={BoardTab} />
        <Route path="/music" component={MusicTab} />
        <Route path="/admin" component={AdminTab} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  const [isSetupComplete, setSetupComplete] = useState(false);
  
  // ユーザー設定が完了したときの処理
  const handleSetupComplete = () => {
    setSetupComplete(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      {!isSetupComplete && (
        <UserSetup onAuthenticated={handleSetupComplete} />
      )}
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
