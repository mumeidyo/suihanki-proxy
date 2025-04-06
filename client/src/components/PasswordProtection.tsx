import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, CheckCircle, User, Flame } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PasswordProtectionProps {
  onAuthenticated: () => void;
}

// 暗号化されたユーザーコード（難読化のための簡易実装）
function verifyUserCode(code: string): boolean {
  // 単純な難読化: suihanki2025
  return code === 's' + 'u' + 'i' + 'h' + 'a' + 'nki' + '2' + '0' + '2' + '5';
}

export function PasswordProtection({ onAuthenticated }: PasswordProtectionProps) {
  const [userCode, setUserCode] = useState('');
  const [setupAttempts, setSetupAttempts] = useState(0);
  const [setupComplete, setSetupComplete] = useState(false);
  const { toast } = useToast();
  
  // ユーザー設定を確認
  useEffect(() => {
    const hasCompletedSetup = localStorage.getItem('user_setup_complete');
    if (hasCompletedSetup === 'yes') {
      setSetupComplete(true);
      setTimeout(() => {
        onAuthenticated();
      }, 500);
    }
  }, [onAuthenticated]);

  const handleSetupComplete = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verifyUserCode(userCode)) {
      // セットアップ完了
      localStorage.setItem('user_setup_complete', 'yes');
      setSetupComplete(true);
      toast({
        title: 'セットアップ完了',
        description: 'ユーザー設定が保存されました',
        variant: 'default',
      });
      
      setTimeout(() => {
        onAuthenticated();
      }, 1000);
    } else {
      // 設定エラー
      setSetupAttempts(prev => prev + 1);
      toast({
        title: '設定エラー',
        description: 'ユーザーコードが無効です',
        variant: 'destructive',
      });
      
      setUserCode('');
    }
  };

  if (setupComplete) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900 dark:to-gray-900 z-50">
        <div className="text-center animate-pulse">
          <CheckCircle className="mx-auto h-16 w-16 text-blue-600 dark:text-blue-400" />
          <h2 className="mt-4 text-xl font-semibold text-blue-800 dark:text-blue-300">初期設定完了</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">アプリケーションを準備しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-gray-900 dark:to-gray-800 z-50">
      <Card className="w-full max-w-md mx-4 shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center">
            <User className="mr-2 h-6 w-6" />
            初期設定
          </CardTitle>
          <CardDescription>
            アプリケーションを利用するために、<br />
            初期設定を完了してください。
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSetupComplete}>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  <div className="flex items-center mb-2">
                    <Flame className="w-4 h-4 mr-1 text-amber-500" />
                    <span>ユーザーコードを入力してください</span>
                  </div>
                  <div className="text-xs opacity-80 ml-5">※クラスの先生から配布されたコードです</div>
                </div>
                <Input
                  type="text"
                  placeholder="ユーザーコードを入力..."
                  value={userCode}
                  onChange={(e) => setUserCode(e.target.value)}
                  className="w-full"
                  required
                  autoFocus
                />
                {setupAttempts > 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    無効なコードです。先生に確認してください。
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit">
              設定を保存
            </Button>
          </CardFooter>
        </form>
        <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
          このアプリケーションは教育目的での利用を前提としています。<br />
          学校の利用ガイドラインに従ってご利用ください。
        </div>
      </Card>
    </div>
  );
}