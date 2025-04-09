import { useLocation } from "wouter";
import { PlayCircle, Download, Music, Wrench, MessageSquare, Shield } from "lucide-react";
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
    if (location.startsWith("/music")) return "music";
    if (location.startsWith("/tools")) return "tools";
    if (location.startsWith("/board")) return "board";
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
    <div className="flex flex-wrap rounded-lg overflow-hidden shadow-sm w-full bg-white">
      <button
        onClick={() => handleTabClick("viewer")}
        className={cn(
          "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
          currentTab === "viewer" 
            ? "bg-neutral-800 text-white" 
            : "bg-white text-neutral-700 hover:bg-neutral-100"
        )}
      >
        <PlayCircle className="h-5 w-5 mr-2" />
        視聴する
      </button>

      <button
        onClick={() => handleTabClick("downloader")}
        className={cn(
          "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
          currentTab === "downloader" 
            ? "bg-neutral-800 text-white" 
            : "bg-white text-neutral-700 hover:bg-neutral-100"
        )}
      >
        <Download className="h-5 w-5 mr-2" />
        ダウンロード
      </button>

      <button
        onClick={() => handleTabClick("music")}
        className={cn(
          "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
          currentTab === "music" 
            ? "bg-neutral-800 text-white" 
            : "bg-white text-neutral-700 hover:bg-neutral-100"
        )}
      >
        <Music className="h-5 w-5 mr-2" />
        曲
      </button>

      <button
        onClick={() => handleTabClick("tools")}
        className={cn(
          "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
          currentTab === "tools" 
            ? "bg-neutral-800 text-white" 
            : "bg-white text-neutral-700 hover:bg-neutral-100"
        )}
      >
        <Wrench className="h-5 w-5 mr-2" />
        ツール
      </button>

      <button
        onClick={() => handleTabClick("board")}
        className={cn(
          "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
          currentTab === "board" 
            ? "bg-neutral-800 text-white" 
            : "bg-white text-neutral-700 hover:bg-neutral-100"
        )}
      >
        <MessageSquare className="h-5 w-5 mr-2" />
        sui掲示板
      </button>

      {isAdmin && (
        <button
          onClick={() => handleTabClick("admin")}
          className={cn(
            "flex items-center justify-center px-4 py-3 flex-1 transition-colors",
            currentTab === "admin" 
              ? "bg-blue-600 text-white" 
              : "bg-blue-50 text-blue-700 hover:bg-blue-100"
          )}
        >
          <Shield className="h-5 w-5 mr-2" />
          管理
        </button>
      )}
    </div>
  );
}