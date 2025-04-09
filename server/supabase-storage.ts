import { type IStorage } from './storage';
import { initSupabaseClient } from './supabase-client';

/**
 * Supabaseを使用したストレージクラス
 * 中央データベース方式用の実装
 */
export class SupabaseStorage implements IStorage {
  private supabase;
  private supabaseAdmin;

  constructor() {
    const clients = initSupabaseClient();
    if (!clients) {
      throw new Error('Supabaseクライアントの初期化に失敗しました');
    }
    this.supabase = clients.client;
    this.supabaseAdmin = clients.admin;
    console.log('Supabaseストレージを初期化しました');
  }

  // YouTubeビデオ関連
  async getVideo(videoId: string) {
    const { data, error } = await this.supabase
      .from('youtube_videos')
      .select('*')
      .eq('videoId', videoId)
      .single();

    if (error) {
      console.error('ビデオ取得エラー:', error);
      return null;
    }

    return data;
  }

  async saveVideo(video: {
    videoId: string;
    title: string;
    channelTitle: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    publishedAt?: string | null;
    duration?: string | null;
    viewCount?: string | null;
  }) {
    const { data, error } = await this.supabaseAdmin
      .from('youtube_videos')
      .upsert({
        videoId: video.videoId,
        title: video.title,
        channelTitle: video.channelTitle,
        description: video.description || null,
        thumbnailUrl: video.thumbnailUrl || null,
        publishedAt: video.publishedAt || null,
        duration: video.duration || null,
        viewCount: video.viewCount || null,
        downloadCount: 0
      }, { onConflict: 'videoId' })
      .select()
      .single();

    if (error) {
      console.error('ビデオ保存エラー:', error);
      return null;
    }

    return data;
  }

  async getPopularVideos(limit: number = 10) {
    const { data, error } = await this.supabase
      .from('youtube_videos')
      .select('*')
      .order('downloadCount', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('人気ビデオ取得エラー:', error);
      return [];
    }

    return data;
  }
  
