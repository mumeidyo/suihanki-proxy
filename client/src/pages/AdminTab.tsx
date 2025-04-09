import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Shield, UserCheck, AlertTriangle, Key, Lock, Ban, Calendar, Trash } from "lucide-react";
import DataManager from "@/lib/data-manager";
import roleManager, { UserRole, ROLE_DISPLAY_NAMES } from "@/lib/role-manager";
import { RoleBadge } from "@/components/RoleBadge";
import { AdminAuthModal } from "@/components/AdminAuthModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * 管理者専用ページ
 * ユーザーに権限を付与するためのインターフェースを提供します
 */
// BAN対象のIPと理由、期限を管理するための型
interface BanData {
  ipAddress: string;
  reason?: string;
  expiresAt?: string | null;
}

export default function AdminTab() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("member");
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("guest");
  const [managedUsers, setManagedUsers] = useState<{id: string, role: UserRole}[]>([]);

  // BAN管理用の状態
  const [banIpAddress, setBanIpAddress] = useState("");
  const [banReason, setBanReason] = useState("");
  const [banExpiry, setBanExpiry] = useState<string>("");
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // ReactQueryクライアント
  const queryClient = useQueryClient();
  
  // コンポーネントがマウントされたときにユーザー情報をロード
  useEffect(() => {
    const loadUserData = async () => {
      const storedSeed = DataManager.getData("userSeed");
      
      if (storedSeed) {
        const generatedId = generateUserIdFromSeed(storedSeed);
        setUserId(generatedId);
        
        try {
          // ユーザーの現在の権限を非同期で取得
          const userRole = await roleManager.getUserRoleAsync(generatedId);
          setCurrentUserRole(userRole);
          
          // 管理者権限かdeveloper権限がある場合は認証済みとする
          if (await roleManager.hasRoleAsync(generatedId, 'admin') || 
              await roleManager.hasRoleAsync(generatedId, 'developer')) {
            setIsAuthenticated(true);
            await loadManagedUsers();
          } else {
            // 権限がない場合は認証モーダルを表示
            setShowAuthModal(true);
          }
        } catch (error) {
          console.error('権限取得エラー:', error);
          // エラーが発生した場合も認証モーダルを表示
          setShowAuthModal(true);
        }
      } else {
        // ユーザー情報がない場合は認証モーダルを表示
        setShowAuthModal(true);
      }
    };
    
    loadUserData();
  }, []);
  
  // 認証成功時の処理
  const handleAuthSuccess = async () => {
    // 認証状態を更新
    setIsAuthenticated(true);
    setShowAuthModal(false);
    
    try {
      // 最新のシード情報を取得
      const storedSeed = DataManager.getData("userSeed");
      if (storedSeed) {
        const generatedId = generateUserIdFromSeed(storedSeed);
        setUserId(generatedId);
        
        // ユーザーの現在の権限を非同期で取得
        const userRole = await roleManager.getUserRoleAsync(generatedId);
        setCurrentUserRole(userRole);
      }
      
      // 管理対象ユーザーを取得
      await loadManagedUsers();
      
      toast({
        title: "認証成功",
        description: "管理者ページにアクセスできるようになりました。",
      });
    } catch (error) {
      console.error('認証後の処理でエラーが発生しました:', error);
      toast({
        title: "エラー",
        description: "ユーザー情報の取得に失敗しました。",
        variant: "destructive",
      });
    }
  };
  
  // 認証モーダルを閉じる時の処理
  const handleAuthModalClose = () => {
    // 認証されていない場合はトップページにリダイレクト
    if (!isAuthenticated) {
      navigate("/");
    }
    setShowAuthModal(false);
  };

  // Seedから一意のユーザーIDを生成する
  const generateUserIdFromSeed = (seed: string): string => {
    // BoardTab.tsxと同じ方法でIDを生成
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let result = "";
    
    let tempHash = Math.abs(hash);
    for (let i = 0; i < 8; i++) {
      result += base64Chars[tempHash % 64];
      tempHash = Math.floor(tempHash / 64);
      
      if (tempHash === 0) {
        tempHash = (hash + i + 1) * 31;
      }
    }
    
    return result;
  };

  // 管理対象ユーザーを取得
  const loadManagedUsers = async () => {
    try {
      // サーバーから最新のユーザーリストを取得
      const usersList = await roleManager.getAllManagedUsers();
      setManagedUsers(usersList);
    } catch (error) {
      console.error("ユーザーリスト取得エラー:", error);
      toast({
        title: "エラー",
        description: "管理対象ユーザーの取得に失敗しました。",
        variant: "destructive",
      });
    }
  };

  // 権限の付与処理
  const handleAssignRole = async () => {
    if (!targetUserId.trim()) {
      toast({
        title: "エラー",
        description: "ユーザーIDを入力してください。",
        variant: "destructive",
      });
      return;
    }

    // 権限を付与
    try {
      console.log("権限付与開始:", targetUserId, selectedRole);
      const success = await roleManager.assignRole(targetUserId, selectedRole);
      
      if (success) {
        toast({
          title: "権限を付与しました",
          description: `ユーザーID「${targetUserId}」に「${ROLE_DISPLAY_NAMES[selectedRole]}」権限を付与しました。`,
        });
        
        setTargetUserId("");
        
        // 管理対象ユーザーを再取得
        await loadManagedUsers();
      } else {
        toast({
          title: "エラー",
          description: "サーバーへの権限設定保存に失敗しました。",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("権限付与エラー:", error);
      toast({
        title: "エラー",
        description: "権限の付与に失敗しました。",
        variant: "destructive",
      });
    }
  };

  // 権限の削除処理
  const handleRemoveRole = async (userId: string) => {
    try {
      const success = await roleManager.removeRole(userId);
      
      if (success) {
        toast({
          title: "権限を削除しました",
          description: `ユーザーID「${userId}」の特別な権限を削除しました。`,
        });
        
        // 管理対象ユーザーを再取得
        await loadManagedUsers();
      } else {
        toast({
          title: "エラー",
          description: "サーバーからの権限削除に失敗しました。",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("権限削除エラー:", error);
      toast({
        title: "エラー",
        description: "権限の削除に失敗しました。",
        variant: "destructive",
      });
    }
  };

  // 自分自身に権限を付与できないように制限
  const isSelfAssignment = targetUserId.trim() === userId;
  
  // BANリストを取得するためのクエリ
  const bannedIpsQuery = useQuery<{ success: boolean, data: any[] }>({
    queryKey: ['/api/bans'],
    enabled: isAuthenticated, // 認証済みの場合のみクエリを実行
  });
  
  // ユーザーをBANするミューテーション
  const banIpMutation = useMutation({
    mutationFn: (banData: BanData) => 
      apiRequest('/api/bans', 'POST', {
        ipAddress: banData.ipAddress,
        reason: banData.reason || undefined,
        bannedBy: userId,
        // expiresAtがundefinedの場合はnullを送信（サーバ側でnullが許可されるようにした）
        expiresAt: banData.expiresAt || null,
      }),
    onSuccess: () => {
      // BANリストを再取得
      queryClient.invalidateQueries({ queryKey: ['/api/bans'] });
      // フォームをリセット
      setBanIpAddress("");
      setBanReason("");
      setBanExpiry("");
      
      toast({
        title: "IPをBANしました",
        description: `IPアドレス「${banIpAddress}」をBANしました。`,
      });
    },
    onError: (error) => {
      console.error("BAN処理エラー:", error);
      toast({
        title: "エラー",
        description: "IPアドレスのBAN処理に失敗しました。",
        variant: "destructive",
      });
    }
  });
  
  // BANを解除するミューテーション
  const unbanIpMutation = useMutation({
    mutationFn: (ipAddress: string) =>
      apiRequest(`/api/bans/${ipAddress}`, 'DELETE'),
    onSuccess: (_, ipAddress) => {
      // BANリストを再取得
      queryClient.invalidateQueries({ queryKey: ['/api/bans'] });
      
      toast({
        title: "BANを解除しました",
        description: `IPアドレス「${ipAddress}」のBANを解除しました。`,
      });
    },
    onError: (error) => {
      console.error("BAN解除エラー:", error);
      toast({
        title: "エラー",
        description: "IPアドレスのBAN解除に失敗しました。",
        variant: "destructive",
      });
    }
  });
  
  // IPアドレスをBANする処理
  const handleBanIp = () => {
    if (!banIpAddress.trim()) {
      toast({
        title: "エラー",
        description: "IPアドレスを入力してください。",
        variant: "destructive",
      });
      return;
    }

    const banData: BanData = {
      ipAddress: banIpAddress,
      reason: banReason,
      expiresAt: banExpiry || null,
    };
    
    banIpMutation.mutate(banData);
  };
  
  // BANを解除する処理
  const handleUnbanIp = (ipAddress: string) => {
    unbanIpMutation.mutate(ipAddress);
  };

  return (
    <div className="space-y-6">
      {/* 管理者認証モーダル */}
      <AdminAuthModal 
        isOpen={showAuthModal} 
        onClose={handleAuthModalClose} 
        onSuccess={handleAuthSuccess} 
      />
      
      <Card>
        <CardHeader className="bg-blue-50 dark:bg-blue-900/30">
          <div className="flex items-center">
            <Shield className="h-6 w-6 mr-2 text-blue-500" />
            <CardTitle>管理者コントロールパネル</CardTitle>
          </div>
          <CardDescription>
            ユーザーの権限を管理します。この機能は管理者のみが使用できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-700 dark:text-yellow-400">注意</h3>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                権限の変更は即時に反映され、付与されたユーザーは管理機能にアクセスできるようになります。
                慎重に操作してください。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="current-user" className="mb-1 block">あなたの情報</Label>
              <div className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <UserCheck className="h-5 w-5 mr-2 text-green-500" />
                <span className="text-sm font-medium mr-2">ユーザーID: {userId}</span>
                <RoleBadge role={currentUserRole} />
              </div>
            </div>

            <Separator className="my-6" />
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">ユーザー権限の付与</h3>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="target-user-id" className="mb-1 block">対象ユーザーID</Label>
                  <Input
                    id="target-user-id"
                    placeholder="例: Z3wp8i3q"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ※ユーザーIDは掲示板の投稿者名の横に表示されます
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="role-select" className="mb-1 block">付与する権限</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as UserRole)}
                  >
                    <SelectTrigger id="role-select">
                      <SelectValue placeholder="権限を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* メンバー権限は全ての管理者が付与可能 */}
                      <SelectItem value="member">メンバー</SelectItem>
                      
                      {/* アドミン権限はリーダーと開発者だけが付与可能 */}
                      {(currentUserRole === 'leader' || currentUserRole === 'developer') && (
                        <SelectItem value="admin">アドミン</SelectItem>
                      )}
                      
                      {/* リーダー権限は開発者だけが付与可能 */}
                      {currentUserRole === 'developer' && (
                        <SelectItem value="leader">リーダー</SelectItem>
                      )}
                      
                      {/* 開発者権限は開発者だけが付与可能 */}
                      {currentUserRole === 'developer' && (
                        <SelectItem value="developer">開発者</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={handleAssignRole} 
                  className="w-full"
                  disabled={!targetUserId.trim() || isSelfAssignment}
                >
                  権限を付与する
                </Button>
                
                {isSelfAssignment && (
                  <p className="text-xs text-red-500">自分自身に権限を付与することはできません</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">権限管理対象ユーザー</CardTitle>
          <CardDescription>
            現在、特別な権限が付与されているユーザーの一覧です
          </CardDescription>
        </CardHeader>
        <CardContent>
          {managedUsers.length > 0 ? (
            <div className="space-y-3">
              {managedUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <div className="flex items-center">
                    <span className="font-mono mr-2">{user.id}</span>
                    <RoleBadge role={user.role} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveRole(user.id)}
                    disabled={user.id === userId} // 自分自身の権限は削除できない
                  >
                    権限を削除
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-4 text-gray-500">
              特別な権限が付与されているユーザーはいません
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* ユーザーBAN管理カード */}
      <Card>
        <CardHeader className="bg-red-50 dark:bg-red-900/30">
          <div className="flex items-center">
            <Ban className="h-6 w-6 mr-2 text-red-500" />
            <CardTitle>ユーザーBAN管理</CardTitle>
          </div>
          <CardDescription>
            問題のあるユーザーをBANして、アクセスを制限します
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-yellow-700 dark:text-yellow-400">重要な注意</h3>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                ユーザーをBANすると、そのユーザーは掲示板にアクセスできなくなります。
                慎重に操作してください。
              </p>
            </div>
          </div>
          
          <div className="space-y-6">
            {/* BAN追加フォーム */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">新規BAN登録</h3>
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="ban-ip-address" className="mb-1 block">ユーザーID（IPアドレスとして扱われます）</Label>
                  <Input
                    id="ban-ip-address"
                    placeholder="例: Z3wp8i3q"
                    value={banIpAddress}
                    onChange={(e) => setBanIpAddress(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    ※掲示板のユーザーIDを入力すると、そのユーザーはアクセスできなくなります
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="ban-reason" className="mb-1 block">BAN理由 (任意)</Label>
                  <Input
                    id="ban-reason"
                    placeholder="例: スパム行為"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="ban-expiry" className="mb-1 flex items-center justify-between">
                    <span>有効期限 (任意)</span>
                    <span className="text-xs text-gray-500">空欄の場合は無期限</span>
                  </Label>
                  <Input
                    id="ban-expiry"
                    type="datetime-local"
                    value={banExpiry}
                    onChange={(e) => setBanExpiry(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleBanIp} 
                  className="w-full"
                  disabled={!banIpAddress.trim() || banIpMutation.isPending}
                  variant="destructive"
                >
                  {banIpMutation.isPending ? "処理中..." : "ユーザーをBANする"}
                </Button>
              </div>
            </div>
            
            {/* BANリスト */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">BANリスト</h3>
              
              {bannedIpsQuery.isLoading ? (
                <p className="text-center py-4 text-gray-500">読み込み中...</p>
              ) : bannedIpsQuery.isError ? (
                <p className="text-center py-4 text-red-500">データの取得に失敗しました</p>
              ) : (
                <>
                  {bannedIpsQuery.data?.data && bannedIpsQuery.data.data.length > 0 ? (
                    <div className="space-y-3">
                      {bannedIpsQuery.data.data.map((ban: any) => (
                        <div key={ban.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="font-mono text-sm font-medium">{ban.ipAddress}</span>
                              {ban.expiresAt && (
                                <span className="ml-2 flex items-center text-xs text-gray-500">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {new Date(ban.expiresAt).toLocaleString()}
                                </span>
                              )}
                              {!ban.expiresAt && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded">
                                  無期限
                                </span>
                              )}
                            </div>
                            {ban.reason && (
                              <p className="mt-1 text-xs text-gray-500">
                                理由: {ban.reason}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              BANした人: {ban.bannedBy} ({new Date(ban.bannedAt).toLocaleString()})
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnbanIp(ban.ipAddress)}
                            disabled={unbanIpMutation.isPending}
                            className="text-red-500 hover:text-red-700 hover:bg-red-100"
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            解除
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-gray-500">
                      BANされているユーザーはいません
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YouTube Cookieアップロードカード */}
      <Card>
        <CardHeader className="bg-purple-50 dark:bg-purple-900/30">
          <div className="flex items-center">
            <Key className="h-6 w-6 mr-2 text-purple-500" />
            <CardTitle>YouTube Cookie設定</CardTitle>
          </div>
          <CardDescription>
            YouTubeの認証Cookieをアップロードしてボットチェックをバイパスします
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-700 dark:text-blue-400">YouTube認証について</h3>
              <p className="text-sm text-blue-600 dark:text-blue-500">
                YouTubeがボット検出を行っている場合、ここにCookieを設定することでアクセスを回復できます。
                Cookieは「Netscape Cookie形式」でテキストとして貼り付けてください。
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="youtube-cookies" className="block">YouTube Cookies</Label>
            <textarea
              id="youtube-cookies"
              className="w-full min-h-[200px] p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
              placeholder=".youtube.com\tTRUE\t/\tTRUE\t1742000000\tNAME\tValue..."
            />
            <p className="text-xs text-gray-500">
              Cookieはブラウザの開発者ツールからエクスポートできます。
              セキュリティ上の理由から、ここにアップロードされたCookieはサーバー側でのみ使用され、
              他のユーザーと共有されることはありません。
            </p>
            <Button
              className="w-full"
              onClick={() => {
                const cookiesText = (document.getElementById('youtube-cookies') as HTMLTextAreaElement)?.value;
                if (!cookiesText) {
                  toast({
                    title: "エラー",
                    description: "Cookie情報を入力してください",
                    variant: "destructive",
                  });
                  return;
                }

                fetch('/api/youtube/cookies', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ cookies: cookiesText }),
                })
                .then(response => response.json())
                .then(data => {
                  if (data.success) {
                    toast({
                      title: "成功",
                      description: "YouTube Cookieが正常に設定されました",
                    });
                    // フォームをクリア
                    (document.getElementById('youtube-cookies') as HTMLTextAreaElement).value = '';
                  } else {
                    toast({
                      title: "エラー",
                      description: data.error || "Cookie設定に失敗しました",
                      variant: "destructive",
                    });
                  }
                })
                .catch(error => {
                  console.error('Cookie設定エラー:', error);
                  toast({
                    title: "エラー",
                    description: "Cookie設定中にエラーが発生しました",
                    variant: "destructive",
                  });
                });
              }}
            >
              Cookieを設定する
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}