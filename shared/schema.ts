import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// YouTube video metadata table
export const youtubeVideos = pgTable("youtube_videos", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  title: text("title").notNull(),
  channelTitle: text("channel_title").notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: text("published_at"),
  duration: text("duration"),
  viewCount: text("view_count"),
  downloadCount: integer("download_count").default(0),
});

export const insertYoutubeVideoSchema = createInsertSchema(youtubeVideos).omit({
  id: true,
});

// Download history table
export const downloadHistory = pgTable("download_history", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  format: text("format").notNull(),
  quality: text("quality").notNull(),
  timestamp: text("timestamp").notNull(),
  ipAddress: text("ip_address"),
});

export const insertDownloadHistorySchema = createInsertSchema(downloadHistory).omit({
  id: true,
});

// Proxy history table
export const proxyHistory = pgTable("proxy_history", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  title: text("title").notNull(),
  timestamp: text("timestamp").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
});

export const insertProxyHistorySchema = createInsertSchema(proxyHistory).omit({
  id: true,
});

// 掲示板投稿テーブル
export const boardPosts = pgTable("board_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  authorId: text("author_id").notNull(), // クライアントの一意識別子
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  likes: integer("likes").default(0),
  imageUrl: text("image_url"),
});

export const insertBoardPostSchema = createInsertSchema(boardPosts).omit({
  id: true,
  createdAt: true, 
  updatedAt: true,
  likes: true,
});

// 掲示板コメントテーブル
export const boardComments = pgTable("board_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  authorId: text("author_id").notNull(), // クライアントの一意識別子
  createdAt: timestamp("created_at").defaultNow().notNull(),
  likes: integer("likes").default(0),
});

export const insertBoardCommentSchema = createInsertSchema(boardComments).omit({
  id: true,
  createdAt: true,
  likes: true,
});

// Types
export type YoutubeVideo = typeof youtubeVideos.$inferSelect;
export type InsertYoutubeVideo = z.infer<typeof insertYoutubeVideoSchema>;

export type DownloadHistory = typeof downloadHistory.$inferSelect;
export type InsertDownloadHistory = z.infer<typeof insertDownloadHistorySchema>;

export type ProxyHistory = typeof proxyHistory.$inferSelect;
export type InsertProxyHistory = z.infer<typeof insertProxyHistorySchema>;

export type BoardPost = typeof boardPosts.$inferSelect;
export type InsertBoardPost = z.infer<typeof insertBoardPostSchema>;

export type BoardComment = typeof boardComments.$inferSelect;
export type InsertBoardComment = z.infer<typeof insertBoardCommentSchema>;

// For youtube search results
export const youtubeSearchSchema = z.object({
  query: z.string().min(1, "検索キーワードを入力してください"),
  type: z.enum(["video", "channel", "playlist", "all"]).default("all"),
  maxResults: z.number().default(10),
});

export type YoutubeSearchParams = z.infer<typeof youtubeSearchSchema>;

// For youtube video download
export const youtubeDownloadSchema = z.object({
  videoId: z.string().min(1, "Video ID is required"),
  format: z.enum(["mp4", "mp3"]),
  quality: z.string(),
});

export type YoutubeDownloadParams = z.infer<typeof youtubeDownloadSchema>;

// 掲示板投稿用スキーマ
export const boardPostSchema = z.object({
  title: z.string().min(1, "タイトルは必須です").max(100, "タイトルは100文字以内にしてください"),
  content: z.string().min(1, "内容は必須です").max(2000, "内容は2000文字以内にしてください"),
  author: z.string().min(1, "投稿者名は必須です").max(50, "投稿者名は50文字以内にしてください"),
  authorId: z.string().min(1, "投稿者IDは必須です"),
  imageUrl: z.string().optional(),
});

export type BoardPostParams = z.infer<typeof boardPostSchema>;

// 掲示板コメント用スキーマ
export const boardCommentSchema = z.object({
  postId: z.number().min(1, "投稿IDは必須です"),
  content: z.string().min(1, "コメントは必須です").max(500, "コメントは500文字以内にしてください"),
  author: z.string().min(1, "投稿者名は必須です").max(50, "投稿者名は50文字以内にしてください"),
  authorId: z.string().min(1, "投稿者IDは必須です"),
});

export type BoardCommentParams = z.infer<typeof boardCommentSchema>;

// ユーザー権限テーブル
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // 短いユーザーID（8文字）
  role: text("role").notNull(), // 'manager', 'leader', 'admin', 'member', 'guest'
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  updatedAt: true,
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

// ユーザー権限APIパラメータ
export const userRoleSchema = z.object({
  userId: z.string().min(1, "ユーザーIDは必須です"),
  role: z.enum(["developer", "leader", "admin", "member", "guest"]),
});

export type UserRoleParams = z.infer<typeof userRoleSchema>;

// 禁止IPアドレステーブル
export const bannedIps = pgTable("banned_ips", {
  id: serial("id").primaryKey(),
  ipAddress: text("ip_address").notNull().unique(),
  reason: text("reason"),
  bannedBy: text("banned_by").notNull(), // 禁止を実行したユーザーID
  bannedAt: timestamp("banned_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // nullの場合は無期限
});

export const insertBannedIpSchema = createInsertSchema(bannedIps).omit({
  id: true,
  bannedAt: true,
});

export type BannedIp = typeof bannedIps.$inferSelect;
export type InsertBannedIp = z.infer<typeof insertBannedIpSchema>;

// IP禁止用APIパラメータ
export const banIpSchema = z.object({
  ipAddress: z.string().min(1, "IPアドレスは必須です"),
  reason: z.string().optional(),
  bannedBy: z.string().min(1, "禁止実行者のIDは必須です"),
  expiresAt: z.string().nullable().optional(), // ISO 8601形式の日時文字列、nullまたは省略可能
});

export type BanIpParams = z.infer<typeof banIpSchema>;

// キック履歴テーブル
export const kickHistory = pgTable("kick_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // キックされたユーザーID
  ipAddress: text("ip_address").notNull(),
  reason: text("reason"),
  kickedBy: text("kicked_by").notNull(), // キックを実行したユーザーID
  kickedAt: timestamp("kicked_at").defaultNow().notNull(),
});

export const insertKickHistorySchema = createInsertSchema(kickHistory).omit({
  id: true,
  kickedAt: true,
});

export type KickHistory = typeof kickHistory.$inferSelect;
export type InsertKickHistory = z.infer<typeof insertKickHistorySchema>;

// キック用APIパラメータ
export const kickUserSchema = z.object({
  userId: z.string().min(1, "ユーザーIDは必須です"),
  ipAddress: z.string().min(1, "IPアドレスは必須です"),
  reason: z.string().optional(),
  kickedBy: z.string().min(1, "キック実行者のIDは必須です"),
});

export type KickUserParams = z.infer<typeof kickUserSchema>;
