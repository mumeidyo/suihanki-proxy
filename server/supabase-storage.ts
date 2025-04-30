/**
 * Supabase Storage Implementation
 * 
 * 掲示板機能のための中央データベース方式を実装するクラス
 * Supabaseを使用して、複数のインスタンス間でデータを同期する
 */

import { IStorage } from './storage';
import { supabase, boardService, commentService, initializeSupabase } from './supabase-service';
import {
  YoutubeVideo,
  InsertYoutubeVideo,
  DownloadHistory,
  InsertDownloadHistory,
  ProxyHistory,
  InsertProxyHistory,
  BoardPost,
  InsertBoardPost,
  BoardComment,
  InsertBoardComment,
  UserRole,
  InsertUserRole,
  BannedIp,
  InsertBannedIp,
  KickHistory,
  InsertKickHistory
} from '@shared/schema';

// Supabaseを使用した中央データベース方式のストレージ実装
export class SupabaseStorage implements IStorage {
  private initialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    try {
      this.initialized = await initializeSupabase();
      console.log('Supabase storage initialized:', this.initialized ? '成功' : '失敗');
    } catch (error) {
      console.error('Supabase storage initialization error:', error);
      this.initialized = false;
    }
  }

  // 掲示板関連のメソッド - Supabase実装
  async createBoardPost(post: InsertBoardPost): Promise<BoardPost> {
    try {
      const result = await boardService.createPost(post);
      if (result === null) {
        throw new Error('Supabase board post creation failed');
      }
      return result;
    } catch (error) {
      console.error('Error creating board post in Supabase:', error);
      throw error;
    }
  }

  async getBoardPost(postId: number): Promise<BoardPost | undefined> {
    try {
      const result = await boardService.getPostById(postId);
      return result || undefined;
    } catch (error) {
      console.error(`Error getting board post ${postId} from Supabase:`, error);
      return undefined;
    }
  }

  async getAllBoardPosts(limit: number, offset: number): Promise<BoardPost[]> {
    try {
      const page = Math.floor(offset / limit) + 1;
      const { data } = await boardService.getAllPosts(page, limit);
      return data;
    } catch (error) {
      console.error('Error getting all board posts from Supabase:', error);
      return [];
    }
  }

  async getUserBoardPosts(authorId: string, limit: number): Promise<BoardPost[]> {
    try {
      const { data } = await boardService.getUserPosts(authorId, 1, limit);
      return data;
    } catch (error) {
      console.error(`Error getting user ${authorId} posts from Supabase:`, error);
      return [];
    }
  }

  async createBoardComment(comment: InsertBoardComment): Promise<BoardComment> {
    try {
      const result = await commentService.createComment(comment);
      if (result === null) {
        throw new Error('Supabase comment creation failed');
      }
      return result;
    } catch (error) {
      console.error('Error creating comment in Supabase:', error);
      throw error;
    }
  }

  async getPostComments(postId: number): Promise<BoardComment[]> {
    try {
      const comments = await commentService.getPostComments(postId);
      return comments;
    } catch (error) {
      console.error(`Error getting comments for post ${postId} from Supabase:`, error);
      return [];
    }
  }

  async incrementPostLikes(postId: number): Promise<void> {
    try {
      await boardService.likePost(postId);
    } catch (error) {
      console.error(`Error incrementing likes for post ${postId} in Supabase:`, error);
    }
  }

  async incrementCommentLikes(commentId: number): Promise<void> {
    try {
      await commentService.likeComment(commentId);
    } catch (error) {
      console.error(`Error incrementing likes for comment ${commentId} in Supabase:`, error);
    }
  }
  
  async deleteBoardPost(postId: number): Promise<boolean> {
    try {
      console.log(`SupabaseStorage - 投稿削除開始: 投稿ID = ${postId}`);
      const result = await boardService.deletePost(postId);
      console.log(`SupabaseStorage - 投稿削除結果: ${result ? '成功' : '失敗'}`);
      return result;
    } catch (error) {
      console.error(`SupabaseStorage - 投稿ID=${postId}の削除中にエラーが発生しました:`, error);
      return false;
    }
  }
  
  async deleteBoardComment(commentId: number): Promise<boolean> {
    try {
      const result = await commentService.deleteComment(commentId);
      return result;
    } catch (error) {
      console.error(`Error deleting comment ${commentId} from Supabase:`, error);
      return false;
    }
  }

  // YouTube動画関連のメソッド - ローカルDBから実装するため、スケルトン実装
  async getVideo(videoId: string): Promise<YoutubeVideo | undefined> {
    console.log(`[Supabase] getVideo called for ${videoId} (local DB implementation needed)`);
    return undefined;
  }

  async saveVideo(video: InsertYoutubeVideo): Promise<YoutubeVideo> {
    console.log(`[Supabase] saveVideo called for ${video.videoId} (local DB implementation needed)`);
    throw new Error('Not implemented: YouTube videos should use local DB');
  }

  async incrementDownloadCount(videoId: string): Promise<void> {
    console.log(`[Supabase] incrementDownloadCount called for ${videoId} (local DB implementation needed)`);
  }

  async addDownloadHistory(record: InsertDownloadHistory): Promise<DownloadHistory> {
    console.log(`[Supabase] addDownloadHistory called (local DB implementation needed)`);
    throw new Error('Not implemented: Download history should use local DB');
  }

  async getDownloadHistory(limit: number): Promise<DownloadHistory[]> {
    console.log(`[Supabase] getDownloadHistory called (local DB implementation needed)`);
    return [];
  }

  async addProxyHistory(record: InsertProxyHistory): Promise<ProxyHistory> {
    console.log(`[Supabase] addProxyHistory called (local DB implementation needed)`);
    throw new Error('Not implemented: Proxy history should use local DB');
  }

  async getProxyHistory(limit: number): Promise<ProxyHistory[]> {
    console.log(`[Supabase] getProxyHistory called (local DB implementation needed)`);
    return [];
  }

  async getRecentVideos(limit: number): Promise<YoutubeVideo[]> {
    console.log(`[Supabase] getRecentVideos called (local DB implementation needed)`);
    return [];
  }

  async getPopularVideos(limit: number): Promise<YoutubeVideo[]> {
    console.log(`[Supabase] getPopularVideos called (local DB implementation needed)`);
    return [];
  }

  // ユーザー権限関連のメソッド - Supabaseで実装
  async getUserRole(userId: string): Promise<{ role: string } | undefined> {
    // Supabase接続がない場合はundefinedを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、ユーザー(${userId})の権限取得ができません。`);
      return undefined;
    }
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();
        
      if (error || !data) {
        return undefined;
      }
      
      return { role: data.role };
    } catch (error) {
      console.error(`Error getting user role for ${userId} from Supabase:`, error);
      return undefined;
    }
  }

  async saveUserRole(data: { userId: string, role: string }): Promise<void> {
    // Supabase接続がない場合は処理をスキップ
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、ユーザー(${data.userId})の権限保存ができません。`);
      return;
    }
    
    try {
      await supabase
        .from('user_roles')
        .upsert({
          user_id: data.userId,
          role: data.role,
          updated_at: new Date()
        }, {
          onConflict: 'user_id'
        });
    } catch (error) {
      console.error(`Error saving user role for ${data.userId} in Supabase:`, error);
    }
  }

  async removeUserRole(userId: string): Promise<void> {
    // Supabase接続がない場合は処理をスキップ
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、ユーザー(${userId})の権限削除ができません。`);
      return;
    }
    
    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
    } catch (error) {
      console.error(`Error removing user role for ${userId} from Supabase:`, error);
    }
  }

  async getAllUserRoles(): Promise<{ userId: string, role: string }[]> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、すべてのユーザー権限取得ができません。');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, role');
        
      if (error || !data) {
        return [];
      }
      
      return data.map(item => ({
        userId: item.user_id,
        role: item.role
      }));
    } catch (error) {
      console.error('Error getting all user roles from Supabase:', error);
      return [];
    }
  }

  // 禁止IPアドレス関連のメソッド - Supabaseで実装
  async getBannedIp(ipAddress: string): Promise<BannedIp | undefined> {
    // Supabase接続がない場合はundefinedを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、禁止IP(${ipAddress})の取得ができません。`);
      return undefined;
    }
    
    try {
      const { data, error } = await supabase
        .from('banned_ips')
        .select('*')
        .eq('ip_address', ipAddress)
        .single();
        
      if (error || !data) {
        return undefined;
      }
      
      return {
        id: data.id,
        ipAddress: data.ip_address,
        reason: data.reason,
        bannedBy: data.banned_by,
        bannedAt: new Date(data.banned_at),
        expiresAt: data.expires_at ? new Date(data.expires_at) : null
      };
    } catch (error) {
      console.error(`Error getting banned IP ${ipAddress} from Supabase:`, error);
      return undefined;
    }
  }

  async addBannedIp(data: InsertBannedIp): Promise<BannedIp> {
    // Supabase接続がない場合はエラーをスロー
    if (!supabase) {
      console.error(`Supabase接続が設定されていないため、禁止IP(${data.ipAddress})の追加ができません。`);
      throw new Error(`Supabase接続が設定されていないため、禁止IPの追加ができません。`);
    }
    
    try {
      const { data: result, error } = await supabase
        .from('banned_ips')
        .insert({
          ip_address: data.ipAddress,
          reason: data.reason,
          banned_by: data.bannedBy,
          banned_at: new Date(),
          expires_at: data.expiresAt
        })
        .select()
        .single();
        
      if (error || !result) {
        throw new Error(`Failed to add banned IP: ${error?.message}`);
      }
      
      return {
        id: result.id,
        ipAddress: result.ip_address,
        reason: result.reason,
        bannedBy: result.banned_by,
        bannedAt: new Date(result.banned_at),
        expiresAt: result.expires_at ? new Date(result.expires_at) : null
      };
    } catch (error) {
      console.error(`Error adding banned IP ${data.ipAddress} to Supabase:`, error);
      throw error;
    }
  }

  async removeBannedIp(ipAddress: string): Promise<boolean> {
    // Supabase接続がない場合はfalseを返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、禁止IP(${ipAddress})の削除ができません。`);
      return false;
    }
    
    try {
      const { error } = await supabase
        .from('banned_ips')
        .delete()
        .eq('ip_address', ipAddress);
        
      return !error;
    } catch (error) {
      console.error(`Error removing banned IP ${ipAddress} from Supabase:`, error);
      return false;
    }
  }

  async getAllBannedIps(): Promise<BannedIp[]> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、すべての禁止IP取得ができません。');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('banned_ips')
        .select('*')
        .order('banned_at', { ascending: false });
        
      if (error || !data) {
        return [];
      }
      
      return data.map(item => ({
        id: item.id,
        ipAddress: item.ip_address,
        reason: item.reason,
        bannedBy: item.banned_by,
        bannedAt: new Date(item.banned_at),
        expiresAt: item.expires_at ? new Date(item.expires_at) : null
      }));
    } catch (error) {
      console.error('Error getting all banned IPs from Supabase:', error);
      return [];
    }
  }

  // キック関連のメソッド - Supabaseで実装
  async addKickHistory(data: InsertKickHistory): Promise<KickHistory> {
    // Supabase接続がない場合はエラーをスロー
    if (!supabase) {
      console.error(`Supabase接続が設定されていないため、ユーザー(${data.userId})のキック履歴追加ができません。`);
      throw new Error(`Supabase接続が設定されていないため、キック履歴の追加ができません。`);
    }
    
    try {
      const { data: result, error } = await supabase
        .from('kick_history')
        .insert({
          user_id: data.userId,
          ip_address: data.ipAddress,
          reason: data.reason,
          kicked_by: data.kickedBy,
          kicked_at: new Date()
        })
        .select()
        .single();
        
      if (error || !result) {
        throw new Error(`Failed to add kick history: ${error?.message}`);
      }
      
      return {
        id: result.id,
        userId: result.user_id,
        ipAddress: result.ip_address,
        reason: result.reason,
        kickedBy: result.kicked_by,
        kickedAt: new Date(result.kicked_at)
      };
    } catch (error) {
      console.error(`Error adding kick history for user ${data.userId} to Supabase:`, error);
      throw error;
    }
  }

  async getKickHistory(limit: number): Promise<KickHistory[]> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn('Supabase接続が設定されていないため、キック履歴取得ができません。');
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('kick_history')
        .select('*')
        .order('kicked_at', { ascending: false })
        .limit(limit);
        
      if (error || !data) {
        return [];
      }
      
      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        ipAddress: item.ip_address,
        reason: item.reason,
        kickedBy: item.kicked_by,
        kickedAt: new Date(item.kicked_at)
      }));
    } catch (error) {
      console.error(`Error getting kick history from Supabase:`, error);
      return [];
    }
  }

  async getUserKickHistory(userId: string): Promise<KickHistory[]> {
    // Supabase接続がない場合は空配列を返す
    if (!supabase) {
      console.warn(`Supabase接続が設定されていないため、ユーザー(${userId})のキック履歴取得ができません。`);
      return [];
    }
    
    try {
      const { data, error } = await supabase
        .from('kick_history')
        .select('*')
        .eq('user_id', userId)
        .order('kicked_at', { ascending: false });
        
      if (error || !data) {
        return [];
      }
      
      return data.map(item => ({
        id: item.id,
        userId: item.user_id,
        ipAddress: item.ip_address,
        reason: item.reason,
        kickedBy: item.kicked_by,
        kickedAt: new Date(item.kicked_at)
      }));
    } catch (error) {
      console.error(`Error getting kick history for user ${userId} from Supabase:`, error);
      return [];
    }
  }

  // IPアドレスが禁止されているかチェック（期限切れも考慮）
  async isIpBanned(ipAddress: string): Promise<boolean> {
    const bannedIp = await this.getBannedIp(ipAddress);
    if (!bannedIp) return false;
    
    // 無期限の場合
    if (!bannedIp.expiresAt) return true;
    
    // 期限切れをチェック
    const now = new Date();
    return now < bannedIp.expiresAt;
  }
}