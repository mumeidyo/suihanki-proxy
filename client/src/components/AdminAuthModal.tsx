import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import roleManager from "@/lib/role-manager";
import DataManager from "@/lib/data-manager";

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 管理者認証モーダル
 * シードパスワードを使用して管理者であることを確認するためのモーダル
 */
export function AdminAuthModal({ isOpen, onClose, onSuccess }: AdminAuthModalProps) {
  const { toast } = useToast();
  const [seedPassword, setSeedPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Seedからユーザーのハッシュを生成
  const generateUserIdFromSeed = (seed: string): string => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
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

  // 認証ハンドラー
  const handleAuthenticate = async () => {
    if (!seedPassword.trim()) {
      toast({
        title: "エラー",
        description: "シードパスワードを入力してください。",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // シードパスワードからユーザーIDを生成
      const userId = generateUserIdFromSeed(seedPassword);
      
      // 開発者、リーダー、アドミン権限を持っているかチェック（非同期API使用）
      // メンバー権限ではアクセスできない
      const userRole = await roleManager.getUserRoleAsync(userId);
      const hasAccess = 
        userRole === 'admin' || 
        userRole === 'leader' || 
        userRole === 'developer';
      
      if (hasAccess) {
        // ログイン成功
        toast({
          title: "認証成功",
          description: "管理パネルへのアクセス権限が確認されました。",
        });
        
        // シードを保存
        DataManager.saveData("userSeed", seedPassword, 30); // 30日間保持
        DataManager.saveData("userId", userId, 30);
        
        // 成功コールバックを呼び出し
        onSuccess();
      } else {
        // 権限なし
        toast({
          title: "アクセス拒否",
          description: "アクセス権限がありません。",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('認証エラー:', error);
      toast({
        title: "エラー",
        description: "認証処理中にエラーが発生しました。",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-500" />
            権限認証
          </DialogTitle>
          <DialogDescription>
            管理ページにアクセスするには、開発者、リーダー、またはアドミン権限を持つシードパスワードを入力してください。
            メンバー権限ではアクセスできません。
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="seed-password">シードパスワード</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                id="seed-password"
                type="password"
                placeholder="シードパスワードを入力"
                value={seedPassword}
                onChange={(e) => setSeedPassword(e.target.value)}
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthenticate()}
              />
            </div>
            <p className="text-xs text-gray-500">
              ※掲示板の投稿時に使用したシードパスワードと同じものを使用します
            </p>
          </div>
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            キャンセル
          </Button>
          <Button onClick={handleAuthenticate} disabled={isLoading || !seedPassword.trim()}>
            {isLoading ? "認証中..." : "認証"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}