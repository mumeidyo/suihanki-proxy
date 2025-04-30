/**
 * Supabaseサービス
 * 
 * Supabaseを使用した中央データベース方式の実装。
 * 掲示板機能のデータを保存・取得するためのサービス
 */

import { createClient } from '@supabase/supabase-js';
import { 
  BoardPost, 
  BoardComment, 
  InsertBoardPost, 
  InsertBoardComment 
} from '@shared/schema';

// Supabase接続情報を直接指定
const supabaseUrl = 'https://mledivrkrlknzgzvujpz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sZWRpdnJrcmxrbnpnenZ1anB6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTkzNzg1NiwiZXhwIjoyMDYxNTEzODU2fQ.u8Cv85DSKXoi0mxbkLeQxf93liZzqyI46tNRvVtaJ0U';

// ハードコードされた値を使用してSupabaseクライアントを作成
export const supabase = createClient(supabaseUrl, supabaseKey);

// 初期化確認
export async function initializeSupabase(): Promise<boolean> {
  // Supabaseが利用可能かどうかチェック
  if (!supabase) {
    console.warn('Supabase接続が設定されていないため、初期化をスキップします。');
    return false;
  }

  try {
    // テーブルの存在確認
    await ensureTablesExist();
    return true;
  } catch (error) {
    console.error('Supabase初期化エラー:', error);
    return false;
  }
}

// テーブルが存在するか確認し、なければ作成
async function ensureTablesExist() {
  // Supabaseが設定されていない場合はスキップ
  if (!supabase) {
    console.warn('Supabase接続が設定されていないため、テーブル確認をスキップします。');
    return;
  }

  try {
    const { error: boardPostsError } = await supabase
      .from('board_posts')
      .select('id', { count: 'exact', head: true });

    if (boardPostsError) {
      console.log('Supabaseにboard_postsテーブルを作成します');
      await supabase.rpc('create_board_posts_table');
    }

    const { error: boardCommentsError } = await supabase
      .from('board_comments')
      .select('id', { count: 'exact', head: true });

    if (boardCommentsError) {
      console.log('Supabaseにboard_commentsテーブルを作成します');
      await supabase.rpc('create_board_comments_table');
    }
  } catch (error) {
    console.error('Supabaseテーブル確認中にエラーが発生しました:', error);
    throw error;
  }
}

// 掲示板投稿のCRUD操作
export const boardService = {
  // 投稿削除
  async deletePost(id: number): Promise<boolean> {
    // Supabase接続がない場合はfalseを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、投稿ID(${id})の削除ができません。`);
      return false;
    }
    
    try {
      // 関連するコメントを先に削除
      const { error: commentError } = await supabase
        .from('board_comments')
        .delete()
        .eq('post_id', id);
        
      if (commentError) {
        console.error(`投稿ID(${id})に関連するコメントの削除中にエラーが発生しました:`, commentError);
        // コメント削除に失敗しても投稿の削除は試みる
      }
      
      // 投稿削除実行
      const { error } = await supabase
        .from('board_posts')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(`投稿ID(${id})の削除中にエラーが発生しました:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`投稿ID(${id})の削除中に例外が発生しました:`, error);
      return false;
    }
  },
  
  // 投稿一覧の取得
  async getAllPosts(page: number = 1, limit: number = 10): Promise<{ data: BoardPost[], count: number }> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、投稿一覧の取得ができません。');
      return { data: [], count: 0 };
    }
    
    try {
      const offset = (page - 1) * limit;
      
      // 投稿データの取得
      const { data, error, count } = await supabase
        .from('board_posts')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) {
        console.error('Supabase投稿取得エラー:', error);
        return { data: [], count: 0 };
      }
      
      return { 
        data: data || [], 
        count: count || 0 
      };
    } catch (error) {
      console.error('投稿一覧取得中にエラーが発生しました:', error);
      return { data: [], count: 0 };
    }
  },
  
  // 投稿の詳細取得
  async getPostById(id: number): Promise<BoardPost | null> {
    // Supabase接続がない場合はnullを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、投稿ID(${id})の取得ができません。`);
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('board_posts')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) {
        console.error(`Supabase投稿ID(${id})取得エラー:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error(`投稿ID(${id})取得中にエラーが発生しました:`, error);
      return null;
    }
  },
  
  // 新規投稿の作成
  async createPost(post: InsertBoardPost): Promise<BoardPost | null> {
    // Supabase接続がない場合はnullを返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、投稿の作成ができません。');
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('board_posts')
        .insert([{
          title: post.title,
          content: post.content,
          author: post.author,
          author_id: post.authorId,
          image_url: post.imageUrl
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Supabase投稿作成エラー:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('投稿作成中にエラーが発生しました:', error);
      return null;
    }
  },
  
  // いいねの更新
  async likePost(id: number): Promise<boolean> {
    // Supabase接続がない場合はfalseを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、投稿ID(${id})のいいね更新ができません。`);
      return false;
    }
    
    try {
      const { error } = await supabase.rpc('increment_post_likes', {
        post_id: id
      });
      
      if (error) {
        console.error(`Supabase投稿ID(${id})いいねエラー:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`投稿ID(${id})いいね更新中にエラーが発生しました:`, error);
      return false;
    }
  },
  
  // ユーザーの投稿一覧取得
  async getUserPosts(authorId: string, page: number = 1, limit: number = 10): Promise<{ data: BoardPost[], count: number }> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、ユーザー(${authorId})の投稿一覧の取得ができません。`);
      return { data: [], count: 0 };
    }
    
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabase
        .from('board_posts')
        .select('*', { count: 'exact' })
        .eq('author_id', authorId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
        
      if (error) {
        console.error(`Supabaseユーザー(${authorId})投稿取得エラー:`, error);
        return { data: [], count: 0 };
      }
      
      return { 
        data: data || [], 
        count: count || 0 
      };
    } catch (error) {
      console.error(`ユーザー(${authorId})投稿一覧取得中にエラーが発生しました:`, error);
      return { data: [], count: 0 };
    }
  }
};

