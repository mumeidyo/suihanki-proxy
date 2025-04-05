/**
 * WebSocketクライアント
 * 
 * サーバーとのリアルタイム通信を管理するクライアント。
 * 掲示板の投稿、コメント、いいねなどのリアルタイム更新を処理します。
 */

// イベントタイプの定義
export type WebSocketEventType = 'new_post' | 'new_comment' | 'like';

// イベントリスナーの型定義
type EventListener = (data: any) => void;

// WebSocketクライアントクラス
class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<WebSocketEventType, Set<EventListener>> = new Map();
  private isConnecting: boolean = false;
  
  // シングルトンインスタンス
  private static instance: WebSocketClient;
  
  private constructor() {
    // プライベートコンストラクタ（シングルトンパターン用）
  }
  
  // シングルトンインスタンスの取得
  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }
  
  /**
   * WebSocket接続を開始
   */
  public connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN || this.isConnecting) {
      return; // すでに接続中または接続試行中
    }
    
    this.isConnecting = true;
    
    // 環境に応じたWebSocketのURLを構築
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log(`WebSocket connecting to ${wsUrl}`);
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      // 接続イベント
      this.socket.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };
      
      // メッセージ受信イベント
      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      // エラーイベント
      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
      
      // 接続切断イベント
      this.socket.onclose = () => {
        console.log('WebSocket disconnected. Reconnecting...');
        this.isConnecting = false;
        
        // 再接続を試みる
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      
      // 再接続を試みる
      if (!this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    }
  }
  
  /**
   * WebSocket接続を終了
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  /**
   * WebSocketメッセージの処理
   */
  private handleMessage(message: any): void {
    const { type, data } = message;
    
    if (!type || !data) {
      return;
    }
    
    // イベントリスナーを実行
    const listeners = this.eventListeners.get(type as WebSocketEventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${type}:`, error);
        }
      });
    }
  }
  
  /**
   * イベントリスナーの追加
   */
  public addEventListener(type: WebSocketEventType, listener: EventListener): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    
    this.eventListeners.get(type)!.add(listener);
  }
  
  /**
   * イベントリスナーの削除
   */
  public removeEventListener(type: WebSocketEventType, listener: EventListener): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

// エクスポートするシングルトンインスタンス
export const websocketClient = WebSocketClient.getInstance();