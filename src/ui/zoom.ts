import type { ViewFrame } from "@/render";

/**
 * 部屋の大写しの状態遷移。全体図 → ズーム中 → 大写し → 戻り中 → 全体図。
 * 遷移の途中に押されたものは無視する（二重に始まらない）。時間（ゲーム内）とは無関係で、止めも進めもしない。
 */
export type ZoomPhase = "overview" | "zooming" | "closeup" | "returning";

export interface ZoomState {
  phase: ZoomPhase;
  /** 大写しの対象の部屋番号。全体図では null */
  room: number | null;
  /** 遷移を始めた時刻（ミリ秒） */
  since: number;
}

/** 部屋へ寄る時間（約 0.5 秒）と、寄った絵から大写しへ切り替わるフェードの時間（約 0.6 秒） */
export const ZOOM_IN_MS = 500;
export const FADE_MS = 600;
/** prefers-reduced-motion のとき、遷移にかける時間（ほぼ 0） */
export const REDUCED_MS = 0;

export const initialZoom: ZoomState = { phase: "overview", room: null, since: 0 };

export const transitionMs = (reduced: boolean): number =>
  reduced ? REDUCED_MS : ZOOM_IN_MS + FADE_MS;

/** 時間が経って遷移が終わっていれば、次の状態へ進める */
export function advance(z: ZoomState, now: number, reduced: boolean): ZoomState {
  if (z.phase !== "zooming" && z.phase !== "returning") return z;
  if (now - z.since < transitionMs(reduced)) return z;
  return z.phase === "zooming"
    ? { phase: "closeup", room: z.room, since: now }
    : initialZoom;
}

/**
 * 画面を押した。target は押した場所の部屋番号（部屋の外なら null）。
 * 全体図で部屋を押すと寄り始め、大写しではどこを押しても戻り始める。遷移の途中は何も変えない。
 */
export function press(
  z0: ZoomState,
  target: number | null,
  now: number,
  reduced: boolean
): ZoomState {
  const z = advance(z0, now, reduced);
  if (z.phase === "overview") {
    if (target === null) return z;
    return reduced
      ? { phase: "closeup", room: target, since: now }
      : { phase: "zooming", room: target, since: now };
  }
  if (z.phase === "closeup")
    return reduced ? initialZoom : { phase: "returning", room: z.room, since: now };
  return z;
}

const ease = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** いまの時刻に描く 1 コマ。戻るときは寄るときの逆順をたどる */
export function viewFrame(z: ZoomState, now: number): ViewFrame {
  if (z.room === null || z.phase === "overview") return { kind: "overview" };
  if (z.phase === "closeup") return { kind: "closeup", room: z.room };
  const total = ZOOM_IN_MS + FADE_MS;
  const el = Math.max(0, Math.min(total, now - z.since));
  const e = z.phase === "zooming" ? el : total - el;
  if (e >= total) return { kind: "closeup", room: z.room };
  if (e <= ZOOM_IN_MS) return { kind: "zoom", room: z.room, k: ease(e / ZOOM_IN_MS) };
  return { kind: "fade", room: z.room, k: ease((e - ZOOM_IN_MS) / FADE_MS) };
}

/** OS の「視覚効果を減らす」設定。有効なら遷移は即座に切り替える */
export function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