  // IStorage互換メソッド - 最近の動画
  async getRecentVideos(limit: number): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('youtube_videos')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('最近の動画取得エラー:', error);
      return [];
    }

    return data;
  }

  async incrementVideoDownloadCount(videoId: string) {
    const { error } = await this.supabaseAdmin
      .rpc('increment_video_download_count', { video_id: videoId });

    if (error) {
      console.error('ダウンロードカウント更新エラー:', error);
      return false;
    }

    return true;
  }

  // IStorage互換メソッド
  async incrementDownloadCount(videoId: string): Promise<void> {
    await this.incrementVideoDownloadCount(videoId);
  }

  // ダウンロード履歴関連
  async saveDownloadHistory(history: {
    videoId: string;
    format: string;
    quality: string;
    ipAddress?: string | null;
  }) {
    const { data, error } = await this.supabaseAdmin
      .from('download_history')
      .insert({
        videoId: history.videoId,
        format: history.format,
        quality: history.quality,
        ipAddress: history.ipAddress || null,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('ダウンロード履歴保存エラー:', error);
      return null;
    }

    return data;
  }
  
  // IStorage互換メソッド
  async addDownloadHistory(record: {
    videoId: string;
    format: string;
    quality: string;
    ipAddress?: string | null;
  }): Promise<any> {
    return await this.saveDownloadHistory(record);
  }

  async getRecentDownloads(limit: number = 10) {
    const { data, error } = await this.supabase
      .from('download_history')
      .select('*, youtube_videos(*)')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('最近のダウンロード取得エラー:', error);
      return [];
    }

    return data;
  }
  
  // IStorage互換メソッド
  async getDownloadHistory(limit: number): Promise<any[]> {
    return await this.getRecentDownloads(limit);
  }

  // プロキシ履歴関連
  async saveProxyHistory(history: {
    videoId: string;
    title: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    success?: boolean | null;
  }) {
    const { data, error } = await this.supabaseAdmin
      .from('proxy_history')
      .insert({
        videoId: history.videoId,
        title: history.title,
        ipAddress: history.ipAddress || null,
        userAgent: history.userAgent || null,
        success: history.success || true,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('プロキシ履歴保存エラー:', error);
      return null;
    }

    return data;
  }
  
  // IStorage互換メソッド
  async addProxyHistory(record: {
    videoId: string;
    title: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    success?: boolean | null;
  }): Promise<any> {
    return await this.saveProxyHistory(record);
  }
  
  async getProxyHistory(limit: number): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('proxy_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('プロキシ履歴取得エラー:', error);
      return [];
    }

    return data;
  }

  // 掲示板投稿関連
  async getBoardPosts(limit: number = 50, offset: number = 0) {
    const { data, error } = await this.supabase
      .from('board_posts')
      .select('*, board_comments(count)')
      .order('createdAt', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('掲示板投稿取得エラー:', error);
      return [];
    }

    return data.map(post => ({
      ...post,
      commentCount: post.board_comments?.[0]?.count || 0
    }));
  }
  
  // IStorage互換メソッド
  async getAllBoardPosts(limit: number, offset: number): Promise<any[]> {
    return await this.getBoardPosts(limit, offset);
  }

  async getBoardPost(postId: number) {
    const { data, error } = await this.supabase
      .from('board_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) {
      console.error('掲示板投稿取得エラー:', error);
      return null;
    }

    return data;
  }

  async createBoardPost(post: {
    title: string;
    content: string;
    author: string;
    authorId: string;
    imageUrl?: string | null;
  }) {
    const now = new Date();
    const { data, error } = await this.supabaseAdmin
      .from('board_posts')
      .insert({
        title: post.title,
        content: post.content,
        author: post.author,
        authorId: post.authorId,
        imageUrl: post.imageUrl || null,
        createdAt: now,
        updatedAt: now,
        likes: 0
      })
      .select()
      .single();

    if (error) {
      console.error('掲示板投稿作成エラー:', error);
      return null;
    }

    return data;
  }

  async likeBoardPost(postId: number) {
    const { error } = await this.supabaseAdmin
      .rpc('increment_post_likes', { post_id: postId });

    if (error) {
      console.error('投稿いいねエラー:', error);
      return false;
    }

    return true;
  }
  
  // IStorage互換メソッド
  async incrementPostLikes(postId: number): Promise<void> {
    await this.likeBoardPost(postId);
  }

  async getUserPosts(authorId: string, limit: number = 50) {
    const { data, error } = await this.supabase
      .from('board_posts')
      .select('*, board_comments(count)')
      .eq('authorId', authorId)
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('ユーザー投稿取得エラー:', error);
      return [];
    }

    return data.map(post => ({
      ...post,
      commentCount: post.board_comments?.[0]?.count || 0
    }));
  }
  
  // IStorage互換メソッド
  async getUserBoardPosts(authorId: string, limit: number): Promise<any[]> {
    return await this.getUserPosts(authorId, limit);
  }

  // 掲示板コメント関連
  async getBoardComments(postId: number) {
    const { data, error } = await this.supabase
      .from('board_comments')
      .select('*')
      .eq('postId', postId)
      .order('createdAt', { ascending: true });

    if (error) {
      console.error('掲示板コメント取得エラー:', error);
      return [];
    }

    return data;
  }
  
  // IStorage互換メソッド
  async getPostComments(postId: number): Promise<any[]> {
    return await this.getBoardComments(postId);
  }

  async createBoardComment(comment: {
    postId: number;
    content: string;
    author: string;
    authorId: string;
  }) {
    const now = new Date();
    const { data, error } = await this.supabaseAdmin
      .from('board_comments')
      .insert({
        postId: comment.postId,
        content: comment.content,
        author: comment.author,
        authorId: comment.authorId,
        createdAt: now,
        likes: 0
      })
      .select()
      .single();

    if (error) {
      console.error('掲示板コメント作成エラー:', error);
      return null;
    }

    return data;
  }

  async likeBoardComment(commentId: number) {
    const { error } = await this.supabaseAdmin
      .rpc('increment_comment_likes', { comment_id: commentId });

    if (error) {
      console.error('コメントいいねエラー:', error);
      return false;
    }

    return true;
  }
  
  // IStorage互換メソッド
  async incrementCommentLikes(commentId: number): Promise<void> {
    await this.likeBoardComment(commentId);
  }

  // ユーザーロール関連
  async getUserRole(userId: string) {
    const { data, error } = await this.supabase
      .from('user_roles')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードがない場合
        return null;
      }
      console.error('ユーザーロール取得エラー:', error);
      return null;
    }

    return data;
  }

  async getAllUserRoles() {
    const { data, error } = await this.supabase
      .from('user_roles')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.error('全ユーザーロール取得エラー:', error);
      return [];
    }

    return data;
  }

  async setUserRole(userId: string, role: string) {
    const now = new Date();
    const { data, error } = await this.supabaseAdmin
      .from('user_roles')
      .upsert({
        userId,
        role,
        updatedAt: now,
        createdAt: now
      }, { onConflict: 'userId' })
      .select()
      .single();

    if (error) {
      console.error('ユーザーロール設定エラー:', error);
      return null;
    }

    return data;
  }
  
  // IStorage互換メソッド
  async saveUserRole(data: { userId: string, role: string }): Promise<void> {
    await this.setUserRole(data.userId, data.role);
  }

  async deleteUserRole(userId: string) {
    const { error } = await this.supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('userId', userId);

    if (error) {
      console.error('ユーザーロール削除エラー:', error);
      return false;
    }

    return true;
  }
  
  // IStorage互換メソッド
  async removeUserRole(userId: string): Promise<void> {
    await this.deleteUserRole(userId);
  }

  // IPアドレスBANリスト関連
  async getBannedIps() {
    const { data, error } = await this.supabase
      .from('banned_ips')
      .select('*')
      .order('bannedAt', { ascending: false });

    if (error) {
      console.error('BAN IPリスト取得エラー:', error);
      return [];
    }

    return data;
  }
  
  // IStorage互換メソッド
  async getAllBannedIps(): Promise<any[]> {
    return await this.getBannedIps();
  }

  async isIpBanned(ipAddress: string) {
    const { data, error } = await this.supabase
      .from('banned_ips')
      .select('*')
      .eq('ipAddress', ipAddress)
      .maybeSingle();

    if (error) {
      console.error('IP BAN確認エラー:', error);
      return false;
    }

    if (!data) return false;

    // 期限切れチェック
    if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
      // 期限切れなので削除
      await this.unbanIp(ipAddress);
      return false;
    }

    return true;
  }
  
  // IStorage互換メソッド
  async getBannedIp(ipAddress: string): Promise<any | undefined> {
    const { data, error } = await this.supabase
      .from('banned_ips')
      .select('*')
      .eq('ipAddress', ipAddress)
      .maybeSingle();

    if (error || !data) {
      return undefined;
    }

    return data;
  }

  async banIp(banInfo: {
    ipAddress: string;
    bannedBy: string;
    reason?: string | null;
    expiresAt?: Date | null;
  }) {
    const now = new Date();
    const { data, error } = await this.supabaseAdmin
      .from('banned_ips')
      .upsert({
        ipAddress: banInfo.ipAddress,
        bannedBy: banInfo.bannedBy,
        reason: banInfo.reason || null,
        bannedAt: now,
        expiresAt: banInfo.expiresAt || null
      }, { onConflict: 'ipAddress' })
      .select()
      .single();

    if (error) {
      console.error('IP BAN設定エラー:', error);
      return null;
    }

    return data;
  }
  
  // IStorage互換メソッド
  async addBannedIp(data: { ipAddress: string, bannedBy: string, reason?: string | null, expiresAt?: Date | null }): Promise<any> {
    return await this.banIp(data);
  }

  async unbanIp(ipAddress: string) {
    const { error } = await this.supabaseAdmin
      .from('banned_ips')
      .delete()
      .eq('ipAddress', ipAddress);

    if (error) {
      console.error('IP BAN解除エラー:', error);
      return false;
    }

    return true;
  }
  
  // IStorage互換メソッド
  async removeBannedIp(ipAddress: string): Promise<boolean> {
    return await this.unbanIp(ipAddress);
  }

  // ユーザーキック関連
  async getKickedUsers() {
    const { data, error } = await this.supabase
      .from('kicked_users')
      .select('*')
      .order('kickedAt', { ascending: false });

    if (error) {
      console.error('キックユーザーリスト取得エラー:', error);
      return [];
    }

    return data;
  }
  
  // IStorage互換メソッド
  async getKickHistory(limit: number): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('kicked_users')
      .select('*')
      .order('kickedAt', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('キック履歴取得エラー:', error);
      return [];
    }

    return data;
  }
  
  async getUserKickHistory(userId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('kicked_users')
      .select('*')
      .eq('userId', userId)
      .order('kickedAt', { ascending: false });

    if (error) {
      console.error('ユーザーキック履歴取得エラー:', error);
      return [];
    }

    return data;
  }

  async isUserKicked(userId: string) {
    const { data, error } = await this.supabase
      .from('kicked_users')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // レコードがない場合
        return false;
      }
      console.error('ユーザーキック確認エラー:', error);
      return false;
    }

    return true;
  }

  async kickUser(kickInfo: {
    userId: string;
    ipAddress: string;
    kickedBy: string;
    reason?: string | null;
  }) {
    const now = new Date();
    const { data, error } = await this.supabaseAdmin
      .from('kicked_users')
      .upsert({
        userId: kickInfo.userId,
        ipAddress: kickInfo.ipAddress,
        kickedBy: kickInfo.kickedBy,
        reason: kickInfo.reason || null,
        kickedAt: now
      }, { onConflict: 'userId' })
      .select()
      .single();

    if (error) {
      console.error('ユーザーキック設定エラー:', error);
      return null;
    }

    return data;
  }
  
  // IStorage互換メソッド
  async addKickHistory(data: { 
    userId: string, 
    ipAddress: string, 
    kickedBy: string, 
    reason?: string | null 
  }): Promise<any> {
    return await this.kickUser(data);
  }

  async unkickUser(userId: string) {
    const { error } = await this.supabaseAdmin
      .from('kicked_users')
      .delete()
      .eq('userId', userId);

    if (error) {
      console.error('ユーザーキック解除エラー:', error);
      return false;
    }

    return true;
  }
}