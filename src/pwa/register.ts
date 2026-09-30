// service worker の登録。非対応ブラウザ・開発中・登録失敗でも例外を出さない。
// 新しい SW は待機状態になり、画面の読み込み中に版が混ざらないよう、勝手には有効にしない。
// 有効にするのは次のどちらか:
//  - 古い画面がすべて閉じた後の次回起動
//  - タブが非表示から表示に戻った瞬間（待機中の版があれば有効にして、画面を 1 回だけ再読み込みする）
// 保存は非表示になる時点で済んでいるので、再読み込み後は保存から続きが始まる。更新の通知 UI は置かない。

export type RegisterDeps = {
  doc: Document;
  reload: () => void;
};

const defaultDeps = (): RegisterDeps => ({
  doc: document,
  reload: () => location.reload(),
});

// 非表示から表示に戻ったとき、待機中の版を有効にして reload を 1 回だけ呼ぶ購読を張る
function watchReturnToVisible(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
  { doc, reload }: RegisterDeps
): void {
  let wasHidden = doc.visibilityState === "hidden";
  let switching = false;
  let reloaded = false;

  const reloadOnce = () => {
    // switching は有効にし始めてから立ちっぱなしにする。controllerchange と statechange の
    // 両方が来ても、以後の切り替えでも、再読み込みは 1 回だけ
    if (reloaded) return;
    reloaded = true;
    reload();
  };

  const activate = (waiting: ServiceWorker) => {
    switching = true;
    try {
      // workbox が skipWaiting:false のときに入れる message リスナーが skipWaiting() を呼ぶ
      waiting.postMessage({ type: "SKIP_WAITING" });
    } catch {
      // 有効にできなくてもゲームは止めない。次に戻ったときにもう一度試す
      switching = false;
      return;
    }
    // Chromium では clientsClaim:false でも activating → controllerchange → activated の順に来た。
    // ブラウザによる違いに備えて、待機中のワーカー自身の statechange(activated) も待ち、
    // どちらか先に来た方で 1 回だけ reload する
    container.addEventListener("controllerchange", reloadOnce);
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") reloadOnce();
    });
  };

  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      wasHidden = true;
      return;
    }
    if (!wasHidden || switching) return;
    wasHidden = false;
    const waiting = registration.waiting;
    if (waiting) activate(waiting);
  });
}

export function registerServiceWorker(
  enabled: boolean = import.meta.env.PROD,
  nav: Navigator = navigator,
  deps: RegisterDeps = defaultDeps()
): void {
  if (!enabled || !("serviceWorker" in nav)) return;
  const register = () => {
    nav.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => watchReturnToVisible(registration, nav.serviceWorker, deps))
      .catch(() => {
        // オフライン機能が使えないだけでゲームは動くので握りつぶす
      });
  };
  if (deps.doc.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
