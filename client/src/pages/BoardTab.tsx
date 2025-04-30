import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ThumbsUp, MessageSquare, User, Clock, Trash, Edit } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";
import DataManager from "@/lib/data-manager";
import roleManager from "@/lib/role-manager";
import { RoleBadge } from "@/components/RoleBadge";
// import { websocketClient, WebSocketEventType } from "@/lib/websocket-client";

// ユーザーの権限タイプの定義
type UserRole = 'leader' | 'admin' | 'member' | 'guest';

// Seedから一意の64進数IDを生成する関数（文字数指定可能）
function generateBase64Id(seed: string, length: number = 8): string {
  // 単純なハッシュ関数
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  
  // 64進数（英数字+記号）での表現
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  
  // ハッシュ値を64進数に変換
  let tempHash = Math.abs(hash); // 負の値を正の値に変換
  for (let i = 0; i < length; i++) {
    result += base64Chars[tempHash % 64];
    tempHash = Math.floor(tempHash / 64);
    
    // ハッシュ値が小さい場合、別の計算を追加して多様性を確保
    if (tempHash === 0) {
      tempHash = (hash + i + 1) * 31;
    }
  }
  
  return result;
}

// 投稿の型定義
interface Post {
  id: number;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  likes: number;
  imageUrl?: string;
}

// コメントの型定義
interface Comment {
  id: number;
  postId: number;
  content: string;
  author: string;
  authorId: string;
  createdAt: string;
  likes: number;
}

