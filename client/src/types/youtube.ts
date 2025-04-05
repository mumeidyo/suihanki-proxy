// YouTube API response types

export interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface Thumbnails {
  default?: Thumbnail;
  medium?: Thumbnail;
  high?: Thumbnail;
  standard?: Thumbnail;
  maxres?: Thumbnail;
}

export interface VideoSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: Thumbnails;
  channelTitle: string;
  liveBroadcastContent?: string;
  publishTime?: string;
}

export interface ResourceId {
  kind: string;
  videoId: string;
}

export interface VideoId {
  kind: string;
  videoId: string;
}

export interface ContentDetails {
  duration: string;
  dimension?: string;
  definition?: string;
  caption?: string;
  licensedContent?: boolean;
  projection?: string;
}

export interface Statistics {
  viewCount: string;
  likeCount?: string;
  dislikeCount?: string;
  favoriteCount?: string;
  commentCount?: string;
}

export interface YoutubeVideoItem {
  kind: string;
  etag: string;
  id: string | VideoId;
  snippet: VideoSnippet;
  contentDetails?: ContentDetails;
  statistics?: Statistics;
}

export interface YoutubeSearchResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  regionCode?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YoutubeVideoItem[];
}

export interface YoutubeVideoDetailsResponse {
  kind: string;
  etag: string;
  items: YoutubeVideoItem[];
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

export interface DownloadFormat {
  format: string;
  quality: string;
  size?: string;
  label: string;
}
