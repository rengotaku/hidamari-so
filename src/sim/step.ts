import { defaultContent, type Content } from "@/content";
import type { Ctx } from "./context";
import type { Rng } from "./random";
import type { GameState } from "./types";
import { update } from "./world";

export interface StepOptions {
  /** true なら吹き出しを出さない（留守中の進行用） */
  quiet?: boolean;
  /** 出来事の定義。省略すると content/ の既定コンテンツ */
  content?: Content;
}

/** 内部の 1 更新あたりの最大刻み（ゲーム内分） */
const MAX_SUBSTEP = 2;

/**
 * 状態を `minutes` 分（ゲーム内）進めた新しい状態を返す純粋関数。
 * 入力の state は書き換えない。乱数は引数で受け取り、時計は state.t だけを見る。
 * minutes が 0 以下・NaN・無限大のときは入力をそのまま返す。
 */
export function step(
  state: GameState,
  minutes: number,
  rng: Rng,
  options: StepOptions = {}
): GameState {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  const s = structuredClone(state);
  const c: Ctx = {
    s,
    rng,
    quiet: options.quiet ?? false,
    content: options.content ?? defaultContent,
  };
  let left = minutes;
  while (left > 0) {
    const dt = Math.min(MAX_SUBSTEP, left);
    update(c, dt);
    left -= dt;
  }
  return s;
}
