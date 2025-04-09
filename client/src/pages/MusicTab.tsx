import { useState, FormEvent, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SearchBar from "@/components/SearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MusicIcon, Download, PlayCircle, TrendingUp, Search, Heart, 
  Share2, ListMusic, MoreHorizontal, Clock, Music2, Headphones,
  Plus, CheckCircle, Save, Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import MusicPlayer from "@/components/MusicPlayer";
import { MusicTrack } from "@/types/music";
import { 
  getFavorites, 
  addToFavorites, 
  removeFromFavorites, 
  isInFavorites,
  getPlaylists,
  createPlaylist,
  addTrackToPlaylist,
  Playlist
} from "@/lib/localStorageUtils";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// 音楽カードコンポーネント
interface MusicCardProps {
  track: MusicTrack;
  onPlay: (track: MusicTrack) => void;
  onDownload: (track: MusicTrack) => void;
  formatDuration: (duration: string) => string;
  index: number;
  onAddToFavorites?: (track: MusicTrack) => void;
  onRemoveFromFavorites?: (trackId: string) => void;
  onAddToPlaylist?: (track: MusicTrack, playlistId: string) => void;
  isFavorite?: boolean;
  playlists?: Playlist[];
}

const MusicCard = ({ 
  track, 
  onPlay, 
  onDownload, 
  formatDuration, 
  index,
  onAddToFavorites,
  onRemoveFromFavorites,
  onAddToPlaylist,
  isFavorite = false,
  playlists = []
}: MusicCardProps) => {
  // アニメーション用の遅延を計算
  const delay = 0.05 * (index % 10); // 最大10個までの遅延を適用
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="overflow-hidden hover:shadow-lg dark:hover:shadow-xl transition-shadow duration-300 group relative dark:border-border">
        {/* お気に入りアイコン */}
        {isFavorite && (
          <div className="absolute top-2 right-2 z-10">
            <Badge variant="default" className="bg-red-600 dark:bg-red-700">
              <Heart className="h-3 w-3 mr-1 fill-white" />
              お気に入り
            </Badge>
          </div>
        )}
        
        <div 
          className="aspect-w-16 aspect-h-9 w-full relative cursor-pointer" 
          onClick={() => onPlay(track)}
        >
          <img 
            src={track.thumbnailUrl && track.thumbnailUrl.startsWith('http') 
              ? `/api/proxy/direct?url=${encodeURIComponent(track.thumbnailUrl)}` 
              : (track.thumbnailUrl || 'https://placehold.co/400x400?text=No+Image')} 
            alt={track.title}
            className="object-cover w-full h-48" 
          />
          <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-white dark:bg-gray-800 text-black dark:text-white flex items-center justify-center">
              <PlayCircle className="h-8 w-8 text-green-600 dark:text-green-500" />
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-0 hover:opacity-100">
            <div className="h-16 w-16 rounded-full bg-white dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 flex items-center justify-center">
              <PlayCircle className="h-12 w-12 text-green-600 dark:text-green-500" />
            </div>
          </div>
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="bg-black bg-opacity-70 text-white">
              {formatDuration(track.duration)}
            </Badge>
          </div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-0">
            <PlayCircle className="h-16 w-16 text-white" />
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                    <Music2 className="h-3 w-3" />
                    <span>YouTube Music</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>YouTube Musicから取得した曲です</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onPlay(track)}>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  <span>再生</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownload(track)}>
                  <Download className="mr-2 h-4 w-4" />
                  <span>MP3としてダウンロード</span>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                
                {/* お気に入り機能 */}
                {isFavorite ? (
                  <DropdownMenuItem 
                    onClick={() => onRemoveFromFavorites && onRemoveFromFavorites(track.id)}
                    className="text-red-600"
                  >
                    <Heart className="mr-2 h-4 w-4 fill-red-600" />
                    <span>お気に入りから削除</span>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onAddToFavorites && onAddToFavorites(track)}>
                    <Heart className="mr-2 h-4 w-4" />
                    <span>お気に入りに追加</span>
                  </DropdownMenuItem>
                )}
                
                {/* プレイリスト追加機能 */}
                {playlists.length > 0 && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ListMusic className="mr-2 h-4 w-4" />
                      <span>プレイリストに追加</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {playlists.map(playlist => (
                          <DropdownMenuItem 
                            key={playlist.id}
                            onClick={() => onAddToPlaylist && onAddToPlaylist(track, playlist.id)}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            <span>{playlist.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
                
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${track.title} - ${track.artist}`)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  <span>曲情報をコピー</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <h3 className="font-semibold text-lg line-clamp-1 mt-2" title={track.title}>
            {track.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-1" title={track.artist}>
            {track.artist}
          </p>
          {track.album && (
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1 line-clamp-1" title={track.album}>
              <ListMusic className="h-3 w-3 inline mr-1" />
              {track.album}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-4">
            <Button 
              size="sm" 
              variant="default"
              className="w-full gap-2"
              onClick={() => onPlay(track)}
            >
              <Headphones className="h-4 w-4" />
              今すぐ聴く
            </Button>
            
            <Button 
              size="sm"
              variant="outline"
              className="ml-2"
              onClick={() => onDownload(track)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

// 型定義はimportで読み込むようになりました

export default function MusicTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<'search' | 'popular' | 'favorites'>('popular');
  const { toast } = useToast();
  
  // お気に入りとプレイリストの状態
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistName, setPlaylistName] = useState("");
  const [showCreatePlaylistDialog, setShowCreatePlaylistDialog] = useState(false);
  
  // ローカルストレージからデータをロード
  useEffect(() => {
    setFavorites(getFavorites());
    setPlaylists(getPlaylists());
  }, []);

  // 検索結果を取得するクエリ
  const { data: searchResults, isLoading: isSearchLoading, error: searchError } = useQuery({
    queryKey: ['music-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return { tracks: [] };
      
      try {
        const response = await fetch(`/api/music/search?query=${encodeURIComponent(searchQuery)}&source=youtube_music`);
        if (!response.ok) {
          throw new Error(`Search failed: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error("検索エラー:", error);
        toast({
          title: "検索エラー",
          description: "曲の検索中にエラーが発生しました。もう一度お試しください。",
          variant: "destructive"
        });
        return { tracks: [] };
      }
    },
    enabled: !!searchQuery,
  });

  // 人気の曲を取得するクエリ
  const { data: popularTracks, isLoading: isPopularLoading, error: popularError } = useQuery({
    queryKey: ['music-popular'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/music/popular?source=youtube_music');
        if (!response.ok) {
          throw new Error(`Popular tracks fetch failed: ${response.statusText}`);
        }
        return await response.json();
      } catch (error) {
        console.error("人気曲の取得エラー:", error);
        toast({
          title: "読み込みエラー",
          description: "人気曲の取得中にエラーが発生しました。",
          variant: "destructive"
        });
        return { tracks: [] };
      }
    },
  });

  // 検索処理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query) {
      setActiveTab('search');
    }
  };

  // YouTube Music APIに完全に特化したアプリケーション

  // ダウンロードを処理するための関数
  const handleDownload = async (track: MusicTrack) => {
    try {
      toast({
        title: "ダウンロードを準備中",
        description: "YouTube Musicからトラック情報を取得しています..."
      });
      
      // YouTube Music用エンドポイントを使用
      window.location.href = `/api/youtube-music/download?trackId=${track.id}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`;
    } catch (error) {
      console.error("ダウンロードエラー:", error);
      toast({
        title: "ダウンロードエラー",
        description: "曲のダウンロード中にエラーが発生しました。",
        variant: "destructive"
      });
    }
  };

  // 再生中の曲と再生リストを保持するための状態
  const [currentlyPlaying, setCurrentlyPlaying] = useState<MusicTrack | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<MusicTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaylistMode, setIsPlaylistMode] = useState<boolean>(false);
  
  // 再生を処理するための関数
  const handlePlay = async (track: MusicTrack, playlist?: MusicTrack[], startIndex?: number) => {
    try {
      toast({
        title: "再生の準備中",
        description: "音楽を準備しています..."
      });
      
      // プレイリストの設定
      let selectedPlaylist: MusicTrack[] = [];
      let trackIndex = 0;
      
      // 検索結果が存在する場合、それを再生リストとして使用
      if (activeTab === 'search' && searchResults?.tracks?.length > 0) {
        selectedPlaylist = searchResults.tracks;
        trackIndex = selectedPlaylist.findIndex(t => t.id === track.id);
        if (trackIndex === -1) trackIndex = 0;
        setIsPlaylistMode(true);
      }
      // 人気の曲タブが表示されている場合、それを再生リストとして使用
      else if (activeTab === 'popular' && popularTracks?.tracks?.length > 0) {
        selectedPlaylist = popularTracks.tracks;
        trackIndex = selectedPlaylist.findIndex(t => t.id === track.id);
        if (trackIndex === -1) trackIndex = 0;
        setIsPlaylistMode(true);
      }
      // お気に入りタブが表示されている場合、それを再生リストとして使用
      else if (activeTab === 'favorites' && favorites.length > 0) {
        selectedPlaylist = favorites;
        trackIndex = selectedPlaylist.findIndex(t => t.id === track.id);
        if (trackIndex === -1) trackIndex = 0;
        setIsPlaylistMode(true);
      }
      // 明示的にプレイリストが指定された場合はそれを使用
      else if (playlist && playlist.length > 0) {
        selectedPlaylist = playlist;
        trackIndex = startIndex !== undefined ? startIndex : 0;
        setIsPlaylistMode(true);
      }
      // それ以外の場合は単曲再生モード
      else {
        selectedPlaylist = [track];
        trackIndex = 0;
        setIsPlaylistMode(false);
      }
      
      // 現在のプレイリストと曲インデックスを設定
      setCurrentPlaylist(selectedPlaylist);
      setCurrentTrackIndex(trackIndex);
      
      // 現在再生中の曲を設定
      setCurrentlyPlaying(selectedPlaylist[trackIndex]);
      
      console.log(`再生モード: ${isPlaylistMode ? 'プレイリスト' : '単曲'}, 合計${selectedPlaylist.length}曲, 現在${trackIndex + 1}曲目`);
    } catch (error) {
      console.error("再生エラー:", error);
      toast({
        title: "再生エラー",
        description: "曲の再生中にエラーが発生しました。",
        variant: "destructive"
      });
    }
  };
  
  // 次の曲を再生
  const playNextTrack = () => {
    if (!isPlaylistMode || !currentPlaylist || currentTrackIndex === -1) return;
    
    // 次のインデックスを計算（最後の曲だったら最初に戻る）
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    setCurrentTrackIndex(nextIndex);
    setCurrentlyPlaying(currentPlaylist[nextIndex]);
    toast({
      title: "次の曲を再生中",
      description: `"${currentPlaylist[nextIndex].title}" を再生します`
    });
  };
  
  // 前の曲を再生
  const playPrevTrack = () => {
    if (!isPlaylistMode || !currentPlaylist || currentTrackIndex === -1) return;
    
    // 前のインデックスを計算（最初の曲だったら最後に戻る）
    const prevIndex = currentTrackIndex === 0 ? currentPlaylist.length - 1 : currentTrackIndex - 1;
    setCurrentTrackIndex(prevIndex);
    setCurrentlyPlaying(currentPlaylist[prevIndex]);
    toast({
      title: "前の曲を再生中",
      description: `"${currentPlaylist[prevIndex].title}" を再生します`
    });
  };

  // フォーマット関数
  const formatDuration = (duration: string) => {
    // 秒数表示の場合
    if (!isNaN(Number(duration))) {
      const seconds = parseInt(duration);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    // "mm:ss"形式の場合はそのまま返す
    return duration;
  };

  // 最近検索された曲のリファレンス（UI改善のため）
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // 検索時にスムーズにスクロール
  useEffect(() => {
    if (activeTab === 'search' && searchResults?.tracks?.length > 0 && !isSearchLoading) {
      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
    }
  }, [searchResults, isSearchLoading, activeTab]);
  
  // お気に入り機能
  const handleAddToFavorites = (track: MusicTrack) => {
    const updatedFavorites = addToFavorites(track);
    setFavorites(updatedFavorites);
    toast({
      title: "お気に入りに追加しました",
      description: `「${track.title}」をお気に入りに追加しました`,
    });
  };
  
  const handleRemoveFromFavorites = (trackId: string) => {
    const updatedFavorites = removeFromFavorites(trackId);
    setFavorites(updatedFavorites);
    toast({
      title: "お気に入りから削除しました",
      description: "曲をお気に入りから削除しました",
    });
  };
  
  // プレイリスト機能
  const handleCreatePlaylist = () => {
    if (!playlistName.trim()) {
      toast({
        title: "プレイリスト名を入力してください",
        variant: "destructive",
      });
      return;
    }
    
    const updatedPlaylists = createPlaylist(playlistName);
    setPlaylists(updatedPlaylists);
    setPlaylistName("");
    setShowCreatePlaylistDialog(false);
    
    toast({
      title: "プレイリストを作成しました",
      description: `「${playlistName}」プレイリストを作成しました`,
    });
  };
  
  const handleAddToPlaylist = (track: MusicTrack, playlistId: string) => {
    const updatedPlaylists = addTrackToPlaylist(playlistId, track);
    setPlaylists(updatedPlaylists);
    
    // プレイリスト名を取得
    const playlist = playlists.find(p => p.id === playlistId);
    
    toast({
      title: "プレイリストに追加しました",
      description: `「${track.title}」を「${playlist?.name || 'プレイリスト'}」に追加しました`,
    });
  };
  
  // 曲がお気に入りに入っているかチェック
  const checkIfFavorite = (trackId: string): boolean => {
    return isInFavorites(trackId);
  };
  
  // 次の曲があるかどうかをチェック
  const hasNextTrack = (): boolean => {
    if (!currentPlaylist || currentPlaylist.length === 0) return false;
    // 現在の曲が最後の曲でない場合はtrueを返す（プレイリストの最後の曲でも、ループする設計なのでtrue）
    return currentPlaylist.length > 1;
  };
  
  // 前の曲があるかどうかをチェック
  const hasPrevTrack = (): boolean => {
    if (!currentPlaylist || currentPlaylist.length === 0) return false;
    // 現在の曲が最初の曲でない場合はtrueを返す（プレイリストの最初の曲でも、ループする設計なのでtrue）
    return currentPlaylist.length > 1;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gradient-to-b from-white dark:from-gray-900 to-gray-50 dark:to-gray-950 rounded-xl shadow-sm dark:shadow-md space-y-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-3">
          <span className="text-red-600 dark:text-red-500">sui-han-ki</span> Music player
        </h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          このタブはyoutube viwerを曲を聴くために特化させた改良版です。高品質な音楽体験をお楽しみください。
        </p>
      </motion.div>

      {/* メインコンテンツエリア */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* サイドバー */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-1 space-y-6"
        >
          {/* 検索バーと機能セレクタ */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm dark:shadow-md border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-lg mb-4 flex items-center dark:text-gray-100">
              <Search className="h-5 w-5 mr-2 text-green-600 dark:text-green-500" />
              音楽を検索
            </h3>
            
            <SearchBar 
              onSearch={handleSearch}
              placeholder="アーティスト名や曲名を入力..."
              buttonText="検索"
              icon={<MusicIcon className="h-4 w-4" />}
            />
            
            <div className="mt-4">
              <div className="flex flex-col space-y-2">
                <Button
                  variant={activeTab === 'popular' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('popular')}
                  className="justify-start"
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  人気の曲
                </Button>
                <Button
                  variant={activeTab === 'search' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('search')}
                  className="justify-start"
                  disabled={!searchQuery}
                >
                  <Search className="h-4 w-4 mr-2" />
                  検索結果を表示
                </Button>
                <Button
                  variant={activeTab === 'favorites' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('favorites')}
                  className="justify-start"
                >
                  <Heart className="h-4 w-4 mr-2" />
                  お気に入り
                </Button>
              </div>
            </div>
          </div>
          
          {/* お気に入りとプレイリスト管理 */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm dark:shadow-md border border-gray-100 dark:border-gray-700">
            <div className="collection-header mb-3">
              <div className="font-semibold text-lg flex items-center sidebar-collection">
                <Heart className="h-5 w-5 mr-2 text-red-600 dark:text-red-500 flex-shrink-0" />
                <p className="collection-text m-0 p-0 dark:text-gray-100" style={{display: 'inline-block', textAlign: 'left'}}>コレクション</p>
              </div>
              <Dialog open={showCreatePlaylistDialog} onOpenChange={setShowCreatePlaylistDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex gap-1">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">新規プレイリスト</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新しいプレイリストを作成</DialogTitle>
                    <DialogDescription>
                      プレイリスト名を入力してください。作成後、お好きな曲を追加できます。
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="プレイリスト名を入力..."
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreatePlaylistDialog(false)}>キャンセル</Button>
                    <Button onClick={handleCreatePlaylist}>作成</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* お気に入りカウント */}
            <div className="mb-3">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between"
                onClick={() => setActiveTab('favorites')}
              >
                <div className="flex items-center">
                  <Heart className={`h-4 w-4 mr-2 ${favorites.length > 0 ? 'fill-red-600 text-red-600' : ''}`} />
                  <span>お気に入り</span>
                </div>
                <Badge variant="outline" className="ml-2">
                  {favorites.length}曲
                </Badge>
              </Button>
            </div>
            
            {/* プレイリスト一覧 */}
            {playlists.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-gray-500 mb-2">プレイリスト</p>
                {playlists.map(playlist => (
                  <Button 
                    key={playlist.id} 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-between"
                    onClick={() => {/* プレイリスト表示機能を実装予定 */}}
                  >
                    <div className="flex items-center overflow-hidden">
                      <ListMusic className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{playlist.name}</span>
                    </div>
                    <Badge variant="outline" className="ml-2 flex-shrink-0">
                      {playlist.tracks.length}曲
                    </Badge>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center my-2">
                プレイリストはまだありません。<br />
                「新規プレイリスト」から作成できます。
              </p>
            )}
          </div>
          
          {/* 使い方ガイド */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm dark:shadow-md border border-gray-100 dark:border-gray-700">
            <h3 className="font-semibold text-lg mb-3 flex items-center dark:text-gray-100">
              <Headphones className="h-5 w-5 mr-2 text-green-600 dark:text-green-500" />
              使い方ガイド
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex items-start">
                <Search className="h-4 w-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-400" />
                <span>アーティスト名や曲名で検索</span>
              </li>
              <li className="flex items-start">
                <PlayCircle className="h-4 w-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-400" />
                <span>曲をクリックして再生</span>
              </li>
              <li className="flex items-start">
                <Heart className="h-4 w-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-400" />
                <span>お気に入りに追加して保存</span>
              </li>
              <li className="flex items-start">
                <ListMusic className="h-4 w-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-400" />
                <span>プレイリストを作成・管理</span>
              </li>
              <li className="flex items-start">
                <Download className="h-4 w-4 mr-2 mt-0.5 text-gray-400 dark:text-gray-400" />
                <span>ダウンロードボタンでMP3保存</span>
              </li>
            </ul>
          </div>
        </motion.div>
        
        {/* メインコンテンツ */}
        <div className="lg:col-span-3" ref={scrollRef}>
          {/* タイトルエリア */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-5 flex justify-between items-center"
          >
            <h2 className="text-xl font-bold">
              {activeTab === 'search' 
                ? (searchQuery ? `「${searchQuery}」の検索結果` : '検索結果') 
                : activeTab === 'favorites'
                ? 'お気に入りの曲'
                : 'YouTube Musicで人気の曲'}
            </h2>
            
            {(activeTab === 'search' && searchResults?.tracks?.length > 0) || 
             (activeTab === 'popular' && popularTracks?.tracks?.length > 0) ||
             (activeTab === 'favorites' && favorites.length > 0) ? (
              <Badge variant="outline" className="px-2 py-1">
                {activeTab === 'search' 
                  ? `${searchResults?.tracks?.length || 0}曲` 
                  : activeTab === 'favorites'
                  ? `${favorites.length}曲`
                  : `${popularTracks?.tracks?.length || 0}曲`}
              </Badge>
            ) : null}
          </motion.div>

          {/* ローディング状態 */}
          {((activeTab === 'search' && isSearchLoading) || 
            (activeTab === 'popular' && isPopularLoading)) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-md p-12 border border-gray-100 dark:border-gray-700"
            >
              <div className="spinner-green"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
                {activeTab === 'search' ? '曲を検索中...' : '人気の曲を読み込み中...'}
              </p>
            </motion.div>
          )}

          {/* エラー表示 */}
          {((activeTab === 'search' && searchError) || 
            (activeTab === 'popular' && popularError)) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-100 rounded-xl p-8 text-center"
            >
              <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-red-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-red-800 mb-2">
                読み込みエラー
              </h3>
              <p className="text-red-600">
                {activeTab === 'search' 
                  ? '検索中にエラーが発生しました。もう一度お試しください。' 
                  : '人気曲の読み込み中にエラーが発生しました。'}
              </p>
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => window.location.reload()}
              >
                再読み込み
              </Button>
            </motion.div>
          )}

          {/* 検索結果なし */}
          {activeTab === 'search' && searchResults?.tracks && 
           searchResults.tracks.length === 0 && searchQuery && !isSearchLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-10 text-center"
            >
              <div className="bg-gray-50 dark:bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-gray-400 dark:text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
                検索結果が見つかりませんでした
              </h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                別のキーワードを試すか、スペルを確認してみてください。
              </p>
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => setActiveTab('popular')}
              >
                人気の曲を見る
              </Button>
            </motion.div>
          )}

          {/* 人気曲なし */}
          {activeTab === 'popular' && popularTracks?.tracks && 
           popularTracks.tracks.length === 0 && !isPopularLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-10 text-center"
            >
              <div className="bg-gray-50 dark:bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <MusicIcon className="h-6 w-6 text-gray-400 dark:text-gray-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
                現在人気の曲を取得できません
              </h3>
              <p className="text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                しばらくしてからお試しいただくか、曲を検索してみてください。
              </p>
            </motion.div>
          )}

          {/* 検索結果表示 */}
          {activeTab === 'search' && searchResults?.tracks && searchResults.tracks.length > 0 && (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.tracks.map((track: MusicTrack, index: number) => (
                <MusicCard 
                  key={`search-${track.source}-${track.id}`} 
                  track={track} 
                  onPlay={handlePlay} 
                  onDownload={handleDownload} 
                  formatDuration={formatDuration}
                  index={index}
                  onAddToFavorites={handleAddToFavorites}
                  onRemoveFromFavorites={handleRemoveFromFavorites}
                  onAddToPlaylist={handleAddToPlaylist}
                  isFavorite={checkIfFavorite(track.id)}
                  playlists={playlists}
                />
              ))}
            </div>
          )}

          {/* 人気曲表示 */}
          {activeTab === 'popular' && popularTracks?.tracks && popularTracks.tracks.length > 0 && (
            <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {popularTracks.tracks.map((track: MusicTrack, index: number) => (
                <MusicCard 
                  key={`popular-${track.source}-${track.id}`} 
                  track={track} 
                  onPlay={handlePlay} 
                  onDownload={handleDownload} 
                  formatDuration={formatDuration}
                  index={index}
                  onAddToFavorites={handleAddToFavorites}
                  onRemoveFromFavorites={handleRemoveFromFavorites}
                  onAddToPlaylist={handleAddToPlaylist}
                  isFavorite={checkIfFavorite(track.id)}
                  playlists={playlists}
                />
              ))}
            </div>
          )}
          
          {/* お気に入り表示 */}
          {activeTab === 'favorites' && (
            <>
              {favorites.length > 0 ? (
                <>
                  {/* お気に入り曲の連続再生ボタン */}
                  <div className="mb-5 flex justify-between items-center">
                    <Button 
                      onClick={() => {
                        if (favorites.length > 0) {
                          handlePlay(favorites[0], favorites, 0);
                          toast({
                            title: "お気に入りを連続再生します",
                            description: `${favorites.length}曲のプレイリストを再生します`,
                            duration: 3000,
                          });
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
                    >
                      <PlayCircle className="h-4 w-4" />
                      お気に入りを連続再生
                      <Badge variant="outline" className="ml-1 bg-red-500 text-white border-red-400">
                        {favorites.length}曲
                      </Badge>
                    </Button>
                    
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // ランダムな並び順で再生
                              if (favorites.length > 0) {
                                const shuffled = [...favorites].sort(() => Math.random() - 0.5);
                                handlePlay(shuffled[0], shuffled, 0);
                                toast({
                                  title: "シャッフル再生します",
                                  description: `${favorites.length}曲をランダムに再生します`,
                                  duration: 3000,
                                });
                              }
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                              <polyline points="16 3 21 3 21 8"></polyline>
                              <line x1="4" y1="20" x2="21" y2="3"></line>
                              <polyline points="21 16 21 21 16 21"></polyline>
                              <line x1="15" y1="15" x2="21" y2="21"></line>
                              <line x1="4" y1="4" x2="9" y2="9"></line>
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>シャッフル再生</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {favorites.map((track: MusicTrack, index: number) => (
                      <MusicCard 
                        key={`favorite-${track.source}-${track.id}`} 
                        track={track} 
                        onPlay={(track) => handlePlay(track, favorites, index)}
                        onDownload={handleDownload} 
                        formatDuration={formatDuration}
                        index={index}
                        onAddToFavorites={handleAddToFavorites}
                        onRemoveFromFavorites={handleRemoveFromFavorites}
                        onAddToPlaylist={handleAddToPlaylist}
                        isFavorite={true}
                        playlists={playlists}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-10 text-center"
                >
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Heart className="h-6 w-6 text-gray-400 dark:text-gray-300" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">
                    お気に入りがありません
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 max-w-sm mx-auto">
                    曲のメニューから「お気に入りに追加」を選択すると、ここに表示されます。
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={() => setActiveTab('popular')}
                  >
                    人気の曲を見る
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>

      {/* YouTube Musicスタイルプレーヤー */}
      {currentlyPlaying && (
        <MusicPlayer
          trackId={currentlyPlaying.id}
          title={currentlyPlaying.title}
          artist={currentlyPlaying.artist}
          thumbnailUrl={currentlyPlaying.thumbnailUrl}
          onClose={() => setCurrentlyPlaying(null)}
          onNext={isPlaylistMode && hasNextTrack() ? playNextTrack : undefined}
          onPrev={isPlaylistMode && hasPrevTrack() ? playPrevTrack : undefined}
          hasNext={isPlaylistMode && hasNextTrack()}
          hasPrev={isPlaylistMode && hasPrevTrack()}
        />
      )}
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="mt-8 text-center bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-md"
      >
        <p className="text-xs text-gray-500 dark:text-gray-400">
          注意: このアプリケーションはrender提供されています。  ダウンロードした音楽は個人使用のみに留め、著作権を尊重してください、何かあってもむめー,sui-han-kiは責任は負いません。
          powered by mumei
        </p>
      </motion.div>
    </div>
  );
}