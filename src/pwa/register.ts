// service worker の登録。非対応ブラウザ・開発中・登録失敗でも例外を出さない。
// 新しい SW は skipWaiting + clientsClaim で即有効になるが、開いている画面は再読み込みしない。
// 次回起動で新しいアセットが読み込まれる（更新の通知 UI は置かない）。
export function registerServiceWorker(
  enabled: boolean = import.meta.env.PROD,
  nav: Navigator = navigator
): void {
  if (!enabled || !("serviceWorker" in nav)) return;
  const register = () => {
    nav.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // オフライン機能が使えないだけでゲームは動くので握りつぶす
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
