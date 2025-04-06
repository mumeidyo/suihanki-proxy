// Type declarations for external modules without type definitions

declare module 'yt-search' {
  interface VideoResult {
    videoId: string;
    title: string;
    author: {
      name: string;
      channelId: string;
    };
    thumbnail: string;
    duration: string | {
      seconds: number;
      timestamp: string;
    };
    description: string;
    published: string;
  }
  
  interface SearchResult {
    videos: VideoResult[];
    playlists: any[];
    accounts: any[];
    channels: any[];
    live: any[];
    all: any[];
  }
  
  function ytSearch(options: string | { query: string; pages?: number }): Promise<SearchResult>;
  
  export = ytSearch;
}

declare module 'ytmusic-api' {
  class YTMusic {
    constructor();
    searchSongs(query: string): Promise<any[]>;
    searchAlbums(query: string): Promise<any[]>;
    searchArtists(query: string): Promise<any[]>;
    searchPlaylists(query: string): Promise<any[]>;
  }
  
  export = YTMusic;
}