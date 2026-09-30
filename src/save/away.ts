/** タブが非表示だった時間を測る。時計は引数で注入する（visibilitychange の配線は UI 側） */
export interface AwayTracker {
  hide(): void;
  /** いま非表示の計測中か */
  hiding(): boolean;
  /** 非表示だった実時間（ミリ秒）。非表示になっていなければ 0。呼ぶと計測を終える */
  show(): number;
}

export function createAwayTracker(now: () => number): AwayTracker {
  let hiddenAt: number | null = null;
  return {
    hide() {
      hiddenAt = now();
    },
    hiding() {
      return hiddenAt !== null;
    },
    show() {
      if (hiddenAt === null) return 0;
      const ms = Math.max(0, now() - hiddenAt);
      hiddenAt = null;
      return ms;
    },
  };
}
