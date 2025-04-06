/**
 * 外部インスタンス同期サービス
 * 
 * このモジュールは、ReplitとRenderなど複数のデプロイメント間でデータを同期するための
 * 機能を提供します。これにより、あるインスタンスに投稿されたメッセージが他のインスタンスでも
 * 表示されるようになります。
 * 
 * 同期方法：
 * 1. プル (Pull) - 他のインスタンスから定期的にデータを取得
 * 2. プッシュ (Push) - 新しい投稿やコメントが作成されたときに他のインスタンスに自動送信
 */

import axios from 'axios';
import { 
  BoardPost, 
  BoardComment,
  InsertBoardPost,
  InsertBoardComment
} from '@shared/schema';

interface StorageInterface {
  createBoardPost: (post: InsertBoardPost) => Promise<BoardPost>;
  createBoardComment: (comment: InsertBoardComment) => Promise<BoardComment>;
  getBoardPost: (postId: number) => Promise<BoardPost | undefined>;
  getAllBoardPosts: (limit: number, offset: number) => Promise<BoardPost[]>;
  getPostComments: (postId: number) => Promise<BoardComment[]>;
}

// 同期インターバルの間隔（ミリ秒）
const SYNC_INTERVAL = 60 * 1000; // 1分ごと

// 同期処理のタイマーID
let syncIntervalId: NodeJS.Timeout | null = null;

// 同期先インスタンスのURL一覧
let syncInstances: string[] = [];

// ストレージインターフェース
let storage: StorageInterface;

/**
 * 同期サービスを初期化します
 */
export function initSyncService(storageInstance: StorageInterface, instances: string[] = []) {
  storage = storageInstance;
  syncInstances = instances.filter(url => url.trim() !== '');
  
  console.log(`Initializing sync service with ${syncInstances.length} external instances`);
  if (syncInstances.length > 0) {
    console.log(`Sync targets: ${syncInstances.join(', ')}`);
    startSyncInterval();
  } else {
    console.log('No sync instances configured. Sync service is disabled.');
  }
}

/**
 * 環境変数から同期先インスタンスURLを取得
 */
export function getSyncInstancesFromEnv(): string[] {
  const envInstances = process.env.SYNC_INSTANCES || '';
  console.log(`SYNC_INSTANCES env variable value: "${envInstances}"`);
  
  if (!envInstances) {
    return [];
  }
  
  const instances = envInstances.split(',').filter(url => url.trim() !== '');
  console.log(`Parsed sync instances: ${JSON.stringify(instances)}`);
  return instances;
}

/**
 * 同期サービスを開始
 */
function startSyncInterval() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }
  
  // 起動時に一度同期を実行
  syncWithExternalInstances().catch(err => {
    console.error('Initial sync failed:', err.message);
  });
  
  // 定期的な同期を開始
  syncIntervalId = setInterval(() => {
    syncWithExternalInstances().catch(err => {
      console.error('Periodic sync failed:', err.message);
    });
  }, SYNC_INTERVAL);
  
  console.log(`Sync service started. Will sync every ${SYNC_INTERVAL / 1000} seconds`);
}

/**
 * 同期サービスを停止
 */
export function stopSyncService() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('Sync service stopped');
  }
}

/**
 * 外部インスタンスから投稿を取得して同期
 */
