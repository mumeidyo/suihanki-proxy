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
        <h2 className="text-2xl font-bold mb-4">みんなの投稿</h2>
        <div className="grid gap-4">
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
            <Card className="p-6 text-center">
              <p>まだ投稿はありません。最初の投稿をしてみましょう！</p>
            </Card>
          )}
        </div>
        
        {/* ページネーション */}
        <div className="flex justify-between mt-4">
          <Button
            variant="outline"
            onClick={loadPreviousPosts}
            disabled={offset === 0}
          >
            前のページ
          </Button>
          <Button
            variant="outline"
            onClick={loadMorePosts}
            disabled={!posts || posts.length < limit}
          >
            次のページ
          </Button>
        </div>
      </div>

      {/* 選択した投稿のコメント表示 */}
      {selectedPost && (
        <div className="mt-6 mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h3 className="text-xl font-bold mb-3">コメント</h3>
          
          {isCommentsLoading ? (
            <p>コメントを読み込み中...</p>
          ) : comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment: Comment) => (
                <CommentItem key={comment.id} comment={comment} />
              ))}
            </div>
          ) : (
            <p>まだコメントはありません。最初のコメントを投稿しましょう！</p>
          )}
          
          <div className="mt-4">
            <CommentForm postId={selectedPost} />
          </div>
        </div>
      )}
    </div>
  );
}

// 投稿カードコンポーネント
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
  // 状態として役割を管理（更新時に再レンダリングさせるため）
  const [userRole, setUserRole] = useState(roleManager.getUserRole(post.authorId));
  
  // 権限変更イベントのハンドラー
  const handleRoleChanged = (data: any) => {
    console.log("投稿カード - 権限変更イベント受信:", data, "このポストの作者ID:", post.authorId.substring(0, 8));
    // 変更されたユーザーIDがこの投稿の作者と一致する場合に更新
    if (data.id === post.authorId.substring(0, 8)) {
      console.log("投稿カード - 権限を更新:", data.role);
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
  }, [post.authorId]);
  
  // 日付をフォーマット
  const formattedDate = formatDistanceToNow(new Date(post.createdAt), { 
    addSuffix: true,
    locale: ja
  });

  return (
    <Card className={`overflow-hidden transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center text-sm">
          <User className="h-3 w-3 mr-1" />
          {post.author}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  ID:{post.authorId.substring(0, 8)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>ユーザー固有ID (Seedから自動生成)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-2">
            <RoleBadge role={userRole} />
          </span>
          <Clock className="h-3 w-3 ml-3 mr-1" />
          {formattedDate}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <p className="whitespace-pre-line">{post.content}</p>
        {post.imageUrl && (
          <div className="mt-3">
            <img 
              src={post.imageUrl} 
              alt="投稿画像" 
              className="max-w-full h-auto rounded" 
            />
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onLike} className="text-gray-500">
          <ThumbsUp className="h-4 w-4 mr-1" />
          {post.likes} いいね
        </Button>
        <Button variant="ghost" size="sm" onClick={onSelect} className="text-gray-500">
          <MessageSquare className="h-4 w-4 mr-1" />
          コメント
        </Button>
      </CardFooter>
    </Card>
  );
}

// コメントアイテムコンポーネント
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

  return (
    <div className="p-3 bg-white dark:bg-gray-900 rounded-lg">
      <div className="flex justify-between items-start">
        <div className="text-sm font-medium flex items-center">
          <User className="h-3 w-3 mr-1" />
          {comment.author}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="ml-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  ID:{comment.authorId.substring(0, 8)}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>ユーザー固有ID (Seedから自動生成)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-2">
            <RoleBadge role={userRole} />
          </span>
          <Clock className="h-3 w-3 ml-3 mr-1" />
          {formattedDate}
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-xs text-gray-500"
          onClick={() => commentLikeMutation.mutate(comment.id)}
        >
          <ThumbsUp className="h-3 w-3 mr-1" />
          {comment.likes}
        </Button>
      </div>
      
      <p className="mt-1 whitespace-pre-line">{comment.content}</p>
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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <Input
            placeholder="名前"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Seed（同じ値を使用）"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-full"
          />
          <p className="text-xs text-gray-500 mt-1">※投稿と同じSeedを使用</p>
        </div>
      </div>
      
      <Textarea
        placeholder="コメントを入力してください..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[100px]"
      />
      
      <Button 
        type="submit" 
        disabled={commentMutation.isPending || !userName.trim() || !seed.trim() || !content.trim()}
        className="w-full"
      >
        {commentMutation.isPending ? "送信中..." : "コメントを投稿"}
      </Button>
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

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>sui掲示板に投稿する</CardTitle>
        <CardDescription>
          学校のこと、趣味、好きな音楽など、自由に書き込みができます。名前とSeedは必ず入力してください。
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">名前</label>
              <Input
                placeholder="あなたの名前"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Seed（いつも同じ値を使用）</label>
              <Input
                type="password"
                placeholder="次回も同じ値を入力"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-gray-500">※同じSeedを使うと同じ人物として認識されます</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">投稿内容</label>
            <Textarea
              placeholder="投稿内容を入力してください..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[150px]"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={postMutation.isPending || !userName.trim() || !seed.trim() || !content.trim()}
          >
            {postMutation.isPending ? "投稿中..." : "投稿する"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold">sui掲示板</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          誰でも自由に書き込める掲示板です。学校での出来事、趣味の話、勉強のことなど、何でも気軽に投稿してください。名前とSeedを入力するだけで利用できます。
        </p>
      </div>
      
      <NewPostForm />
      <PostList />
    </div>
  );
}