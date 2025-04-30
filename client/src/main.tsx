import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/proxy.css";

// 初期テーマと背景を設定
const initThemeAndBackground = () => {
  // 起動時に強制的にライトモードを適用
  const forceLightMode = true; // これを true にすると強制的にライトモードになります
  
  // 強制ライトモードが有効なら、前回の設定に関わらず強制的にライトモードに
  if (forceLightMode) {
    localStorage.removeItem('theme');
    localStorage.setItem('theme', 'light');
  }
  
  // テーマの初期化（ライトモードをデフォルトに）
  const savedTheme = localStorage.getItem('theme') || 'light';
  
  // 前のテーマクラスを削除
  document.documentElement.classList.remove('light', 'dark');
  
  // 新しいテーマクラスを追加
  document.documentElement.classList.add(savedTheme);
  
  // data-theme属性も設定
  document.documentElement.setAttribute('data-theme', savedTheme);
  document.documentElement.setAttribute('data-mode', savedTheme);
  
  // テーマを保存（再確認）
  localStorage.setItem('theme', savedTheme);
  
  // media属性も設定
  if (savedTheme === 'dark') {
    document.documentElement.style.colorScheme = 'dark';
    
    // メタタグを更新
    let metaTag = document.querySelector('meta[name="color-scheme"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'color-scheme');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', 'dark');
  }
  
  // 背景色の初期設定
  const savedBackground = localStorage.getItem('app-background') || 'default';
  
  // 背景色を直接適用
  setTimeout(() => {
    // テーマが適用された後で背景色も適用
    applyInitialBackgroundColor(savedTheme, savedBackground);
    
    // イベントも発行して他のコンポーネントに通知
    const event = new CustomEvent('themeChanged', { 
      detail: { theme: savedTheme, colorName: savedBackground } 
    });
    document.dispatchEvent(event);
  }, 100);
  
  console.log('初期テーマと背景を設定しました:', savedTheme, savedBackground);
};

// 背景色を初期設定する関数
const applyInitialBackgroundColor = (theme: string, colorName: string) => {
  // 色の定義（改良版）
  const colors: Record<string, {light: string, dark: string}> = {
    'default': { light: '#FFFFFF', dark: '#0a0a0f' },
    'gray': { light: '#F1F5F9', dark: '#111827' },
    'blue': { light: '#EFF6FF', dark: '#0f172a' },
    'green': { light: '#F0FDF4', dark: '#052e16' },
    'pink': { light: '#FDF2F8', dark: '#4a044e' },
    'purple': { light: '#FAF5FF', dark: '#2e1065' }
  };
  
  const color = colors[colorName] || colors.default;
  const backgroundColor = theme === 'dark' ? color.dark : color.light;
  
  // 背景色を強制的に適用（複数の要素とスタイル）
  document.body.style.backgroundColor = backgroundColor;
  document.body.style.background = backgroundColor;
  document.documentElement.style.backgroundColor = backgroundColor;
  
  // data属性も設定
  document.documentElement.setAttribute('data-theme-background', colorName);
  document.body.setAttribute('data-bg-color', colorName);
  
  // カスタムスタイルタグを追加して強制的に適用
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
  
  console.log('初期背景色を強制的に適用:', colorName, backgroundColor, theme === 'dark' ? 'ダークモード' : 'ライトモード');
};

// アプリのレンダリング前にテーマと背景を初期化
initThemeAndBackground(); // テーマと背景色を適用

createRoot(document.getElementById("root")!).render(<App />);
