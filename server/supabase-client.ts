import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化
export function initSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
    console.error('Supabase環境変数が設定されていません');
    return null;
  }

  try {
    // 通常のクライアント（一般ユーザー向け）
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // サービスロールクライアント（管理者向け、フルアクセス権限）
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Supabaseクライアントを初期化しました');
    
    return {
      client: supabase,
      admin: supabaseAdmin
    };
  } catch (error) {
    console.error('Supabaseクライアントの初期化に失敗しました:', error);
    return null;
  }
}