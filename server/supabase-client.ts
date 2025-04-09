import { createClient } from '@supabase/supabase-js';

// Supabaseクライアントの初期化（直接値を設定）
export function initSupabaseClient() {
  // 直接ハードコード
  const supabaseUrl = 'https://njkzjxfmkmwoowhtiyik.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa3pqeGZta213b293aHRpeWlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTE2MTYzOTIsImV4cCI6MjAyNzE5MjM5Mn0.U2mAf_ZBgScFLtx82i9KjPTCdWDvvRSiSw9iHN22iZE';
  const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qa3pqeGZta213b293aHRpeWlrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxMTYxNjM5MiwiZXhwIjoyMDI3MTkyMzkyfQ.DGzOnAiusnV7rlvXZGW-Njj65HsLzFvLe-Y1Gq2f1f4';

  try {
    // 通常のクライアント（一般ユーザー向け）
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // サービスロールクライアント（管理者向け、フルアクセス権限）
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Supabaseクライアントを初期化しました（直接値）');
    
    return {
      client: supabase,
      admin: supabaseAdmin
    };
  } catch (error) {
    console.error('Supabaseクライアントの初期化に失敗しました:', error);
    return null;
  }
}