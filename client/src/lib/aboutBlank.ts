/**
 * about:blank モード用のユーティリティ関数
 */

/**
 * リンクがabout:blank内で開くかどうかを確認
 */
export function isAboutBlankModeEnabled(): boolean {
  return localStorage.getItem("useAboutBlank") === "true";
}

/**
 * 指定URLをabout:blank内で開く
 */
export function openInAboutBlank(url: string): void {
  const newWindow = window.open("about:blank", "_blank");
  if (!newWindow) {
    // ポップアップがブロックされた場合は通常のウィンドウで開く
    window.open(url, "_blank");
    return;
  }
  
  // 遅延を入れて新しいウィンドウのDOM操作を行う
  setTimeout(() => {
    if (newWindow.document) {
      newWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>隠しビューア</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
            iframe { border: none; width: 100%; height: 100%; }
          </style>
        </head>
        <body>
          <iframe src="${url}" width="100%" height="100%" allowfullscreen></iframe>
        </body>
        </html>
      `);
    }
  }, 100);
}

/**
 * URLを適切なモードで開く
 * about:blankモードがオンの場合は隠しビューワで、それ以外は通常のタブで開く
 */
export function openUrl(url: string, forceNormal = false): void {
  if (isAboutBlankModeEnabled() && !forceNormal) {
    openInAboutBlank(url);
  } else {
    window.open(url, "_blank");
  }
}