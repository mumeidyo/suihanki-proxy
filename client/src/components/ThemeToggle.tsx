import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

// テーマタイプの定義
type ThemeType = 'dark' | 'light';

// ドキュメントにテーマクラスを適用する関数
const applyTheme = (theme: ThemeType) => {
  const root = document.documentElement;
  
  // 前のテーマを削除
  root.classList.remove('light', 'dark');
  
  // 新しいテーマを適用
  root.classList.add(theme);
  
  // data-theme属性も設定（CSSカスタムプロパティ用）
  root.setAttribute('data-theme', theme);
  
  // 保存した背景色を取得
  const savedBackground = localStorage.getItem('app-background') || 'default';
  
  // 背景色を更新
  updateBackgroundForTheme(theme, savedBackground);
  
  // localStorageに保存
  localStorage.setItem('theme', theme);
};

// テーマに基づいて背景色を更新する関数
const updateBackgroundForTheme = (theme: ThemeType, colorName: string) => {
  const root = document.documentElement;
  const isDark = theme === 'dark';

  // テーマ変更を通知するイベントを発火
  // このイベントをBackgroundSelectorコンポーネントが受け取って背景色を更新
  const event = new CustomEvent('themeChanged', { 
    detail: { theme, colorName } 
  });
  console.log('テーマ変更イベントを発行:', { theme, colorName });
  
  // 確実にテーマ変更が完了した後にイベントを発行
  setTimeout(() => {
    document.dispatchEvent(event);
  }, 50);
};

const ThemeToggle = () => {
  // 初回起動時はlocalStorageをクリアし、強制的にライトモードに
  useEffect(() => {
    // 初回実行時の処理
    const firstRun = localStorage.getItem('first-run-v3') !== 'done';
    if (firstRun) {
      localStorage.removeItem('theme');
      localStorage.setItem('theme', 'light');
      localStorage.setItem('first-run-v3', 'done');
      
      // 少し遅延を入れてから強制リロード
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  }, []);

  const [theme, setTheme] = useState<ThemeType>(() => {
    // 強制的にライトモードを優先
    const savedTheme = localStorage.getItem('theme') as ThemeType;
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'light';
  });

  // テーマ変更時に適用
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  
  // マウント時にも一度適用
  useEffect(() => {
    applyTheme(theme);
  }, []);

  // テーマ切り替え関数
  const toggleTheme = () => {
    const newTheme: ThemeType = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    console.log('テーマを切り替えました:', newTheme); // デバッグ用ログ
    
    // 現在の背景色を取得
    const currentBg = localStorage.getItem('app-background') || 'default';
    
    // 強制的に背景色を再適用
    setTimeout(() => {
      // 背景色の直接強制適用のための色定義（改良版）
      const colors: Record<string, {light: string, dark: string}> = {
        'default': { light: '#FFFFFF', dark: '#0a0a0f' },
        'gray': { light: '#F1F5F9', dark: '#111827' },
        'blue': { light: '#EFF6FF', dark: '#0f172a' },
        'green': { light: '#F0FDF4', dark: '#052e16' },
        'pink': { light: '#FDF2F8', dark: '#4a044e' },
        'purple': { light: '#FAF5FF', dark: '#2e1065' }
      };
      
      // 現在の背景色設定を取得
      const colorSetting = colors[currentBg] || colors.default;
      const backgroundColor = newTheme === 'dark' ? colorSetting.dark : colorSetting.light;
      
      // 背景色を強制的に上書き
      document.body.style.backgroundColor = backgroundColor;
      document.body.style.background = backgroundColor;
      document.documentElement.style.backgroundColor = backgroundColor;
      
      // CSSの強制上書き
      let style = document.getElementById('background-override-style');
      if (!style) {
        style = document.createElement('style');
        style.id = 'background-override-style';
        document.head.appendChild(style);
      }
      
      style.textContent = `
        body {
          background-color: ${backgroundColor} !important;
          background: ${backgroundColor} !important;
        }
        html {
          background-color: ${backgroundColor} !important;
        }
        .min-h-screen {
          background-color: ${backgroundColor} !important;
        }
      `;
      
      console.log('テーマ変更時に背景色を強制上書き:', backgroundColor);
    }, 100);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 text-yellow-500" />
      ) : (
        <Moon className="h-5 w-5 text-blue-500" />
      )}
    </Button>
  );
};

export default ThemeToggle;