/**
 * YouTubeのURLからビデオIDを抽出する
 * 
 * サポートするURLフォーマット:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * 
 * @param url YouTube動画のURL
 * @returns 抽出されたビデオID、抽出できない場合はnull
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  
  // URLからパラメータvを取得する正規表現
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  
  // ショートビデオURLの正規表現
  const shortsRegExp = /^.*(youtube.com\/shorts\/)([^#&?]*).*/;
  const shortsMatch = url.match(shortsRegExp);
  
  // 直接ビデオIDの場合（11文字の英数字とハイフン、アンダースコア）
  const idRegExp = /^[a-zA-Z0-9_-]{11}$/;
  const idMatch = url.match(idRegExp);
  
  if (idMatch) {
    // 直接ビデオIDが入力された場合
    return url;
  } else if (match && match[7].length === 11) {
    // 通常のYouTube URL
    return match[7];
  } else if (shortsMatch && shortsMatch[2].length === 11) {
    // ショートビデオURL
    return shortsMatch[2];
  }
  
  return null;
}

/**
 * YouTubeビデオIDからサムネイル画像URLを取得する
 * 
 * @param videoId YouTubeビデオID
 * @param quality サムネイル画質 ('default', 'mqdefault', 'hqdefault', 'sddefault', 'maxresdefault')
 * @returns サムネイル画像のURL
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'mqdefault' | 'hqdefault' | 'sddefault' | 'maxresdefault' = 'hqdefault'): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * 秒数または ISO 8601 期間形式の文字列を「mm:ss」または「hh:mm:ss」形式に変換する
 * 
 * @param duration 秒数または ISO 8601 期間形式の文字列 (例: 'PT1H24M35S')
 * @returns フォーマットされた時間文字列
 */
export function formatDuration(duration: number | string): string {
  // 文字列（ISO期間形式）の場合
  if (typeof duration === 'string') {
    // ISO 8601 期間形式を解析（例: PT1H24M35S）
    const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!matches) {
      return '00:00';
    }
    
    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  // 数値（秒）の場合
  if (isNaN(duration) || duration < 0) {
    return '00:00';
  }
  
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const secs = Math.floor(duration % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * 公開日をフォーマットする
 * 
 * @param publishedDate 公開日（ISO形式の文字列）
 * @returns フォーマットされた日付文字列
 */
export function formatPublishedDate(publishedDate: string): string {
  try {
    const date = new Date(publishedDate);
    
    // 無効な日付の場合
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // 現在の日付
    const now = new Date();
    
    // 日付の差を計算
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    const diffYears = Math.floor(diffMonths / 12);
    
    // 適切な表示形式を選択
    if (diffSec < 60) {
      return `${diffSec}秒前`;
    } else if (diffMin < 60) {
      return `${diffMin}分前`;
    } else if (diffHours < 24) {
      return `${diffHours}時間前`;
    } else if (diffDays < 30) {
      return `${diffDays}日前`;
    } else if (diffMonths < 12) {
      return `${diffMonths}ヶ月前`;
    } else {
      return `${diffYears}年前`;
    }
  } catch (error) {
    console.error('日付のフォーマットに失敗しました:', error);
    return '';
  }
}