/**
 * 権限管理サービス
 * 
 * リーダー、管理者、メンバーの権限を管理するためのユーティリティ
 * API完全依存型実装
 */
import { apiRequest } from "../lib/queryClient";

// 権限の種類
export type UserRole = 'developer' | 'leader' | 'admin' | 'member' | 'guest';

// 権限の優先順位マップ（数値が大きいほど権限が高い）
export const ROLE_PRIORITY: Record<UserRole, number> = {
  'developer': 40,
  'leader': 30,
  'admin': 20,
  'member': 10,
  'guest': 0
};

// 権限の表示名
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  'developer': '開発者',
  'leader': 'リーダー',
  'admin': 'アドミン',
  'member': 'メンバー',
  'guest': 'ゲスト'
};

// 権限のカラー
export const ROLE_COLORS: Record<UserRole, string> = {
  'developer': 'text-red-600 dark:text-red-500 bg-red-100 dark:bg-red-900/30',
  'leader': 'text-purple-500 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30', 
  'admin': 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  'member': 'text-green-500 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  'guest': 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
};

// キャッシュ機能
interface RoleCache {
  roles: Map<string, UserRole>;
  lastUpdated: number;
}

// ユーザー役割のレスポンス型
interface UserRoleResponse {
  userId: string;
  role: string;
}

// キャッシュ有効期間（ミリ秒）
const CACHE_TTL = 60 * 1000; // 1分間

// イベントタイプ
type RoleEventType = 'role_changed';

// 権限マネージャークラス
class RoleManager {
  private eventListeners: Map<RoleEventType, Set<Function>> = new Map();
  private roleCache: RoleCache = {
    roles: new Map<string, UserRole>(),
    lastUpdated: 0
  };
  
  constructor() {
    // デフォルトの開発者権限
    this.roleCache.roles.set('Z3wp8i3q', 'developer'); // mumeikanridayo シードの最高管理者権限
  }
  