async function syncWithExternalInstances() {
  if (syncInstances.length === 0 || !storage) {
    return;
  }
  
  console.log(`Starting synchronization with ${syncInstances.length} external instances...`);
  
  // 変更があったかどうかを追跡するフラグ
  let hasChanges = false;
  
  for (const instanceUrl of syncInstances) {
    try {
      console.log(`Syncing with: ${instanceUrl}`);
      
      // 外部インスタンスから投稿を取得
      const response = await axios.get(`${instanceUrl}/api/board/posts?limit=50`);
      
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        const remotePosts = response.data.data;
        console.log(`Retrieved ${remotePosts.length} posts from ${instanceUrl}`);
        
        // 既存のローカル投稿を全て取得
        const localPosts = await storage.getAllBoardPosts(100, 0);
        
        // リモート投稿とローカル投稿のマッピングを作成
        // タイトルと作者IDで一致を検索
        const findMatchingLocalPost = (remotePost: any) => {
          return localPosts.find(local => 
            local.title === remotePost.title && 
            local.authorId === remotePost.authorId
          );
        };
        
        // 各投稿を同期
        for (const remotePost of remotePosts) {
          // タイトルと作者IDでマッチする投稿がローカルに存在するか確認
          const localPost = findMatchingLocalPost(remotePost);
          
          if (!localPost) {
            // 新しい投稿をローカルに作成
            console.log(`Creating new post locally: "${remotePost.title}" (AuthorID: ${remotePost.authorId})`);
            hasChanges = true; // 変更があったのでフラグをセット
            
            try {
              const createdPost = await storage.createBoardPost({
                title: remotePost.title,
                content: remotePost.content,
                author: `${remotePost.author} (remote)`,
                authorId: remotePost.authorId,
                imageUrl: remotePost.imageUrl
              });
              
              console.log(`Successfully synced remote post to local ID: ${createdPost.id}`);
              
              // 投稿のコメントも同期
              await syncCommentsForPost(instanceUrl, remotePost.id, createdPost.id);
            } catch (error) {
              console.error(`Failed to sync post "${remotePost.title}":`, error);
            }
          } else {
            // 既存の投稿のコメントを同期
            console.log(`Post "${remotePost.title}" already exists locally as ID: ${localPost.id}`);
            const commentChanged = await syncCommentsForPost(instanceUrl, remotePost.id, localPost.id);
            if (commentChanged === true) {
              hasChanges = true; // コメントに変更があったのでフラグをセット
            }
          }
        }
      }
    } catch (error: any) {
      console.error(`Error syncing with ${instanceUrl}:`, error?.message || String(error));
    }
  }
  
  // 変更があった場合はキャッシュを無効化
  if (hasChanges && invalidateBoardCache) {
    console.log('Changes detected during sync, invalidating cache');
    invalidateBoardCache();
  }
  
  console.log('Synchronization completed');
}

/**
 * 特定の投稿に対するコメントを同期
 * @param instanceUrl 同期元のURLアドレス
 * @param remotePostId リモートの投稿ID
 * @param localPostId ローカルの投稿ID（リモートとは異なるIDになる場合がある）
 * @returns 新しいコメントが追加されたかどうか
 */
async function syncCommentsForPost(instanceUrl: string, remotePostId: number, localPostId?: number): Promise<boolean> {
  try {
    // remotePostIdを使用して外部インスタンスからコメントを取得
    const response = await axios.get(`${instanceUrl}/api/board/posts/${remotePostId}/comments`);
    
    if (response.data && response.data.success && Array.isArray(response.data.data)) {
      const remoteComments = response.data.data;
      console.log(`Retrieved ${remoteComments.length} comments for remote post ID ${remotePostId}`);
      
      // localPostIdが指定されていない場合は同じIDを使用
      const postIdToUse = localPostId || remotePostId;
      
      // ローカルの対応する投稿を取得（存在するか確認するため）
      const localPost = await storage.getBoardPost(postIdToUse);
      
      if (!localPost) {
        console.warn(`Cannot sync comments: Local post ID ${postIdToUse} not found`);
        return false;
      }
      
      // 既存のコメントを取得
      const existingComments = await storage.getPostComments(postIdToUse);
      
      // コメントの一意性をチェックする（コンテンツと作者IDの組み合わせで）
      const isCommentDuplicate = (remoteComment: any) => {
        return existingComments.some(
          local => local.content === remoteComment.content && 
                   local.authorId === remoteComment.authorId
        );
      };
      
      // 新しいコメントが追加されたかどうかを追跡
      let newCommentsAdded = false;
      
      // 各コメントを同期
      for (const remoteComment of remoteComments) {
        // 同じ内容と作者IDのコメントがローカルに存在しない場合は作成
        if (!isCommentDuplicate(remoteComment)) {
          console.log(`Creating new comment locally for post ID ${postIdToUse}: "${remoteComment.content.substring(0, 30)}..."`);
          newCommentsAdded = true;
          
          try {
            await storage.createBoardComment({
              postId: postIdToUse, // ローカルの投稿IDを使用
              content: remoteComment.content,
              author: `${remoteComment.author} (remote)`,
              authorId: remoteComment.authorId
            });
            
            console.log(`Successfully synced comment from remote post ID ${remotePostId} to local post ID ${postIdToUse}`);
          } catch (error: any) {
            console.error(`Failed to sync comment:`, error?.message || String(error));
          }
        } else {
          console.log(`Comment already exists locally: "${remoteComment.content.substring(0, 20)}..."`);
        }
      }
      
      return newCommentsAdded;
    }
    
    return false;
  } catch (error: any) {
    console.error(`Error syncing comments for post ID ${remotePostId} from ${instanceUrl}:`, error?.message || String(error));
    return false;
  }
}

