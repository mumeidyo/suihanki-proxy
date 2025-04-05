/**
 * データマネージャーモジュール
 * 
 * ブラウザのローカルストレージを利用して、ユーザーデータを安全に保存・管理するためのユーティリティ。
 * Cookieベースの保存機能も提供し、有効期限付きのデータ保存をサポートします。
 */

const DataManager = {
  /**
   * データを保存する
   * @param key 保存するデータのキー
   * @param value 保存する値
   * @param expiryDays 有効期限（日数） - 省略すると永続的に保存
   */
  saveData: (key: string, value: string, expiryDays?: number): void => {
    try {
      // まずローカルストレージに保存を試みる
      localStorage.setItem(key, value);
      
      // expiryDaysが指定されていればCookieにも保存
      if (expiryDays !== undefined) {
        const d = new Date();
        d.setTime(d.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
        const expires = "expires=" + d.toUTCString();
        document.cookie = key + "=" + value + ";" + expires + ";path=/";
      }
    } catch (e) {
      console.error("データの保存に失敗しました:", e);
    }
  },
  
  /**
   * 保存されたデータを取得する
   * @param key 取得するデータのキー
   * @returns 保存されている値、もしくはnull
   */
  getData: (key: string): string | null => {
    try {
      // まずローカルストレージから取得
      const localData = localStorage.getItem(key);
      if (localData !== null) {
        return localData;
      }
      
      // ローカルストレージになければCookieから検索
      const name = key + "=";
      const decodedCookie = decodeURIComponent(document.cookie);
      const cookieParts = decodedCookie.split(';');
      
      for (let i = 0; i < cookieParts.length; i++) {
        let cookiePart = cookieParts[i].trim();
        if (cookiePart.indexOf(name) === 0) {
          return cookiePart.substring(name.length, cookiePart.length);
        }
      }
      
      return null;
    } catch (e) {
      console.error("データの取得に失敗しました:", e);
      return null;
    }
  },
  
  /**
   * 保存されたデータを削除する
   * @param key 削除するデータのキー
   */
  removeData: (key: string): void => {
    try {
      // ローカルストレージから削除
      localStorage.removeItem(key);
      
      // Cookieからも削除（有効期限を過去に設定）
      document.cookie = key + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch (e) {
      console.error("データの削除に失敗しました:", e);
    }
  },
  
  /**
   * 全てのデータをクリアする
   */
  clearAllData: (): void => {
    try {
      // ローカルストレージをクリア
      localStorage.clear();
      
      // Cookieもクリア（有効期限を過去に設定）
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
    } catch (e) {
      console.error("データのクリアに失敗しました:", e);
    }
  }
};

export default DataManager;