import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Palette } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';

// 背景色の定義
type ColorOption = {
  name: string;
  light: string;
  dark: string;
  preview: string;
  label: string;
};

// 背景色のオプション
const colorOptions: Record<string, ColorOption> = {
  'default': {
    name: 'default',
    light: '#FFFFFF', // 白
    dark: '#0a0a0f',  // 改良した暗い色
    preview: 'bg-white dark:bg-slate-950',
    label: 'デフォルト'
  },
  'gray': {
    name: 'gray',
    light: '#F1F5F9', // slate-100
    dark: '#111827',  // より洗練された暗い色
    preview: 'bg-slate-100 dark:bg-gray-900',
    label: '灰色'
  },
  'blue': {
    name: 'blue',
    light: '#EFF6FF', // blue-50
    dark: '#0f172a',  // blue-950 より洗練された
    preview: 'bg-blue-50 dark:bg-blue-950',
    label: '青'
  },
  'green': {
    name: 'green',
    light: '#F0FDF4', // green-50
    dark: '#052e16',  // green-950
    preview: 'bg-green-50 dark:bg-green-950',
    label: '緑'
  },
  'pink': {
    name: 'pink',
    light: '#FDF2F8', // pink-50
    dark: '#4a044e',  // purple-950
    preview: 'bg-pink-50 dark:bg-purple-950',
    label: 'ピンク'
  },
  'purple': {
    name: 'purple',
    light: '#FAF5FF', // purple-50
    dark: '#2e1065',  // purple-950 より洗練された
    preview: 'bg-purple-50 dark:bg-purple-950',
    label: '紫'
  }
};

// 直接CSSで背景色を設定する関数（より信頼性の高い方法）
const applyBackgroundColorDirectly = (colorName: string): void => {
  const isDarkMode = document.documentElement.classList.contains('dark');
  const color = colorOptions[colorName] || colorOptions.default;
  
  // 現在のテーマに合わせた色を選択
  const backgroundColor = isDarkMode ? color.dark : color.light;
  
  // bodyとhtml要素の両方に背景色を強制的に適用
  document.body.style.backgroundColor = backgroundColor;
  document.body.style.background = backgroundColor;
  document.documentElement.style.backgroundColor = backgroundColor;
  
  // !important フラグを使ったスタイルを動的に追加
  let style = document.getElementById('background-override-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'background-override-style';
    document.head.appendChild(style);
  }
  
  // すべての背景関連プロパティを上書き
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
  
  // data属性も設定（CSSセレクタ用）
  document.documentElement.setAttribute('data-theme-background', colorName);
  
  // 特別なクラスをbodyに追加
  document.body.classList.add('custom-bg');
  document.body.setAttribute('data-bg-color', colorName);
  
  console.log('背景色を強制的に適用:', colorName, backgroundColor, isDarkMode ? 'ダークモード' : 'ライトモード');
};

const BackgroundSelector = () => {
  const [currentBg, setCurrentBg] = useState<string>(() => {
    return localStorage.getItem('app-background') || 'default';
  });

  // 背景色を適用する関数
  const applyBackground = (colorName: string) => {
    // 直接CSSで背景色を適用
    applyBackgroundColorDirectly(colorName);
    
    // 保存
    localStorage.setItem('app-background', colorName);
    console.log('背景色設定を保存:', colorName);
  };
  
  // ユーザーが背景色を変更したときの処理
  const changeBackground = (colorName: string) => {
    setCurrentBg(colorName);
    applyBackground(colorName);
    console.log('ユーザーが背景色を変更:', colorName);
  };
  
  // 初期化時に背景色を適用
  useEffect(() => {
    // 強制的に現在のテーマ状態を取得して適用
    const isDarkMode = document.documentElement.classList.contains('dark');
    console.log('現在のテーマ状態:', isDarkMode ? 'ダークモード' : 'ライトモード');
    
    // もしlocalStorage内の値と実際のDOM状態が一致しない場合は修正
    if (isDarkMode && localStorage.getItem('theme') !== 'dark') {
      localStorage.setItem('theme', 'dark');
      console.log('localStorage内のテーマをダークモードに修正しました');
    } else if (!isDarkMode && localStorage.getItem('theme') !== 'light') {
      localStorage.setItem('theme', 'light');
      console.log('localStorage内のテーマをライトモードに修正しました');
    }
    
    // 背景色を適用
    applyBackground(currentBg);
    console.log('初期背景色を適用:', currentBg);
  }, []);
  
  // テーマが変更されたときに背景色を再適用
  useEffect(() => {
    const handleThemeChange = () => {
      applyBackground(currentBg);
      console.log('テーマ変更に伴い背景色を再適用:', currentBg);
    };
    
    // テーマ変更イベントをリッスン
    document.addEventListener('themeChanged', handleThemeChange);
    
    // クリーンアップ
    return () => {
      document.removeEventListener('themeChanged', handleThemeChange);
    };
  }, [currentBg]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="ml-2" title="背景色を変更">
          <Palette className="h-4 w-4" />
          <span className="sr-only">背景色を変更</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>背景色を選択</DropdownMenuLabel>
        {Object.values(colorOptions).map((color) => (
          <DropdownMenuItem
            key={color.name}
            onClick={() => changeBackground(color.name)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center">
              <div className={`w-4 h-4 mr-2 rounded-full ${color.preview}`} />
              <span>{color.label}</span>
            </div>
            {currentBg === color.name && <Check className="w-4 h-4 ml-2" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default BackgroundSelector;