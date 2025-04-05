import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { extractVideoId } from '../lib/youtube';

export default function AndroidTest() {
  const [location, setLocation] = useLocation();
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [isUrlValid, setIsUrlValid] = useState(false);
  
  // URLが変更されたとき
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setVideoUrl(url);
    
    // YouTube URLからビデオIDを抽出
    const id = extractVideoId(url);
    setVideoId(id || '');
    setIsUrlValid(!!id);
  };
  
  // 標準プレーヤーを開く
  const openStandardPlayer = () => {
    if (videoId) {
      window.open(`/api/youtube/proxy-player/${videoId}`, '_blank');
    }
  };
  
  // 強化型プレーヤーを開く
  const openEnhancedPlayer = () => {
    if (videoId) {
      window.open(`/api/youtube/android-player/${videoId}`, '_blank');
    }
  };
  
  // 直接ストリーミングを開く
  const openDirectStream = () => {
    if (videoId) {
      window.open(`/api/youtube/direct-stream/${videoId}`, '_blank');
    }
  };
  
  // 標準YouTube埋め込みを開く
  const openYouTubeEmbed = () => {
    if (videoId) {
      window.open(`https://www.youtube.com/embed/${videoId}?autoplay=1`, '_blank');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-8 text-center">Android スリープテスト</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>YouTube URLまたはビデオID入力</CardTitle>
          <CardDescription>
            YouTubeのURLを入力するか、直接ビデオIDを入力してください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Input 
              placeholder="例: https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
              value={videoUrl}
              onChange={handleUrlChange}
            />
            {videoId && (
              <div className="text-sm text-gray-500">
                検出されたビデオID: <span className="font-mono bg-gray-100 dark:bg-gray-800 p-1 rounded">{videoId}</span>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center flex-wrap gap-2">
          <Button disabled={!isUrlValid} onClick={openStandardPlayer} variant="outline">
            標準プレーヤー
          </Button>
          <Button disabled={!isUrlValid} onClick={openEnhancedPlayer} variant="default">
            強化型プレーヤー
          </Button>
          <Button disabled={!isUrlValid} onClick={openDirectStream} variant="secondary">
            直接ストリーミング
          </Button>
          <Button disabled={!isUrlValid} onClick={openYouTubeEmbed} variant="outline">
            YouTube埋込
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>人気の動画</CardTitle>
          <CardDescription>
            テスト用の動画リンク
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                setVideoId('dQw4w9WgXcQ');
                setIsUrlValid(true);
              }}
            >
              Rick Astley - Never Gonna Give You Up
            </Button>
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=9bZkp7q19f0');
                setVideoId('9bZkp7q19f0');
                setIsUrlValid(true);
              }}
            >
              PSY - GANGNAM STYLE
            </Button>
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=JGwWNGJdvx8');
                setVideoId('JGwWNGJdvx8');
                setIsUrlValid(true);
              }}
            >
              Ed Sheeran - Shape of You
            </Button>
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=kJQP7kiw5Fk');
                setVideoId('kJQP7kiw5Fk');
                setIsUrlValid(true);
              }}
            >
              Luis Fonsi - Despacito ft. Daddy Yankee
            </Button>
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=RgKAFK5djSk');
                setVideoId('RgKAFK5djSk');
                setIsUrlValid(true);
              }}
            >
              Wiz Khalifa - See You Again ft. Charlie Puth
            </Button>
            <Button
              variant="outline"
              className="text-left justify-start h-auto py-2"
              onClick={() => {
                setVideoUrl('https://www.youtube.com/watch?v=pRpeEdMmmQ0');
                setVideoId('pRpeEdMmmQ0');
                setIsUrlValid(true);
              }}
            >
              BTS - Dynamite
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <div className="text-sm text-gray-500">
            {isUrlValid && 
              <p>動画が選択されました。上部の再生ボタンをクリックして異なるプレーヤーでテストしてください。</p>
            }
          </div>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-sm text-center text-gray-500">
        <p>
          スリープテスト: Android端末で動画を再生し、端末をスリープ状態にしてバックグラウンド再生が継続するかチェックします。
        </p>
      </div>
    </div>
  );
}