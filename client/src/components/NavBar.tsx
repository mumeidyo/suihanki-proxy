import { useLocation } from "wouter";
import { PlayCircle, Download, Wrench, MessageSquare, Shield, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import DataManager from "@/lib/data-manager";
import roleManager from "@/lib/role-manager";

export default function NavBar() {
  const [location, setLocation] = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 現在のパスに基づいてアクティブなタブを決定
  const getActiveTab = () => {
    if (location === "/") return "viewer";
    if (location.startsWith("/downloader")) return "downloader";
    if (location.startsWith("/tools")) return "tools";
    if (location.startsWith("/board")) return "board";
    if (location.startsWith("/music")) return "music";
    if (location.startsWith("/admin")) return "admin";
    return "";
  };

  // シードからユーザーIDを生成する関数
  const generateUserIdFromSeed = (seed: string): string => {
    // Seedからユーザーのハッシュを生成
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    // ユーザーIDを生成
    const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let userId = "";
    
    let tempHash = Math.abs(hash);
    for (let i = 0; i < 8; i++) {
      userId += base64Chars[tempHash % 64];
      tempHash = Math.floor(tempHash / 64);
      
      if (tempHash === 0) {
        tempHash = (hash + i + 1) * 31;
      }
    }
    
    return userId;
  };

  // ユーザーの権限をチェックして管理者かどうかを判定する関数
  const checkAdminAccess = () => {
    const storedSeed = DataManager.getData("userSeed");
    
    if (storedSeed) {
      const userId = generateUserIdFromSeed(storedSeed);
      
      // 管理パネルへのアクセス権限があるかをチェック
      // adminとleaderとmanagerだけが管理パネルにアクセス可能（memberはアクセス不可）
      const userRole = roleManager.getUserRole(userId);
      setIsAdmin(
        userRole === 'admin' || 
        userRole === 'leader' || 
        userRole === 'developer'
      );
    }
  };

  // 権限変更イベントのハンドラー
  const handleRoleChanged = () => {
    // 権限が変更されたら管理者権限を再チェック
    checkAdminAccess();
  };

  // コンポーネントがマウントされたときに管理者かどうかをチェック
  useEffect(() => {
    // 初期チェック
    checkAdminAccess();
    
    // roleManagerにイベントリスナーを登録
    roleManager.addEventListener('role_changed', handleRoleChanged);
    
    // クリーンアップ関数
    return () => {
      roleManager.removeEventListener('role_changed', handleRoleChanged);
    };
  }, []);

  const currentTab = getActiveTab();

  const handleTabClick = (tab: string) => {
    setLocation(`/${tab === "viewer" ? "" : tab}`);
  };

  return (
    <div className="rounded-xl overflow-hidden shadow-md w-full">
      <div className="grid grid-cols-5 bg-white dark:bg-gray-800">
        <button
          onClick={() => handleTabClick("music")}
          className={cn(
            "flex items-center justify-center px-4 py-3 transition-colors",
            currentTab === "music" 
              ? "bg-primary text-white" 
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Music className="h-5 w-5 mr-2" />
          <span className="font-medium">音楽</span>
        </button>

        <button
          onClick={() => handleTabClick("viewer")}
          className={cn(
            "flex items-center justify-center px-4 py-3 transition-colors",
            currentTab === "viewer" 
              ? "bg-primary text-white" 
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <PlayCircle className="h-5 w-5 mr-2" />
          <span className="font-medium">動画</span>
        </button>

        <button
          onClick={() => handleTabClick("downloader")}
          className={cn(
            "flex items-center justify-center px-4 py-3 transition-colors",
            currentTab === "downloader" 
              ? "bg-primary text-white" 
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Download className="h-5 w-5 mr-2" />
          <span className="font-medium">ダウンロード</span>
        </button>

        <button
          onClick={() => handleTabClick("board")}
          className={cn(
            "flex items-center justify-center px-4 py-3 transition-colors",
            currentTab === "board" 
              ? "bg-primary text-white" 
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <MessageSquare className="h-5 w-5 mr-2" />
          <span className="font-medium">掲示板</span>
        </button>

        <button
          onClick={() => handleTabClick("tools")}
          className={cn(
            "flex items-center justify-center px-4 py-3 transition-colors",
            currentTab === "tools" 
              ? "bg-primary text-white" 
              : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <Wrench className="h-5 w-5 mr-2" />
          <span className="font-medium">設定</span>
        </button>
      </div>
        
      {isAdmin && (
        <button
          onClick={() => handleTabClick("admin")}
          className={cn(
            "flex items-center justify-center px-4 py-2 w-full transition-colors",
            currentTab === "admin" 
              ? "bg-red-600 text-white" 
              : "bg-red-50 text-red-700 hover:bg-red-100"
          )}
        >
          <Shield className="h-4 w-4 mr-2" />
          <span className="font-medium">管理パネル</span>
        </button>
      )}
    </div>
  );
}