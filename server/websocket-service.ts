import { Server } from 'http';

// WebSocketサービスを完全に無効化したスタブ実装

/**
 * WebSocketサーバーの初期化（無効化）
 */
export function initWebSocketServer(server: Server) {
  console.log('WebSocket functionality completely disabled to prevent connection issues');
  return;
}

/**
 * 掲示板の投稿が作成されたことをブロードキャスト（無効化）
 */
export function broadcastNewPost(postData: any) {
  // 機能を無効化
  return;
}

/**
 * 掲示板のコメントが作成されたことをブロードキャスト（無効化）
 */
export function broadcastNewComment(commentData: any) {
  // 機能を無効化
  return;
}

/**
 * いいねが追加されたことをブロードキャスト（無効化）
 */
export function broadcastLike(type: 'post' | 'comment', id: number) {
  // 機能を無効化
  return;
}