/**
 * タイトルと作者IDを使用して重複する投稿を検索
 * @param title 投稿のタイトル
 * @param authorId 投稿の作者ID
 * @returns 見つかった場合は投稿オブジェクト、見つからない場合はundefined
 */
async function findDuplicatePost(title: string, authorId: string): Promise<BoardPost | undefined> {
  try {
    // ローカルの投稿を取得（最大100件）
    const localPosts = await storage.getAllBoardPosts(100, 0);
    
    // タイトルと作者IDが一致する投稿を探す
    return localPosts.find(post => 
      post.title === title && 
      post.authorId === authorId
    );
  } catch (error) {
    console.error('Error finding duplicate post:', error);
    return undefined;
  }
}

// 掲示板投稿キャッシュの無効化用の変数
let invalidateBoardCache: (() => void) | null = null;

/**
 * 手動で同期を実行
 */
export async function manualSync() {
  console.log('Manual sync triggered');
  // キャッシュ無効化関数が設定されていれば呼び出す
  if (invalidateBoardCache) {
    invalidateBoardCache();
  }
  return syncWithExternalInstances();
}

/**
 * 投稿キャッシュ無効化関数を設定
 */
export function setInvalidateCacheFunction(fn: () => void) {
  invalidateBoardCache = fn;
}

/**
 * 新しい投稿を他のインスタンスにプッシュ同期する
 * @param post 送信する投稿オブジェクト
 */
export async function pushPostToSyncInstances(post: BoardPost): Promise<void> {
  if (syncInstances.length === 0) {
    console.log('No sync instances configured. Push sync skipped.');
    return;
  }

  console.log(`Pushing new post "${post.title}" to ${syncInstances.length} external instances...`);
  
  // 外部インスタンスに送信するデータを整形
  // "(remote)" というマーカーが既に付いている場合は削除して送信
  // (二重に付くのを防ぐため)
  const authorName = post.author.replace(' (remote)', '');
  
  const postData = {
    title: post.title,
    content: post.content,
    author: authorName,
    authorId: post.authorId,
    imageUrl: post.imageUrl || null,
    createdAt: post.createdAt,
    likes: post.likes
  };
  
  for (const instanceUrl of syncInstances) {
    try {
      console.log(`Pushing post to: ${instanceUrl}`);
      // 投稿APIへデータを送信
      const response = await axios.post(`${instanceUrl}/api/sync/receive-post`, {
        post: postData
      });
      
      if (response.data && response.data.success) {
        console.log(`Successfully pushed post to ${instanceUrl}`);
      } else {
        console.error(`Failed to push post to ${instanceUrl}: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error(`Error pushing post to ${instanceUrl}:`, error?.message || String(error));
    }
  }
}

/**
 * 新しいコメントを他のインスタンスにプッシュ同期する
 * @param comment 送信するコメントオブジェクト
 * @param postTitle 対応する投稿のタイトル (リモートでIDの代わりに使用)
 * @param postAuthorId 対応する投稿の作者ID (リモートでIDの代わりに使用)
 */
export async function pushCommentToSyncInstances(comment: BoardComment, postTitle: string, postAuthorId: string): Promise<void> {
  if (syncInstances.length === 0) {
    console.log('No sync instances configured. Push sync skipped.');
    return;
  }

  console.log(`Pushing new comment for post "${postTitle}" to ${syncInstances.length} external instances...`);
  
  // "(remote)" マーカーを削除
  const authorName = comment.author.replace(' (remote)', '');
  
  const commentData = {
    postTitle: postTitle,
    postAuthorId: postAuthorId,
    content: comment.content,
    author: authorName,
    authorId: comment.authorId,
    createdAt: comment.createdAt,
    likes: comment.likes
  };
  
  for (const instanceUrl of syncInstances) {
    try {
      console.log(`Pushing comment to: ${instanceUrl}`);
      const response = await axios.post(`${instanceUrl}/api/sync/receive-comment`, {
        comment: commentData
      });
      
      if (response.data && response.data.success) {
        console.log(`Successfully pushed comment to ${instanceUrl}`);
      } else {
        console.error(`Failed to push comment to ${instanceUrl}: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error(`Error pushing comment to ${instanceUrl}:`, error?.message || String(error));
    }
  }
}