// 掲示板コメントのCRUD操作
export const commentService = {
  // 特定投稿のコメント一覧取得
  async getPostComments(postId: number): Promise<BoardComment[]> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、投稿ID(${postId})のコメント一覧の取得ができません。`);
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('board_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error(`Supabase投稿ID(${postId})コメント取得エラー:`, error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error(`投稿ID(${postId})コメント一覧取得中にエラーが発生しました:`, error);
      return [];
    }
  },
  
  // 新規コメントの作成
  async createComment(comment: InsertBoardComment): Promise<BoardComment | null> {
    // Supabase接続がない場合はnullを返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、コメントの作成ができません。');
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('board_comments')
        .insert([{
          post_id: comment.postId,
          content: comment.content,
          author: comment.author,
          author_id: comment.authorId
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Supabaseコメント作成エラー:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('コメント作成中にエラーが発生しました:', error);
      return null;
    }
  },
  
  // コメントいいねの更新
  async likeComment(id: number): Promise<boolean> {
    // Supabase接続がない場合はfalseを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、コメントID(${id})のいいね更新ができません。`);
      return false;
    }
    
    try {
      const { error } = await supabase.rpc('increment_comment_likes', {
        comment_id: id
      });
      
      if (error) {
        console.error(`SupabaseコメントID(${id})いいねエラー:`, error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`コメントID(${id})いいね更新中にエラーが発生しました:`, error);
      return false;
    }
  },
  
  // コメント削除
  async deleteComment(id: number): Promise<boolean> {
    // Supabase接続がない場合はfalseを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、コメントID(${id})の削除ができません。`);
      return false;
    }
    
    try {
      console.log(`[Supabase] コメント削除開始: ID=${id}`);
      
      // 削除前に存在確認
      const { data: existingComment, error: checkError } = await supabase
        .from('board_comments')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (checkError) {
        console.error(`[Supabase] コメント存在確認エラー: ID=${id}`, checkError);
        return false;
      }
      
      if (!existingComment) {
        console.error(`[Supabase] コメントが存在しません: ID=${id}`);
        
        // 現在のコメント一覧をログ出力（デバッグ用）
        const { data: allComments } = await supabase
          .from('board_comments')
          .select('id, post_id, author');
          
        console.log(`[Supabase] 存在するコメント一覧:`, allComments?.map(c => `ID=${c.id}, 投稿=${c.post_id}, 作者=${c.author}`));
        
        return false;
      }
      
      console.log(`[Supabase] 削除するコメント: `, existingComment);
      
      // 削除実行
      const { error } = await supabase
        .from('board_comments')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(`[Supabase] コメントID(${id})削除エラー:`, error);
        return false;
      }
      
      console.log(`[Supabase] コメントID(${id})削除成功`);
      return true;
    } catch (error) {
      console.error(`[Supabase] コメントID(${id})削除中に例外が発生:`, error);
      return false;
    }
  }
};