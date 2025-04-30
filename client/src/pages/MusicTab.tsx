import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Music, Search, Heart, ListMusic, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import MusicPlayer from '@/components/MusicPlayer';
import { MusicTrack } from '@/types/music';
import { getFavorites, getPlaylists, Playlist } from '@/lib/localStorageUtils';
import { queryClient } from '@/lib/queryClient';

// グローバル型定義はtypes/music.tsに移動

export default function MusicTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<MusicTrack[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [trendingTracks, setTrendingTracks] = useState<MusicTrack[]>([]);
  const [isLoadingTrending, setIsLoadingTrending] = useState<boolean>(true);
  const { toast } = useToast();

  // 検索クエリの実行
  const { data: queryResults, isLoading, isError } = useQuery<{items?: any[]}>({
    queryKey: ['/api/youtube/search', searchQuery],
    // 200ms以上入力がなければリクエストする
    enabled: searchQuery.length > 2,
    // 検索パラメータの付与
    queryFn: async ({ queryKey }) => {
      if (!Array.isArray(queryKey) || queryKey.length < 2) {
        throw new Error('検索パラメータが不正です');
      }
      const path = String(queryKey[0]);
      const q = String(queryKey[1]);
      const response = await fetch(`${path}?q=${encodeURIComponent(q)}`);
      if (!response.ok) {
        throw new Error('検索リクエストに失敗しました');
      }
      return response.json();
    },
    // エラーハンドリング
    retry: 1,
    retryDelay: 1000,
  });

  // 検索結果をMusicTrack形式に変換して保存
  useEffect(() => {
    if (queryResults && queryResults.items && Array.isArray(queryResults.items)) {
      const formattedResults: MusicTrack[] = queryResults.items.map((item: any) => ({
        id: item.id?.videoId || item.id || `track_${Math.random().toString(36).substr(2, 9)}`,
        title: item.snippet?.title || '不明な曲',
        artist: item.snippet?.channelTitle || '不明なアーティスト',
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url || '',
        duration: item.contentDetails?.duration || '',
        source: 'youtube_music',
        sourceId: item.id?.videoId || item.id || ''
      }));
      setSearchResults(formattedResults);
    }
  }, [queryResults]);

  // お気に入りとプレイリストを読み込み
  useEffect(() => {
    setFavorites(getFavorites());
    setPlaylists(getPlaylists());
  }, []);
  
  // トレンド動画を読み込み
  useEffect(() => {
    const fetchTrendingVideos = async () => {
      try {
        setIsLoadingTrending(true);
        const response = await fetch('/api/youtube/popular');
        if (!response.ok) {
          throw new Error('トレンド動画の取得に失敗しました');
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          const formattedResults: MusicTrack[] = data.map((item: any) => ({
            id: item.id || item.id?.videoId || `track_${Math.random().toString(36).substr(2, 9)}`,
            title: item.snippet?.title || '不明な曲',
            artist: item.snippet?.channelTitle || '不明なアーティスト',
            thumbnailUrl: item.snippet?.thumbnails?.medium?.url || '',
            duration: item.contentDetails?.duration || '',
            source: 'youtube_music',
            sourceId: item.id || item.id?.videoId || ''
          }));
          setTrendingTracks(formattedResults);
        }
      } catch (error) {
        console.error('トレンド動画の取得に失敗:', error);
      } finally {
        setIsLoadingTrending(false);
      }
    };
    
    fetchTrendingVideos();
  }, []);

  // グローバルプレイリスト状態を更新
  const updateGlobalPlaylistState = (trackToPlay: MusicTrack, currentPlaylist: MusicTrack[]) => {
    // ウィンドウオブジェクトにプレイリスト情報を格納（先読み用）
    if (!window.musicPlayerState) {
      window.musicPlayerState = {};
    }
    
    // 現在のプレイリストを設定
    window.musicPlayerState.currentPlaylist = currentPlaylist;
    
    // 現在のインデックスを設定
    const currentIndex = currentPlaylist.findIndex(track => track.id === trackToPlay.id);
    window.musicPlayerState.currentIndex = currentIndex;
    
    console.log('Updated global playlist state:', {
      playlistLength: currentPlaylist.length,
      currentIndex,
      currentTrack: trackToPlay.title
    });
  };

  // トラックを再生
  const playTrack = (track: MusicTrack) => {
    console.log('Playing track:', track);
    
    // 現在のアクティブなタブに応じて再生リストを決定
    let currentPlaylist: MusicTrack[];
    const activeTab = document.querySelector('[role="tabpanel"][data-state="active"]')?.getAttribute('data-value');
    
    if (activeTab === 'search') {
      // 検索画面の場合、検索結果があればそれを、なければトレンドを使用
      if (searchResults.length > 0) {
        currentPlaylist = searchResults;
      } else if (trendingTracks.length > 0) {
        currentPlaylist = trendingTracks;
      } else {
        currentPlaylist = favorites;
      }
    } else if (activeTab === 'favorites' && favorites.length > 0) {
      currentPlaylist = favorites;
    } else if (activeTab === 'playlists') {
      // プレイリストタブの場合は、選択されているプレイリストの曲を使用
      const selectedPlaylistId = (document.querySelector('.selected-playlist') as HTMLElement)?.dataset.playlistId;
      const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
      currentPlaylist = selectedPlaylist?.tracks || (searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites);
    } else {
      // デフォルトは検索結果、なければトレンド、それもなければお気に入り
      currentPlaylist = searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites;
    }
    
    // グローバルプレイリスト状態を更新
    updateGlobalPlaylistState(track, currentPlaylist);
    
    // アクティブトラックを設定して再生
    setActiveTrack(track);
  };

  // プレーヤーを閉じる
  const closePlayer = () => {
    setActiveTrack(null);
  };

  // 次の曲を再生（グローバル状態から）
  const playNextTrack = () => {
    if (!activeTrack) return;
    
    // グローバル状態からプレイリスト情報を取得
    if (window.musicPlayerState?.currentPlaylist && 
        typeof window.musicPlayerState.currentIndex === 'number') {
      const playlist = window.musicPlayerState.currentPlaylist;
      const currentIndex = window.musicPlayerState.currentIndex;
      
      if (currentIndex < playlist.length - 1) {
        const nextTrack = playlist[currentIndex + 1];
        // 必須のプロパティが存在するか確認
        if (nextTrack && nextTrack.id && nextTrack.title && nextTrack.artist && 
            nextTrack.thumbnailUrl && nextTrack.duration && nextTrack.source && nextTrack.sourceId) {
          // 次の曲を再生
          playTrack(nextTrack as MusicTrack);
          return;
        }
      }
    }
    
    // フォールバック: グローバル状態が使えない場合は以前の方法で
    const currentList = searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites;
    const currentIndex = currentList.findIndex(track => track.id === activeTrack.id);
    
    if (currentIndex !== -1 && currentIndex < currentList.length - 1) {
      playTrack(currentList[currentIndex + 1]);
    }
  };

  // 前の曲を再生（グローバル状態から）
  const playPrevTrack = () => {
    if (!activeTrack) return;
    
    // グローバル状態からプレイリスト情報を取得
    if (window.musicPlayerState?.currentPlaylist && 
        typeof window.musicPlayerState.currentIndex === 'number') {
      const playlist = window.musicPlayerState.currentPlaylist;
      const currentIndex = window.musicPlayerState.currentIndex;
      
      if (currentIndex > 0) {
        const prevTrack = playlist[currentIndex - 1];
        // 必須のプロパティが存在するか確認
        if (prevTrack && prevTrack.id && prevTrack.title && prevTrack.artist && 
            prevTrack.thumbnailUrl && prevTrack.duration && prevTrack.source && prevTrack.sourceId) {
          // 前の曲を再生
          playTrack(prevTrack as MusicTrack);
          return;
        }
      }
    }
    
    // フォールバック: グローバル状態が使えない場合は以前の方法で
    const currentList = searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites;
    const currentIndex = currentList.findIndex(track => track.id === activeTrack.id);
    
    if (currentIndex > 0) {
      playTrack(currentList[currentIndex - 1]);
    }
  };

  // 次の曲があるかチェック（グローバル状態から）
  const hasNextTrack = () => {
    // グローバル状態からチェック
    if (window.musicPlayerState?.currentPlaylist && 
        typeof window.musicPlayerState.currentIndex === 'number') {
      return window.musicPlayerState.currentIndex < window.musicPlayerState.currentPlaylist.length - 1;
    }
    
    // フォールバック
    if (!activeTrack) return false;
    const currentList = searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites;
    const currentIndex = currentList.findIndex(track => track.id === activeTrack.id);
    return currentIndex !== -1 && currentIndex < currentList.length - 1;
  };
  
  // 前の曲があるかチェック（グローバル状態から）
  const hasPrevTrack = () => {
    // グローバル状態からチェック
    if (window.musicPlayerState?.currentPlaylist && 
        typeof window.musicPlayerState.currentIndex === 'number') {
      return window.musicPlayerState.currentIndex > 0;
    }
    
    // フォールバック
    if (!activeTrack) return false;
    const currentList = searchResults.length > 0 ? searchResults : trendingTracks.length > 0 ? trendingTracks : favorites;
    const currentIndex = currentList.findIndex(track => track.id === activeTrack.id);
    return currentIndex > 0;
  };

  // 検索の実行
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length < 2) {
      toast({
        title: "検索エラー",
        description: "検索語は2文字以上入力してください",
        variant: "destructive",
      });
      return;
    }
    
    // react-queryのキャッシュを強制的に更新（再検索を実行）
    queryClient.invalidateQueries({
      queryKey: ['/api/youtube/search', searchQuery]
    });
    
    toast({
      title: "検索中...",
      description: `「${searchQuery}」の検索結果を取得しています`,
      duration: 2000,
    });
  };

  // 曲アイテムのレンダリング
  const renderTrackItem = (track: MusicTrack) => (
    <div 
      key={track.id} 
      className="flex items-center p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors duration-200"
      onClick={() => playTrack(track)}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 flex-shrink-0 shadow-sm">
        <img 
          src={`/api/proxy/direct?url=${encodeURIComponent(track.thumbnailUrl)}`} 
          alt={track.title} 
          className="w-full h-full object-cover"
          onError={(e) => (e.target as HTMLImageElement).src = "/api/proxy/default-thumbnail"}
        />
      </div>
      <div className="ml-4 overflow-hidden flex-1">
        <div className="font-medium text-gray-800 dark:text-gray-200 truncate">{track.title}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{track.artist}</div>
      </div>
      <div className="flex-shrink-0 text-gray-400 hover:text-primary">
        <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0">
          <Play size={16} className="ml-0.5" />
        </Button>
      </div>
    </div>
  );
  
  // トレンド動画セクションのレンダリング
  const renderTrendingSection = () => (
    <>
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
          <span className="inline-flex items-center justify-center bg-red-600 text-white rounded-full p-1 mr-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
          </span>
          今日のトレンド
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          日本で人気の曲をチェック（{new Date().toLocaleDateString('ja-JP')}）
        </p>
      </div>
    
      {isLoadingTrending ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : trendingTracks.length === 0 ? (
        <div className="text-center py-8 px-4">
          <div className="text-gray-600 dark:text-gray-300">
            トレンド情報の読み込みに失敗しました
          </div>
          <p className="text-gray-500 text-sm mt-2">
            ネットワーク接続を確認してください
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
          {trendingTracks.map(renderTrackItem)}
        </div>
      )}
    </>
  );

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <div className="bg-primary/10 p-2 rounded-lg mr-3">
            <Music className="text-primary" size={24} />
          </div>
          音楽を探して楽しむ
        </h2>
      </div>
      
      {/* 検索フォーム */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm">
          <Input
            type="text"
            placeholder="曲名、アーティスト名、アルバム名で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border-gray-300 focus:ring-primary focus-visible:ring-primary"
          />
          <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
            <Search className="h-4 w-4 mr-2" />
            検索
          </Button>
        </div>
      </form>

      {/* タブコンテンツ */}
      <Tabs defaultValue="search" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
          <TabsTrigger value="search" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-primary">
            <Search className="h-4 w-4 mr-2" />
            検索結果
          </TabsTrigger>
          <TabsTrigger value="favorites" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-primary">
            <Heart className="h-4 w-4 mr-2" />
            お気に入り
          </TabsTrigger>
          <TabsTrigger value="playlists" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:text-primary">
            <ListMusic className="h-4 w-4 mr-2" />
            プレイリスト
          </TabsTrigger>
        </TabsList>
        
        {/* 検索結果タブ */}
        <TabsContent value="search">
          <Card className="border-0 overflow-hidden shadow-md">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : isError ? (
                <div className="text-center py-12 px-4">
                  <div className="text-red-500 font-medium mb-2">検索中にエラーが発生しました</div>
                  <p className="text-gray-500 text-sm">もう一度お試しいただくか、別のキーワードで検索してください</p>
                </div>
              ) : searchQuery.trim().length > 0 && searchResults.length > 0 ? (
                // 検索が実行され結果がある場合のみ検索結果を表示
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                  {searchResults.map(renderTrackItem)}
                </div>
              ) : (
                // それ以外の場合は常にトレンド（人気動画）を表示
                renderTrendingSection()
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* お気に入りタブ */}
        <TabsContent value="favorites">
          <Card className="border-0 overflow-hidden shadow-md">
            <CardContent className="p-0">
              {favorites.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-gray-600 dark:text-gray-300 font-medium mb-2">お気に入りがありません</div>
                  <div className="text-gray-500 text-sm mb-6">曲を再生して♡ボタンを押すとここに追加されます</div>
                  <Button variant="outline" onClick={() => document.querySelector('[value="search"]')?.dispatchEvent(new Event('click'))}>
                    <Search className="h-4 w-4 mr-2" />
                    音楽を検索する
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                  {favorites.map(renderTrackItem)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* プレイリストタブ */}
        <TabsContent value="playlists">
          <Card className="border-0 overflow-hidden shadow-md">
            <CardContent className="p-4">
              {playlists.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-gray-600 dark:text-gray-300 font-medium mb-2">プレイリストがありません</div>
                  <div className="text-gray-500 text-sm mb-6">お気に入りの曲をグループ化してプレイリストを作成できます</div>
                  <Button variant="outline" onClick={() => document.querySelector('[value="favorites"]')?.dispatchEvent(new Event('click'))}>
                    <Heart className="h-4 w-4 mr-2" />
                    お気に入りを見る
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {playlists.map(playlist => (
                    <div key={playlist.id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-800 dark:text-gray-200">{playlist.name}</h3>
                        <div className="text-sm text-primary font-medium bg-primary/10 px-2 py-0.5 rounded">
                          {playlist.tracks.length}曲
                        </div>
                      </div>
                      
                      {playlist.tracks.length > 0 ? (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                          {playlist.tracks.map(renderTrackItem)}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-2">
                          このプレイリストには曲が登録されていません
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 曲再生プレーヤー */}
      {activeTrack && (
        <MusicPlayer
          trackId={activeTrack.id}
          title={activeTrack.title}
          artist={activeTrack.artist}
          thumbnailUrl={activeTrack.thumbnailUrl}
          onClose={closePlayer}
          onNext={playNextTrack}
          onPrev={playPrevTrack}
          hasNext={hasNextTrack()}
          hasPrev={hasPrevTrack()}
        />
      )}
    </div>
  );
}