  // イベントリスナーを追加
  addEventListener(type: RoleEventType, listener: Function): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type)?.add(listener);
  }
  
  // イベントリスナーを削除
  removeEventListener(type: RoleEventType, listener: Function): void {
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type)?.delete(listener);
    }
  }
  
  // イベントを発火
  private dispatchEvent(type: RoleEventType, data: any): void {
    console.log(`RoleManager - イベント発火: ${type}`, data);
    if (this.eventListeners.has(type)) {
      const listeners = this.eventListeners.get(type);
      console.log(`RoleManager - リスナー数: ${listeners?.size || 0}`);
      listeners?.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // キャッシュが有効かチェック
  private isCacheValid(): boolean {
    return (Date.now() - this.roleCache.lastUpdated) < CACHE_TTL;
  }

  // キャッシュをリフレッシュ
  private refreshCache(): void {
    this.fetchAllRolesFromServer()
      .catch(err => console.error('Failed to refresh role cache:', err));
  }

  // ユーザーIDから権限を取得（非同期版）
  async getUserRoleAsync(userId: string): Promise<UserRole> {
    if (!userId) return 'guest';
    
    const shortId = userId.substring(0, 8);
    
    // 開発者シードIDの場合は即時返す
    if (shortId === 'Z3wp8i3q') return 'developer';
    
    // キャッシュチェック
    if (this.roleCache.roles.has(shortId) && this.isCacheValid()) {
      return this.roleCache.roles.get(shortId) || 'member';
    }
    
    try {
      // APIから取得
      const response = await fetch(`/api/roles/${shortId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const role = data.data.role as UserRole;
          if (this.isValidRole(role)) {
            // キャッシュに保存
            this.roleCache.roles.set(shortId, role);
            return role;
          }
        }
      }
      
      // デフォルト
      return 'member';
    } catch (error) {
      console.error('Failed to fetch user role:', error);
      return 'member';
    }
  }

  // ユーザーIDから権限を取得（同期版 - キャッシュのみ）
  getUserRole(userId: string): UserRole {
    if (!userId) return 'guest';
    
    const shortId = userId.substring(0, 8);
    
    // 開発者シードIDの場合は即時返す
    if (shortId === 'Z3wp8i3q') return 'developer';
    
    // キャッシュチェック
    if (this.roleCache.roles.has(shortId)) {
      return this.roleCache.roles.get(shortId) || 'member';
    }
    
    // キャッシュにない場合はバックグラウンドで更新
    if (!this.isCacheValid()) {
      this.refreshCache();
    }
    
    return 'member'; // デフォルト値
  }

  // ユーザーに権限を付与
  async assignRole(userId: string, role: UserRole): Promise<boolean> {
    if (!userId) return false;
    
    const shortId = userId.substring(0, 8);
    
    // サーバーに保存
    const success = await this.saveRoleToServer(shortId, role);
    
    if (success) {
      // キャッシュに保存
      this.roleCache.roles.set(shortId, role);
      
      // ロール変更イベントをディスパッチ
      this.dispatchEvent('role_changed', { id: shortId, role });
    }
    
    return success;
  }

  // ユーザーの権限を削除
  async removeRole(userId: string): Promise<boolean> {
    if (!userId) return false;
    
    const shortId = userId.substring(0, 8);
    
    // 開発者シードIDは削除できない
    if (shortId === 'Z3wp8i3q') return false;
    
    // サーバーから削除
    const success = await this.removeRoleFromServer(shortId);
    
    if (success) {
      // キャッシュから削除
      this.roleCache.roles.delete(shortId);
      
      // ロール変更イベントをディスパッチ
      this.dispatchEvent('role_changed', { id: shortId, role: 'member' });
    }
    
    return success;
  }

  // 指定した権限を持っているかチェック
  async hasRoleAsync(userId: string, role: UserRole): Promise<boolean> {
    const userRole = await this.getUserRoleAsync(userId);
    return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[role];
  }

  // 指定した権限を持っているかチェック（同期版 - キャッシュのみ）
  hasRole(userId: string, role: UserRole): boolean {
    const userRole = this.getUserRole(userId);
    return ROLE_PRIORITY[userRole] >= ROLE_PRIORITY[role];
  }

  // リーダー権限を持っているかチェック
  isLeader(userId: string): boolean {
    return this.hasRole(userId, 'leader');
  }

  // 管理者以上の権限を持っているかチェック
  isAdmin(userId: string): boolean {
    return this.hasRole(userId, 'admin');
  }

  // メンバー以上の権限を持っているかチェック
  isMember(userId: string): boolean {
    return this.hasRole(userId, 'member');
  }

  // 開発者（最高権限）かどうかをチェック
  isDeveloper(userId: string): boolean {
    return this.hasRole(userId, 'developer');
  }

  // 権限の表示名を取得
  getRoleDisplayName(role: UserRole): string {
    return ROLE_DISPLAY_NAMES[role] || '一般';
  }

  // 権限のカラークラスを取得
  getRoleColorClass(role: UserRole): string {
    return ROLE_COLORS[role] || '';
  }
  
  // 管理対象の全ユーザーを取得
  async getAllManagedUsers(): Promise<{ id: string, role: UserRole }[]> {
    // キャッシュが古い場合は更新
    if (!this.isCacheValid()) {
      await this.fetchAllRolesFromServer();
    }
    
    const users: { id: string, role: UserRole }[] = [];
    this.roleCache.roles.forEach((role, id) => {
      users.push({ id, role });
    });
    return users;
  }
  
  // 有効な権限値かチェック
  private isValidRole(role: any): role is UserRole {
    return ['developer', 'leader', 'admin', 'member', 'guest'].includes(role);
  }
  
  // サーバーから全ユーザーの権限を取得
  async fetchAllRolesFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/roles');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // 既存のロールをクリア（シード権限を除く）
          const seed = this.roleCache.roles.get('Z3wp8i3q');
          this.roleCache.roles.clear();
          if (seed) this.roleCache.roles.set('Z3wp8i3q', seed);
          
          // サーバーからのロールを設定
          data.data.forEach((userRole: UserRoleResponse) => {
            if (this.isValidRole(userRole.role as UserRole)) {
              this.roleCache.roles.set(userRole.userId, userRole.role as UserRole);
            }
          });
          
          // キャッシュタイムスタンプを更新
          this.roleCache.lastUpdated = Date.now();
          
          console.log('サーバーから権限設定を読み込みました', data.data);
        }
      }
    } catch (error) {
      console.error('サーバーからの権限設定の読み込みに失敗しました:', error);
    }
  }
  
  // ユーザー権限をサーバーに保存
  async saveRoleToServer(userId: string, role: UserRole): Promise<boolean> {
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, role })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('サーバーに権限設定を保存しました', { userId, role });
          return true;
        } else {
          console.error('サーバーへの権限設定の保存に失敗しました:', data);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('サーバーへの権限設定の保存でエラーが発生しました:', error);
      return false;
    }
  }
  
  // ユーザー権限をサーバーから削除
  async removeRoleFromServer(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/roles/${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          console.log('サーバーから権限設定を削除しました', { userId });
          return true;
        } else {
          console.error('サーバーからの権限設定の削除に失敗しました:', data);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('サーバーからの権限設定の削除でエラーが発生しました:', error);
      return false;
    }
  }
}

// シングルトンインスタンスの作成
const roleManager = new RoleManager();

export default roleManager;