// 投稿一覧コンポーネント
function PostList() {
  const { toast } = useToast();
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 10;
  
  // ユーザーがBANされているかどうかの状態
  const [isBanned, setIsBanned] = useState(false);
  const [banErrorMessage, setBanErrorMessage] = useState<string | null>(null);

  // 投稿一覧を取得
  const {
    data: postsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['/api/board/posts', offset, limit],
    queryFn: async () => {
      // ユーザーIDをクエリパラメータに含める（BANチェック用）
      const userSeed = DataManager.getData("userSeed");
      const userId = userSeed ? generateBase64Id(userSeed) : "";
      
      const response = await fetch(`/api/board/posts?limit=${limit}&offset=${offset}&userId=${userId}`);
      if (!response.ok) {
        const errorData = await response.json();
        // BANされている場合の処理
        if (response.status === 403 && errorData.banned) {
          setIsBanned(true);
          setBanErrorMessage(errorData.error || "あなたは管理者によって掲示板へのアクセスを禁止されています");
          throw new Error(errorData.error || "アクセス禁止");
        }
        throw new Error('投稿の取得に失敗しました');
      }
      return response.json();
    },
    // 2秒ごとにポーリングを行う
    refetchInterval: 2000,
    // ユーザーがタブやウィンドウをフォーカスしていなくても更新する
    refetchIntervalInBackground: true,
  });
  
  // role_changedイベントが発生したときにデータを再取得する
  useEffect(() => {
    const handleRoleChanged = () => {
      console.log("PostList - ロール変更イベント受信: データを強制的に再取得します");
      refetch();
    };
    
    roleManager.addEventListener('role_changed', handleRoleChanged);
    
    return () => {
      roleManager.removeEventListener('role_changed', handleRoleChanged);
    };
  }, [refetch]);
  
  // APIレスポンスからデータ配列を取得
  const posts = postsResponse?.data || [];

  // コメント一覧を取得
  const {
    data: commentsResponse,
    isLoading: isCommentsLoading,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['/api/board/posts', selectedPost, 'comments'],
    queryFn: async () => {
      if (!selectedPost) return { data: [] };
      const response = await fetch(`/api/board/posts/${selectedPost}`);
      if (!response.ok) {
        throw new Error('コメントの取得に失敗しました');
      }
      return response.json();
    },
    enabled: !!selectedPost,
    // コメントも2秒ごとに更新
    refetchInterval: selectedPost ? 2000 : false,
    refetchIntervalInBackground: true,
  });
  
  // role_changedイベントが発生したときにコメントデータも再取得する
  useEffect(() => {
    if (!selectedPost) return;
    
    const handleRoleChanged = () => {
      console.log("Comments - ロール変更イベント受信: コメントデータを強制的に再取得します");
      refetchComments();
    };
    
    roleManager.addEventListener('role_changed', handleRoleChanged);
    
    return () => {
      roleManager.removeEventListener('role_changed', handleRoleChanged);
    };
  }, [selectedPost, refetchComments]);
  
  // APIレスポンスからコメント配列を取得
  const comments = commentsResponse?.data || [];

  // いいねボタンのクリックハンドラー
  const likeMutation = useMutation({
    mutationFn: async (postId: number) => {
      const response = await fetch(`/api/board/posts/${postId}/like`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('いいねの登録に失敗しました');
      }
      return response.json();
    },
    onSuccess: () => {
      // 投稿一覧を再取得
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts'] });
      toast({
        title: "いいねを送信しました！",
        description: "投稿にいいねを追加しました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `いいねの登録に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 次のページを表示
  const loadMorePosts = () => {
    setOffset(prev => prev + limit);
  };

  // 前のページを表示
  const loadPreviousPosts = () => {
    setOffset(prev => Math.max(0, prev - limit));
  };

  if (isLoading) {
    return <div className="text-center p-6">投稿を読み込み中...</div>;
  }

  if (isBanned) {
    return (
      <div className="text-center p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
          <h3 className="text-lg font-medium text-red-700 dark:text-red-400 mb-2">アクセス制限</h3>
          <p className="text-red-600 dark:text-red-300">{banErrorMessage || "あなたは管理者によって掲示板へのアクセスを禁止されています"}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return <div className="text-center p-6 text-red-500">投稿の読み込みに失敗しました</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 bg-green-50 dark:bg-green-900/20 p-2 border border-green-200 dark:border-green-900 font-mono">
          <div className="text-green-800 dark:text-green-300 font-bold text-sm">
            ■ 投稿一覧
          </div>
        </div>
        <div className="space-y-0">
          {posts && posts.length > 0 ? (
            posts.map((post: Post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={() => likeMutation.mutate(post.id)}
                onSelect={() => setSelectedPost(post.id === selectedPost ? null : post.id)}
                isSelected={post.id === selectedPost}
              />
            ))
          ) : (
            <div className="p-4 text-center font-mono text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              まだ投稿はありません。最初の投稿をしてみましょう！
            </div>
          )}
        </div>
        
        {/* ページネーション (2chスタイル) */}
        <div className="flex justify-between mt-4 font-mono text-sm">
          <button
            onClick={loadPreviousPosts}
            disabled={offset === 0}
            className={`px-3 py-1 border border-gray-300 dark:border-gray-600 ${offset === 0 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            前のページ
          </button>
          <button
            onClick={loadMorePosts}
            disabled={!posts || posts.length < limit}
            className={`px-3 py-1 border border-gray-300 dark:border-gray-600 ${!posts || posts.length < limit ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
          >
            次のページ
          </button>
        </div>
      </div>

      {/* 選択した投稿のコメント表示 (2chスタイル) */}
      {selectedPost && (
        <div className="mt-4 mb-6 border border-gray-300 dark:border-gray-700">
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-900 p-2 font-mono">
            <div className="text-blue-800 dark:text-blue-300 font-bold text-sm">
              ■ コメント一覧
            </div>
          </div>
          
          {isCommentsLoading ? (
            <div className="p-3 font-mono text-sm text-center">コメントを読み込み中...</div>
          ) : comments && comments.length > 0 ? (
            <div className="p-2 space-y-1">
              {comments.map((comment: Comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <div className="p-3 font-mono text-sm text-center text-gray-600 dark:text-gray-400">
              まだコメントはありません。最初の返信をしましょう！
            </div>
          )}
          
          <div className="border-t border-gray-300 dark:border-gray-700">
            <CommentForm postId={selectedPost} />
          </div>
        </div>
      )}
    </div>
  );
}

// 投稿カードコンポーネント (2chスタイル)
function PostCard({ 
  post, 
  onLike, 
  onSelect, 
  isSelected 
}: { 
  post: Post; 
  onLike: () => void; 
  onSelect: () => void; 
  isSelected: boolean;
}) {
  const { toast } = useToast();
  // 状態として役割を管理（更新時に再レンダリングさせるため）
  const [userRole, setUserRole] = useState(roleManager.getUserRole(post.authorId));
  // 現在のユーザーのロールを取得
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  // 権限変更イベントのハンドラー
  const handleRoleChanged = (data: any) => {
    console.log("投稿カード - 権限変更イベント受信:", data, "このポストの作者ID:", post.authorId.substring(0, 8));
    // 変更されたユーザーIDがこの投稿の作者と一致する場合に更新
    if (data.id === post.authorId.substring(0, 8)) {
      console.log("投稿カード - 権限を更新:", data.role);
      setUserRole(data.role);
    }
  };
  
  // 現在のユーザーのロールを取得
  useEffect(() => {
    const checkCurrentUserRole = async () => {
      const role = await roleManager.getCurrentUserRole();
      setCurrentUserRole(role);
    };
    
    checkCurrentUserRole();
  }, []);
  
  // コンポーネントマウント時にイベントリスナーを登録
  useEffect(() => {
    roleManager.addEventListener('role_changed', handleRoleChanged);
    
    // クリーンアップ関数
    return () => {
      roleManager.removeEventListener('role_changed', handleRoleChanged);
    };
  }, [post.authorId]);
  
  // 投稿削除ミューテーション
  const deletePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      // 管理者権限ヘッダーを追加
      const response = await fetch(`/api/board/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'x-user-role': currentUserRole || ''
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '投稿の削除に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // 投稿一覧を再取得
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts'] });
      toast({
        title: "投稿を削除しました",
        description: `投稿 #${post.id} を削除しました。`,
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `投稿削除に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // 日付をフォーマット
  const formattedDate = formatDistanceToNow(new Date(post.createdAt), { 
    addSuffix: true,
    locale: ja
  });

  // 2chスタイルのシンプルなUIを実装
  return (
    <div className={`mb-2 border-b border-gray-300 pb-2 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
      {/* ヘッダー部分 */}
      <div className="text-sm bg-green-50 dark:bg-green-900/10 p-1 font-mono">
        <span className="text-gray-500 font-bold mr-2">#{post.id}</span>
        <span className="font-bold">{post.author}</span>
        <span className="mx-1 text-gray-500">ID:{post.authorId.substring(0, 8)}</span>
        <RoleBadge role={userRole} />
        <span className="ml-2 text-gray-500 text-xs">{formattedDate}</span>
        
        {/* いいねとコメントボタン */}
        <span className="float-right">
          <button onClick={onLike} className="text-xs text-gray-500 hover:underline mx-2">
            {post.likes}いいね
          </button>
          <button onClick={onSelect} className="text-xs text-gray-500 hover:underline">
            {isSelected ? '閉じる' : 'コメント表示'}
          </button>
        </span>
      </div>
      
      {/* 本文 */}
      <div className="p-2 whitespace-pre-line font-mono text-sm">
        {post.content}
        {post.imageUrl && (
          <div className="mt-3">
            <img 
              src={post.imageUrl} 
              alt="投稿画像" 
              className="max-w-full h-auto" 
            />
          </div>
        )}
        
        {/* 管理者用削除ボタン - admin, developer, moderatorのみ表示 */}
        {(currentUserRole === 'admin' || currentUserRole === 'developer' || currentUserRole === 'moderator') && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => {
                if (window.confirm(`投稿 #${post.id} を削除しますか？`)) {
                  deletePostMutation.mutate(post.id);
                }
              }}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-800/50 text-red-800 dark:text-red-300 text-xs font-mono border border-red-300 dark:border-red-800 rounded flex items-center"
              disabled={deletePostMutation.isPending}
            >
              {deletePostMutation.isPending ? (
                "削除中..."
              ) : (
                <>
                  <Trash className="h-3 w-3 mr-1" />
                  削除
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// コメントアイテムコンポーネント (2chスタイル)
function CommentItem({ comment }: { comment: Comment }) {
  const { toast } = useToast();
  // 状態として役割を管理（更新時に再レンダリングさせるため）
  const [userRole, setUserRole] = useState(roleManager.getUserRole(comment.authorId));
  
  // 権限変更イベントのハンドラー
  const handleRoleChanged = (data: any) => {
    console.log("コメント - 権限変更イベント受信:", data, "このコメントの作者ID:", comment.authorId.substring(0, 8));
    // 変更されたユーザーIDがこのコメントの作者と一致する場合に更新
    if (data.id === comment.authorId.substring(0, 8)) {
      console.log("コメント - 権限を更新:", data.role);
      setUserRole(data.role);
    }
  };
  
  // コンポーネントマウント時にイベントリスナーを登録
  useEffect(() => {
    roleManager.addEventListener('role_changed', handleRoleChanged);
    
    // クリーンアップ関数
    return () => {
      roleManager.removeEventListener('role_changed', handleRoleChanged);
    };
  }, [comment.authorId]);
  
  // 日付をフォーマット
  const formattedDate = formatDistanceToNow(new Date(comment.createdAt), { 
    addSuffix: true,
    locale: ja 
  });

  // コメントのいいねミューテーション
  const commentLikeMutation = useMutation({
    mutationFn: async (commentId: number) => {
      const response = await fetch(`/api/board/comments/${commentId}/like`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('いいねの登録に失敗しました');
      }
      return response.json();
    },
    onSuccess: () => {
      // 投稿の詳細を再取得
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts', comment.postId, 'comments'] });
      toast({
        title: "いいねを送信しました！",
        description: "コメントにいいねを追加しました。",
      });
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `いいねの登録に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 2chスタイルのコメント表示
  return (
    <div className="mb-1 pl-6 border-l-4 border-gray-200">
      <div className="text-xs font-mono">
        <span className="text-gray-600 dark:text-gray-400 font-bold mr-2">#{comment.id}</span>
        <span className="font-bold mr-1">{comment.author}</span>
        <span className="text-gray-600 dark:text-gray-400">ID:{comment.authorId.substring(0, 8)}</span>
        <RoleBadge role={userRole} />
        <span className="ml-2 text-gray-500">{formattedDate}</span>
        <button 
          onClick={() => commentLikeMutation.mutate(comment.id)}
          className="ml-2 text-xs text-gray-500 hover:underline"
        >
          {comment.likes}いいね
        </button>
      </div>
      <div className="whitespace-pre-line mt-1 font-mono text-sm">
        {comment.content}
      </div>
    </div>
  );
}

// コメント投稿フォーム
function CommentForm({ postId }: { postId: number }) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [userName, setUserName] = useState("");
  const [seed, setSeed] = useState("");

  // ユーザー情報の取得
  useEffect(() => {
    const storedUserName = DataManager.getData("userName");
    const storedSeed = DataManager.getData("userSeed");
    
    if (storedUserName) setUserName(storedUserName);
    if (storedSeed) setSeed(storedSeed);
  }, []);

  // Seedから一意のユーザーIDを生成する
  const generateUserIdFromSeed = (seed: string): string => {
    return generateBase64Id(seed, 8); // 8桁の64進数IDを生成
  };

  // コメント投稿ミューテーション
  const commentMutation = useMutation({
    mutationFn: async (data: { postId: number; content: string; author: string; authorId: string }) => {
      const response = await fetch('/api/board/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      // バンされている場合の処理
      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.banned) {
          throw new Error(errorData.error || "あなたは管理者によって掲示板へのアクセスを禁止されています");
        }
      }
      
      if (!response.ok) {
        throw new Error('コメント投稿に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setContent("");
      // 投稿の詳細を再取得
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts', postId, 'comments'] });
      toast({
        title: "コメントを投稿しました！",
        description: "コメントが追加されました。",
      });
      
      // WebSocketが自動的に更新してくれるため、ポーリングは不要になりました
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `コメント投稿に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // コメント投稿ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userName.trim() || !seed.trim() || !content.trim()) {
      toast({
        title: "入力エラー",
        description: "名前、Seed、コメント内容をすべて入力してください。",
        variant: "destructive",
      });
      return;
    }
    
    // ユーザー情報を保存
    if (userName.trim()) {
      DataManager.saveData("userName", userName, 365); // 1年間保持
    }
    
    if (seed.trim()) {
      DataManager.saveData("userSeed", seed, 365); // 1年間保持
      DataManager.saveData("userId", generateUserIdFromSeed(seed), 365);
    }
    
    // ユーザーIDを生成
    const userId = generateUserIdFromSeed(seed);
    
    commentMutation.mutate({
      postId,
      content,
      author: userName,
      authorId: userId,
    });
  };

  // 2chスタイルのコメントフォーム
  return (
    <form onSubmit={handleSubmit} className="my-3 border-t border-gray-200 pt-3">
      <div className="text-xs font-bold bg-blue-50 dark:bg-blue-900/20 p-1 mb-2 border-b border-blue-100">
        この投稿に返信する
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
        <div>
          <label className="block mb-1 font-mono text-xs">名前:</label>
          <input
            type="text"
            placeholder="名無しさん"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block mb-1 font-mono text-xs">Seed:</label>
          <input
            type="password"
            placeholder="ID生成用"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm"
          />
        </div>
      </div>
      
      <textarea
        placeholder="返信内容を入力..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm mb-2"
      />
      
      <div className="text-center">
        <button 
          type="submit" 
          disabled={commentMutation.isPending || !userName.trim() || !seed.trim() || !content.trim()}
          className="px-4 py-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 border border-blue-300 dark:border-blue-700 font-mono text-sm"
        >
          {commentMutation.isPending ? "送信中..." : "返信する"}
        </button>
      </div>
    </form>
  );
}

// 新規投稿フォーム
function NewPostForm() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [userName, setUserName] = useState("");
  const [seed, setSeed] = useState("");
  
  // ユーザー情報の取得
  useEffect(() => {
    const storedUserName = DataManager.getData("userName");
    const storedSeed = DataManager.getData("userSeed");
    
    if (storedUserName) setUserName(storedUserName);
    if (storedSeed) setSeed(storedSeed);
  }, []);

  // ユーザー情報を保存
  const saveUserInfo = () => {
    if (userName.trim()) {
      DataManager.saveData("userName", userName, 365); // 1年間保持
    }
    
    if (seed.trim()) {
      DataManager.saveData("userSeed", seed, 365); // 1年間保持
      DataManager.saveData("userId", generateUserIdFromSeed(seed), 365);
    }
  };

  // Seedから一意のユーザーIDを生成する
  const generateUserIdFromSeed = (seed: string): string => {
    return generateBase64Id(seed, 8); // 8桁の64進数IDを生成
  };

  // 投稿ミューテーション
  const postMutation = useMutation({
    mutationFn: async (data: { content: string; author: string; authorId: string; title: string }) => {
      const response = await fetch('/api/board/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      // バンされている場合の処理
      if (response.status === 403) {
        const errorData = await response.json();
        if (errorData.banned) {
          throw new Error(errorData.error || "あなたは管理者によって掲示板へのアクセスを禁止されています");
        }
      }
      
      if (!response.ok) {
        throw new Error('投稿に失敗しました');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setContent("");
      // 投稿一覧を再取得してすぐに反映
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts'] });
      toast({
        title: "投稿しました！",
        description: "新しい投稿が追加されました。",
      });
      
      // WebSocketが自動的に更新してくれるため、ポーリングは不要になりました
    },
    onError: (error) => {
      toast({
        title: "エラー",
        description: `投稿に失敗しました: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // 投稿ハンドラー
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userName.trim() || !seed.trim() || !content.trim()) {
      toast({
        title: "入力エラー",
        description: "名前、Seed、投稿内容を入力してください。",
        variant: "destructive",
      });
      return;
    }
    
    // ユーザー情報を保存
    saveUserInfo();
    
    // ユーザーIDを生成
    const userId = generateUserIdFromSeed(seed);
    
    // 投稿内容の先頭部分をタイトルとして使用（必須のため）
    const titleFromContent = content.split('\n')[0].substring(0, 50); // 最初の行を50文字まで
    
    postMutation.mutate({
      content,
      author: userName,
      authorId: userId,
      title: titleFromContent || "無題の投稿" // 内容がない場合はデフォルトタイトル
    });
  };

  // 2chスタイルのフォーム
  return (
    <div className="mb-6 p-2 border border-gray-300 bg-gray-50 dark:bg-gray-800/50">
      <div className="mb-2 font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-1 border-b border-green-200 dark:border-green-900">
        ■ 新規投稿作成
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-2 grid-cols-2 text-sm">
          <div>
            <label className="block mb-1 font-mono">名前:</label>
            <input
              type="text"
              placeholder="名無しさん"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block mb-1 font-mono">Seed(ID生成用):</label>
            <input
              type="password"
              placeholder="同じSeedで同じIDになる"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm"
            />
          </div>
        </div>
        
        <div>
          <label className="block mb-1 font-mono text-sm">本文:</label>
          <textarea
            placeholder="内容を入力してください"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full p-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 font-mono text-sm"
          />
        </div>
        
        <div className="text-center">
          <button 
            type="submit" 
            disabled={postMutation.isPending || !userName.trim() || !seed.trim() || !content.trim()}
            className="px-4 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 border border-green-300 dark:border-green-700 font-mono text-sm"
          >
            {postMutation.isPending ? "書き込み中..." : "書き込む"}
          </button>
        </div>
      </form>
    </div>
  );
}

// 掲示板タブメインコンポーネント
export function BoardTab() {
  // 投稿リストの状態管理用（ページネーション用）
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const [selectedPost, setSelectedPost] = useState<number | null>(null);

  // BANリストを取得する
  const userId = DataManager.getData("userId");
  const { data: bansData } = useQuery<{ success: boolean, banned: boolean }>({
    queryKey: ['/api/bans/check', userId],
    queryFn: async () => {
      if (!userId) return { success: false, banned: false };
      const response = await fetch(`/api/bans/check/${userId}`);
      return response.json();
    },
    refetchInterval: 5000, // 5秒ごとにBANリストをチェック
    enabled: !!userId,
  });
  
  // BANされているかチェック
  useEffect(() => {
    const userIdForBan = DataManager.getData("userId");
    // BANされているかチェック
    if (bansData?.banned === true) {
      // BANされている場合はアクセス制限
      console.log("このユーザーはBANされています:", userIdForBan);
      
      // BANメッセージを表示
      const banMessage = document.createElement('div');
      banMessage.style.position = 'fixed';
      banMessage.style.top = '0';
      banMessage.style.left = '0';
      banMessage.style.width = '100%';
      banMessage.style.height = '100%';
      banMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      banMessage.style.color = 'white';
      banMessage.style.display = 'flex';
      banMessage.style.flexDirection = 'column';
      banMessage.style.justifyContent = 'center';
      banMessage.style.alignItems = 'center';
      banMessage.style.zIndex = '9999';
      banMessage.style.padding = '20px';
      banMessage.style.textAlign = 'center';
      
      const title = document.createElement('h1');
      title.textContent = 'アクセス制限されています';
      title.style.fontSize = '24px';
      title.style.marginBottom = '20px';
      
      const message = document.createElement('p');
      message.textContent = 'あなたのアカウントは管理者によってアクセス制限されました。';
      message.style.marginBottom = '10px';
      
      banMessage.appendChild(title);
      banMessage.appendChild(message);
      
      document.body.appendChild(banMessage);
    }
  }, [bansData]);

  // 定期的に投稿を更新するための設定
  useEffect(() => {
    // 2秒ごとに投稿一覧を更新
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/board/posts', offset, limit] });
      
      // 選択されている投稿のコメントも更新
      if (selectedPost) {
        queryClient.invalidateQueries({ queryKey: ['/api/board/posts', selectedPost, 'comments'] });
      }
    }, 2000);
    
    // コンポーネントのアンマウント時にインターバルをクリア
    return () => clearInterval(interval);
  }, [offset, limit, selectedPost]);
  return (
    <div>
      <div className="mb-6 font-mono">
        <div className="bg-gray-100 dark:bg-gray-800 p-3 border border-gray-300 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-green-700 dark:text-green-400">sui掲示板</h1>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 border-t border-gray-300 dark:border-gray-700 pt-2">
            <p>誰でも自由に書き込める掲示板です。</p>
            <p>学校での出来事、趣味の話、勉強のことなど、何でも気軽に投稿できます。</p>
            <p>名前とSeedを入力するだけで利用できます。同じSeedを使うと同じIDになります。</p>
          </div>
        </div>
      </div>
      
      <NewPostForm />
      <PostList />
    </div>
  );
}