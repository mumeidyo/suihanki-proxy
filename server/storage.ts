import { 
  youtubeVideos, 
  downloadHistory, 
  proxyHistory,
  boardPosts,
  boardComments,
  userRoles,
  bannedIps,
  kickHistory,
  type YoutubeVideo, 
  type InsertYoutubeVideo,
  type DownloadHistory,
  type InsertDownloadHistory,
  type ProxyHistory,
  type InsertProxyHistory,
  type BoardPost,
  type InsertBoardPost,
  type BoardComment,
  type InsertBoardComment,
  type BannedIp,
  type InsertBannedIp,
  type KickHistory,
  type InsertKickHistory
} from "@shared/schema";
import { eq, desc, sql, lt, gt, and, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
const { Pool } = pg;

// Interface for storage operations
export interface IStorage {
  // YouTube Videos
  getVideo(videoId: string): Promise<YoutubeVideo | undefined>;
  saveVideo(video: InsertYoutubeVideo): Promise<YoutubeVideo>;
  incrementDownloadCount(videoId: string): Promise<void>;
  
  // Download History
  addDownloadHistory(record: InsertDownloadHistory): Promise<DownloadHistory>;
  getDownloadHistory(limit: number): Promise<DownloadHistory[]>;
  
  // Proxy History
  addProxyHistory(record: InsertProxyHistory): Promise<ProxyHistory>;
  getProxyHistory(limit: number): Promise<ProxyHistory[]>;
  
  // New methods for enhanced functionality
  getRecentVideos(limit: number): Promise<YoutubeVideo[]>;
  getPopularVideos(limit: number): Promise<YoutubeVideo[]>;
  
  // 掲示板関連のメソッド
  // 投稿の作成・取得
  createBoardPost(post: InsertBoardPost): Promise<BoardPost>;
  getBoardPost(postId: number): Promise<BoardPost | undefined>;
  getAllBoardPosts(limit: number, offset: number): Promise<BoardPost[]>;
  getUserBoardPosts(authorId: string, limit: number): Promise<BoardPost[]>;
  
  // コメントの作成・取得
  createBoardComment(comment: InsertBoardComment): Promise<BoardComment>;
  getPostComments(postId: number): Promise<BoardComment[]>;
  
  // いいね機能
  incrementPostLikes(postId: number): Promise<void>;
  incrementCommentLikes(commentId: number): Promise<void>;
  
  // ユーザー権限関連のメソッド
  getUserRole(userId: string): Promise<{ role: string } | undefined>;
  saveUserRole(data: { userId: string, role: string }): Promise<void>;
  removeUserRole(userId: string): Promise<void>;
  getAllUserRoles(): Promise<{ userId: string, role: string }[]>;
  
  // 禁止IPアドレス関連のメソッド
  getBannedIp(ipAddress: string): Promise<BannedIp | undefined>;
  addBannedIp(data: InsertBannedIp): Promise<BannedIp>;
  removeBannedIp(ipAddress: string): Promise<boolean>;
  getAllBannedIps(): Promise<BannedIp[]>;
  
  // キック関連のメソッド
  addKickHistory(data: InsertKickHistory): Promise<KickHistory>;
  getKickHistory(limit: number): Promise<KickHistory[]>;
  getUserKickHistory(userId: string): Promise<KickHistory[]>;
  
  // IPアドレスが禁止されているかチェック（期限切れも考慮）
  isIpBanned(ipAddress: string): Promise<boolean>;
}

// Memory storage implementation (fallback if database is not available)
export class MemStorage implements IStorage {
  private videos: Map<string, YoutubeVideo>;
  private downloads: DownloadHistory[];
  private proxies: ProxyHistory[];
  private boardPosts: Map<number, BoardPost>;
  private boardComments: Map<number, BoardComment>;
  private userRoles: Map<string, { userId: string, role: string }>;
  private bannedIps: Map<string, BannedIp>;
  private kickHistories: KickHistory[];
  private videoIdCounter: number;
  private downloadIdCounter: number;
  private proxyIdCounter: number;
  private boardPostIdCounter: number;
  private boardCommentIdCounter: number;
  private bannedIpIdCounter: number;
  private kickHistoryIdCounter: number;

  constructor() {
    this.videos = new Map();
    this.downloads = [];
    this.proxies = [];
    this.boardPosts = new Map();
    this.boardComments = new Map();
    this.userRoles = new Map();
    this.bannedIps = new Map();
    this.kickHistories = [];
    this.videoIdCounter = 1;
    this.downloadIdCounter = 1;
    this.proxyIdCounter = 1;
    this.boardPostIdCounter = 1;
    this.boardCommentIdCounter = 1;
    this.bannedIpIdCounter = 1;
    this.kickHistoryIdCounter = 1;
  }

  async getVideo(videoId: string): Promise<YoutubeVideo | undefined> {
    return Array.from(this.videos.values()).find(video => video.videoId === videoId);
  }

  async saveVideo(video: InsertYoutubeVideo): Promise<YoutubeVideo> {
    const existingVideo = await this.getVideo(video.videoId);
    
    if (existingVideo) {
      return existingVideo;
    }
    
    const id = this.videoIdCounter++;
    const newVideo: YoutubeVideo = { ...video, id, downloadCount: 0 };
    this.videos.set(video.videoId, newVideo);
    return newVideo;
  }

  async incrementDownloadCount(videoId: string): Promise<void> {
    const video = await this.getVideo(videoId);
    if (video) {
      video.downloadCount = (video.downloadCount || 0) + 1;
      this.videos.set(videoId, video);
    }
  }

  async addDownloadHistory(record: InsertDownloadHistory): Promise<DownloadHistory> {
    const id = this.downloadIdCounter++;
    const newRecord: DownloadHistory = { ...record, id };
    this.downloads.push(newRecord);
    return newRecord;
  }

  async getDownloadHistory(limit: number): Promise<DownloadHistory[]> {
    return this.downloads.slice(-limit);
  }

  async addProxyHistory(record: InsertProxyHistory): Promise<ProxyHistory> {
    const id = this.proxyIdCounter++;
    const newRecord: ProxyHistory = { ...record, id };
    this.proxies.push(newRecord);
    return newRecord;
  }

  async getProxyHistory(limit: number): Promise<ProxyHistory[]> {
    return this.proxies.slice(-limit);
  }
  
  async getRecentVideos(limit: number): Promise<YoutubeVideo[]> {
    return Array.from(this.videos.values())
      .sort((a, b) => b.id - a.id)
      .slice(0, limit);
  }
  
  async getPopularVideos(limit: number): Promise<YoutubeVideo[]> {
    return Array.from(this.videos.values())
      .sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
      .slice(0, limit);
  }
  
  // 掲示板関連のメソッド
  async createBoardPost(post: InsertBoardPost): Promise<BoardPost> {
    const id = this.boardPostIdCounter++;
    const now = new Date();
    const newPost: BoardPost = {
      ...post,
      id,
      createdAt: now,
      updatedAt: now,
      likes: 0
    };
    this.boardPosts.set(id, newPost);
    return newPost;
  }
  
  async getBoardPost(postId: number): Promise<BoardPost | undefined> {
    return this.boardPosts.get(postId);
  }
  
  async getAllBoardPosts(limit: number, offset: number): Promise<BoardPost[]> {
    return Array.from(this.boardPosts.values())
      .sort((a, b) => {
        // 最新の投稿を優先（日付の降順）
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(offset, offset + limit);
  }
  
  async getUserBoardPosts(authorId: string, limit: number): Promise<BoardPost[]> {
    return Array.from(this.boardPosts.values())
      .filter(post => post.authorId === authorId)
      .sort((a, b) => {
        // 最新の投稿を優先
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }
  
  async createBoardComment(comment: InsertBoardComment): Promise<BoardComment> {
    const id = this.boardCommentIdCounter++;
    const now = new Date();
    const newComment: BoardComment = {
      ...comment,
      id,
      createdAt: now,
      likes: 0
    };
    this.boardComments.set(id, newComment);
    return newComment;
  }
  
  async getPostComments(postId: number): Promise<BoardComment[]> {
    return Array.from(this.boardComments.values())
      .filter(comment => comment.postId === postId)
      .sort((a, b) => {
        // 古いコメントを優先（日付の昇順）
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateA - dateB;
      });
  }
  
  async incrementPostLikes(postId: number): Promise<void> {
    const post = this.boardPosts.get(postId);
    if (post) {
      post.likes = (post.likes || 0) + 1;
      this.boardPosts.set(postId, post);
    }
  }
  
  async incrementCommentLikes(commentId: number): Promise<void> {
    const comment = this.boardComments.get(commentId);
    if (comment) {
      comment.likes = (comment.likes || 0) + 1;
      this.boardComments.set(commentId, comment);
    }
  }
  
  // ユーザー権限関連のメソッド実装
  async getUserRole(userId: string): Promise<{ role: string } | undefined> {
    const userRole = this.userRoles.get(userId);
    return userRole ? { role: userRole.role } : undefined;
  }
  
  async saveUserRole(data: { userId: string, role: string }): Promise<void> {
    console.log(`サーバー: ユーザー権限を保存します - ${data.userId}: ${data.role}`);
    this.userRoles.set(data.userId, data);
  }
  
  async removeUserRole(userId: string): Promise<void> {
    console.log(`サーバー: ユーザー権限を削除します - ${userId}`);
    this.userRoles.delete(userId);
  }
  
  async getAllUserRoles(): Promise<{ userId: string, role: string }[]> {
    return Array.from(this.userRoles.values());
  }

  // 禁止IPアドレス関連のメソッド実装
  async getBannedIp(ipAddress: string): Promise<BannedIp | undefined> {
    return this.bannedIps.get(ipAddress);
  }

  async addBannedIp(data: InsertBannedIp): Promise<BannedIp> {
    const id = this.bannedIpIdCounter++;
    const now = new Date();
    const bannedIp: BannedIp = {
      ...data,
      id,
      bannedAt: now
    };
    this.bannedIps.set(data.ipAddress, bannedIp);
    return bannedIp;
  }

  async removeBannedIp(ipAddress: string): Promise<boolean> {
    return this.bannedIps.delete(ipAddress);
  }

  async getAllBannedIps(): Promise<BannedIp[]> {
    return Array.from(this.bannedIps.values());
  }

  // キック関連のメソッド実装
  async addKickHistory(data: InsertKickHistory): Promise<KickHistory> {
    const id = this.kickHistoryIdCounter++;
    const now = new Date();
    const kickHistory: KickHistory = {
      ...data,
      id,
      kickedAt: now
    };
    this.kickHistories.push(kickHistory);
    return kickHistory;
  }

  async getKickHistory(limit: number): Promise<KickHistory[]> {
    return this.kickHistories
      .sort((a, b) => {
        const dateA = new Date(a.kickedAt).getTime();
        const dateB = new Date(b.kickedAt).getTime();
        return dateB - dateA;
      })
      .slice(0, limit);
  }

  async getUserKickHistory(userId: string): Promise<KickHistory[]> {
    return this.kickHistories
      .filter(kick => kick.userId === userId)
      .sort((a, b) => {
        const dateA = new Date(a.kickedAt).getTime();
        const dateB = new Date(b.kickedAt).getTime();
        return dateB - dateA;
      });
  }

  // IPアドレスが禁止されているかチェック（期限切れも考慮）
  async isIpBanned(ipAddress: string): Promise<boolean> {
    const bannedIp = this.bannedIps.get(ipAddress);
    if (!bannedIp) return false;
    
    // 無期限の場合
    if (!bannedIp.expiresAt) return true;
    
    // 期限切れをチェック
    const now = new Date();
    const expiryDate = new Date(bannedIp.expiresAt);
    return now < expiryDate;
  }
}

// PostgreSQL storage implementation
export class PostgresStorage implements IStorage {
  private db: any;
  private pool: typeof Pool;

  constructor() {
    try {
      // 環境変数からDB接続文字列を取得、またはハードコード値をバックアップとして使用
      const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';
      
      console.log('データベース接続を試みます...');
      
      this.pool = new Pool({
        connectionString,
        // DNSルックアップタイムアウトを短く設定
        connectionTimeoutMillis: 5000,
        // 接続失敗後の再試行なし
        max: 3
      });
      
      this.db = drizzle(this.pool);
      
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle database client', err);
      });
      
      console.log("PostgreSQL storage initialized");
    } catch (error) {
      console.error("Failed to initialize PostgreSQL storage:", error);
      throw error;
    }
  }

  async getVideo(videoId: string): Promise<YoutubeVideo | undefined> {
    try {
      const results = await this.db.select().from(youtubeVideos).where(eq(youtubeVideos.videoId, videoId));
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error("Error getting video:", error);
      return undefined;
    }
  }

  async saveVideo(video: InsertYoutubeVideo): Promise<YoutubeVideo> {
    try {
      // Check if video already exists
      const existing = await this.getVideo(video.videoId);
      if (existing) {
        return existing;
      }
      
      // Insert new video
      const result = await this.db.insert(youtubeVideos).values({
        ...video,
        downloadCount: 0
      }).returning();
      
      return result[0];
    } catch (error) {
      console.error("Error saving video:", error);
      throw error;
    }
  }

  async incrementDownloadCount(videoId: string): Promise<void> {
    try {
      await this.db
        .update(youtubeVideos)
        .set({ 
          downloadCount: sql`${youtubeVideos.downloadCount} + 1` 
        })
        .where(eq(youtubeVideos.videoId, videoId));
    } catch (error) {
      console.error("Error incrementing download count:", error);
    }
  }

  async addDownloadHistory(record: InsertDownloadHistory): Promise<DownloadHistory> {
    try {
      const result = await this.db.insert(downloadHistory).values(record).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding download history:", error);
      throw error;
    }
  }

  async getDownloadHistory(limit: number): Promise<DownloadHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(downloadHistory)
        .orderBy(desc(downloadHistory.id))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting download history:", error);
      return [];
    }
  }
  
  async addProxyHistory(record: InsertProxyHistory): Promise<ProxyHistory> {
    try {
      const result = await this.db.insert(proxyHistory).values(record).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding proxy history:", error);
      throw error;
    }
  }
  
  async getProxyHistory(limit: number): Promise<ProxyHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(proxyHistory)
        .orderBy(desc(proxyHistory.id))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting proxy history:", error);
      return [];
    }
  }
  
  async getRecentVideos(limit: number): Promise<YoutubeVideo[]> {
    try {
      const results = await this.db
        .select()
        .from(youtubeVideos)
        .orderBy(desc(youtubeVideos.id))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting recent videos:", error);
      return [];
    }
  }
  
  async getPopularVideos(limit: number): Promise<YoutubeVideo[]> {
    try {
      const results = await this.db
        .select()
        .from(youtubeVideos)
        .orderBy(desc(youtubeVideos.downloadCount))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting popular videos:", error);
      return [];
    }
  }
  
  // 掲示板関連のメソッド実装（PostgreSQL）
  async createBoardPost(post: InsertBoardPost): Promise<BoardPost> {
    try {
      const result = await this.db.insert(boardPosts).values({
        ...post,
        createdAt: new Date(),
        updatedAt: new Date(),
        likes: 0
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating board post:", error);
      throw error;
    }
  }
  
  async getBoardPost(postId: number): Promise<BoardPost | undefined> {
    try {
      const results = await this.db
        .select()
        .from(boardPosts)
        .where(eq(boardPosts.id, postId));
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error("Error getting board post:", error);
      return undefined;
    }
  }
  
  async getAllBoardPosts(limit: number, offset: number): Promise<BoardPost[]> {
    try {
      const results = await this.db
        .select()
        .from(boardPosts)
        .orderBy(desc(boardPosts.createdAt))
        .limit(limit)
        .offset(offset);
      return results;
    } catch (error) {
      console.error("Error getting all board posts:", error);
      return [];
    }
  }
  
  async getUserBoardPosts(authorId: string, limit: number): Promise<BoardPost[]> {
    try {
      const results = await this.db
        .select()
        .from(boardPosts)
        .where(eq(boardPosts.authorId, authorId))
        .orderBy(desc(boardPosts.createdAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting user board posts:", error);
      return [];
    }
  }
  
  async createBoardComment(comment: InsertBoardComment): Promise<BoardComment> {
    try {
      const result = await this.db.insert(boardComments).values({
        ...comment,
        createdAt: new Date(),
        likes: 0
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error creating board comment:", error);
      throw error;
    }
  }
  
  async getPostComments(postId: number): Promise<BoardComment[]> {
    try {
      const results = await this.db
        .select()
        .from(boardComments)
        .where(eq(boardComments.postId, postId))
        .orderBy(boardComments.createdAt);
      return results;
    } catch (error) {
      console.error("Error getting post comments:", error);
      return [];
    }
  }
  
  async incrementPostLikes(postId: number): Promise<void> {
    try {
      await this.db
        .update(boardPosts)
        .set({ 
          likes: sql`${boardPosts.likes} + 1` 
        })
        .where(eq(boardPosts.id, postId));
    } catch (error) {
      console.error("Error incrementing post likes:", error);
    }
  }
  
  async incrementCommentLikes(commentId: number): Promise<void> {
    try {
      await this.db
        .update(boardComments)
        .set({ 
          likes: sql`${boardComments.likes} + 1` 
        })
        .where(eq(boardComments.id, commentId));
    } catch (error) {
      console.error("Error incrementing comment likes:", error);
    }
  }
  
  // ユーザー権限関連のメソッド実装（PostgreSQL）
  async getUserRole(userId: string): Promise<{ role: string } | undefined> {
    try {
      const results = await this.db
        .select()
        .from(userRoles)
        .where(eq(userRoles.userId, userId));
      if (results.length > 0) {
        return { role: results[0].role };
      }
      return undefined;
    } catch (error) {
      console.error("Error getting user role:", error);
      return undefined;
    }
  }
  
  async saveUserRole(data: { userId: string, role: string }): Promise<void> {
    try {
      console.log(`サーバー (PostgreSQL): ユーザー権限を保存します - ${data.userId}: ${data.role}`);
      
      // Check if role exists
      const existing = await this.getUserRole(data.userId);
      
      if (existing) {
        // Update existing role
        await this.db
          .update(userRoles)
          .set({ 
            role: data.role,
            updatedAt: new Date() 
          })
          .where(eq(userRoles.userId, data.userId));
      } else {
        // Insert new role
        await this.db.insert(userRoles).values({
          userId: data.userId,
          role: data.role,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error saving user role:", error);
    }
  }
  
  async removeUserRole(userId: string): Promise<void> {
    try {
      console.log(`サーバー (PostgreSQL): ユーザー権限を削除します - ${userId}`);
      await this.db
        .delete(userRoles)
        .where(eq(userRoles.userId, userId));
    } catch (error) {
      console.error("Error removing user role:", error);
    }
  }
  
  async getAllUserRoles(): Promise<{ userId: string, role: string }[]> {
    try {
      const results = await this.db
        .select({
          userId: userRoles.userId,
          role: userRoles.role
        })
        .from(userRoles);
      return results;
    } catch (error) {
      console.error("Error getting all user roles:", error);
      return [];
    }
  }

  // 禁止IPアドレス関連のメソッド実装（PostgreSQL）
  async getBannedIp(ipAddress: string): Promise<BannedIp | undefined> {
    try {
      const results = await this.db
        .select()
        .from(bannedIps)
        .where(eq(bannedIps.ipAddress, ipAddress));
      return results.length > 0 ? results[0] : undefined;
    } catch (error) {
      console.error("Error getting banned IP:", error);
      return undefined;
    }
  }

  async addBannedIp(data: InsertBannedIp): Promise<BannedIp> {
    try {
      const result = await this.db.insert(bannedIps).values({
        ...data,
        bannedAt: new Date()
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding banned IP:", error);
      throw error;
    }
  }

  async removeBannedIp(ipAddress: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(bannedIps)
        .where(eq(bannedIps.ipAddress, ipAddress))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error removing banned IP:", error);
      return false;
    }
  }

  async getAllBannedIps(): Promise<BannedIp[]> {
    try {
      const results = await this.db
        .select()
        .from(bannedIps)
        .orderBy(desc(bannedIps.bannedAt));
      return results;
    } catch (error) {
      console.error("Error getting all banned IPs:", error);
      return [];
    }
  }

  // キック関連のメソッド実装（PostgreSQL）
  async addKickHistory(data: InsertKickHistory): Promise<KickHistory> {
    try {
      const result = await this.db.insert(kickHistory).values({
        ...data,
        kickedAt: new Date()
      }).returning();
      return result[0];
    } catch (error) {
      console.error("Error adding kick history:", error);
      throw error;
    }
  }

  async getKickHistory(limit: number): Promise<KickHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(kickHistory)
        .orderBy(desc(kickHistory.kickedAt))
        .limit(limit);
      return results;
    } catch (error) {
      console.error("Error getting kick history:", error);
      return [];
    }
  }

  async getUserKickHistory(userId: string): Promise<KickHistory[]> {
    try {
      const results = await this.db
        .select()
        .from(kickHistory)
        .where(eq(kickHistory.userId, userId))
        .orderBy(desc(kickHistory.kickedAt));
      return results;
    } catch (error) {
      console.error("Error getting user kick history:", error);
      return [];
    }
  }

  // IPアドレスが禁止されているかチェック（期限切れも考慮）
  async isIpBanned(ipAddress: string): Promise<boolean> {
    try {
      // DNSリゾルーションエラーやその他のデータベース接続問題をより適切に処理
      try {
        // 接続テスト - すべてのエラーをキャッチ
        const client = await this.pool.connect();
        
        try {
          await client.query('SELECT 1');
          client.release();
        } catch (queryError) {
          client.release(true); // エラーでリリース
          throw queryError;
        }
      } catch (connectionError) {
        // より詳細なエラーログ記録
        console.error("データベース接続エラー、IP禁止チェックをスキップします:", connectionError);
        console.log("エラーの詳細:", connectionError.message);
        
        if (connectionError.message && connectionError.message.includes('getaddrinfo ENOTFOUND')) {
          console.log("DNSリゾルーションエラーが検出されました。インターネット接続またはDNS設定を確認してください。");
        }
        
        // 接続エラーの場合は禁止されていないと見なす（より寛容なアプローチ）
        return false;
      }
      
      try {
        // 無期限のIPアドレス禁止を検索
        const indefiniteBan = await this.db
          .select()
          .from(bannedIps)
          .where(and(
            eq(bannedIps.ipAddress, ipAddress),
            isNull(bannedIps.expiresAt)
          ));
        
        if (indefiniteBan.length > 0) {
          return true;
        }
        
        // 期限付きのIP禁止を検索（現在時刻よりも後に期限が切れるもの）
        const now = new Date();
        const activeBan = await this.db
          .select()
          .from(bannedIps)
          .where(and(
            eq(bannedIps.ipAddress, ipAddress),
            gt(bannedIps.expiresAt, now)
          ));
        
        return activeBan.length > 0;
      } catch (dbQueryError) {
        console.error("IP禁止リストの検索中にエラーが発生しました:", dbQueryError);
        // クエリエラーの場合も、禁止されていないと見なす
        return false;
      }
    } catch (error) {
      console.error("IP禁止チェック中の致命的なエラー:", error);
      // エラーが発生した場合は禁止されていないと見なす（デフォルトで許可）
      return false;
    }
  }
}

// Initialize and export the storage
// プライベート変数 - モジュール内部のストレージインスタンス
let _storage: IStorage;

// Supabaseストレージのインポート
import { SupabaseStorage } from './supabase-storage';

// ストレージの初期化関数
export async function initializeStorage(): Promise<IStorage> {
  // すでに初期化されていればそのまま返す
  if (_storage) {
    return _storage;
  }

  // 環境変数から接続情報を取得
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  
  // 環境判定（Replit、Render、その他ローカル環境）
  const deployEnv = process.env.DEPLOY_ENV || 
    (process.env.REPL_ID ? 'replit' : 
     process.env.RENDER ? 'render' : 'local');
  
  console.log(`実行環境: ${deployEnv}`);

  // Render環境またはデータベースURLが空の場合
  if (deployEnv === 'render' || !databaseUrl) {
    console.log('⚠️ Render環境または設定ファイルなしで実行中です。PostgreSQLは使用できないため、メモリストレージを使用します。');
    _storage = new MemStorage();
    return _storage;
  }
  
  // Replit環境またはその他の環境でデータベースURLが設定されている場合
  if (databaseUrl) {
    console.log('データベースURLが設定されています。PostgreSQLに接続を試みます...');
    try {
      _storage = new PostgresStorage();
      
      // 接続テスト
      try {
        // @ts-ignore - 型チェックを無視
        const testClient = await (_storage as PostgresStorage).pool.connect();
        try {
          await testClient.query('SELECT 1');
          testClient.release();
          console.log('✅ PostgreSQL接続が正常に動作しています');
          console.log('PostgreSQL storage initialized');
          return _storage;
        } catch (queryError) {
          testClient.release(true); // エラーでリリース
          throw queryError;
        }
      } catch (connectionTestError) {
        console.error('PostgreSQL接続テストに失敗しました:', connectionTestError);
        if (connectionTestError.message) {
          console.error('エラー詳細:', connectionTestError.message);
        }
        throw connectionTestError;
      }
    } catch (dbError) {
      console.error('PostgreSQLデータベース接続エラー:', dbError);
      // エラーの詳細分析
      if (dbError.message) {
        if (dbError.message.includes('ENOTFOUND')) {
          console.error('DNSリゾルーションエラー - ホスト名が見つかりません');
        } else if (dbError.message.includes('ETIMEDOUT')) {
          console.error('接続タイムアウト - サーバーが応答していません');
        } else if (dbError.message.includes('ECONNREFUSED')) {
          console.error('接続拒否 - サーバーが接続を拒否しました');
        }
      }
      console.warn('⚠️ PostgreSQL接続に失敗しました。メモリストレージにフォールバックします。');
    }
  } else {
    console.log('データベースURLが設定されていません。');
  }
  
  // Supabase環境変数がある場合は試行
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || '';
  
  if (SupabaseStorage && supabaseUrl && supabaseKey && !_storage) {
    console.log('Supabase環境変数が設定されています。Supabaseストレージを初期化します...');
    try {
      _storage = new SupabaseStorage();
      console.log('✅ Supabaseストレージを初期化しました');
      return _storage;
    } catch (supabaseError) {
      console.error('Supabaseストレージの初期化に失敗しました:', supabaseError);
      if (supabaseError.message) {
        console.error('エラー詳細:', supabaseError.message);
      }
      console.warn('Supabase接続に失敗しました。別のストレージ方法を試行します...');
    }
  }
  
  // 全ての接続が失敗した場合、メモリストレージにフォールバック
  if (!_storage) {
    console.log('メモリストレージにフォールバックします（再起動するとデータが失われます）');
    _storage = new MemStorage();
  }
  
  return _storage;
}

// 互換性のために古い実装を保持しつつ、エラー処理を強化
try {
  // Try to create PostgreSQL storage (レガシー方式)
  try {
    _storage = new PostgresStorage();
    console.log("Using PostgreSQL storage (legacy initialization)");
    
    // 接続が本当に機能しているか確認する追加テスト
    setTimeout(async () => {
      try {
        // @ts-ignore - 型エラーを無視
        await (_storage as PostgresStorage).pool.query('SELECT 1');
        console.log("PostgreSQL接続が正常に動作していることを確認しました");
      } catch (testError) {
        console.error("PostgreSQL接続テストに失敗しました。メモリストレージに切り替えます:", testError);
        _storage = new MemStorage();
        console.log("メモリストレージへの切り替えが完了しました");
      }
    }, 1000);
    
  } catch (pgError) {
    // PostgreSQL初期化に失敗した場合の詳細ログ
    console.error("PostgreSQL初期化エラー:", pgError);
    console.warn("PostgreSQL初期化に失敗しました。メモリストレージにフォールバックします");
    _storage = new MemStorage();
  }
} catch (error) {
  // キャッチできなかった何らかのエラーに対する安全策
  console.error("予期しないエラーが発生しました:", error);
  console.warn("予期しないエラーにより、メモリストレージにフォールバックします");
  _storage = new MemStorage();
}

// 古いコードとの互換性のためにエクスポート
export const storage = _storage;
