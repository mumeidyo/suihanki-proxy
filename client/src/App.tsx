import { useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import ViewerTab from "@/pages/ViewerTab";
import DownloaderTab from "@/pages/DownloaderTab";
import MusicTab from "@/pages/MusicTab";
import ToolsTab from "@/pages/ToolsTab";
import { BoardTab } from "@/pages/BoardTab";
import AdminTab from "@/pages/AdminTab";
import NavBar from "@/components/NavBar";
import ErrorNotification from "@/components/ErrorNotification";
import { UserSetup } from "@/components/UserSetup";
import { MessageSquare } from "lucide-react";

// 共通レイアウト
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto p-4">
        {/* Header */}
        <header className="mb-6 text-center">
          <div className="flex items-center justify-center mb-2">
            <MessageSquare className="text-secondary text-4xl mr-2 dark:text-blue-400" />
            <h1 className="text-3xl font-medium text-neutral-800 dark:text-gray-100">sui掲示板</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
            コミュニケーション掲示板
          </p>
        </header>

        {/* Navigation Bar - 全ページで共通 */}
        <div className="mb-6">
          <NavBar />
        </div>

        {/* Main Content */}
        <div className="mb-6">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm pb-8">
          <p>このサイトは学習とコミュニケーションを目的としています。適切にご利用ください。</p>
          <p className="mt-2">© {new Date().getFullYear()} sui掲示板 - 自由なコミュニケーション掲示板</p>
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
        <Route path="/music" component={MusicTab} />
        <Route path="/tools" component={ToolsTab} />
        <Route path="/board" component={BoardTab} />
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
