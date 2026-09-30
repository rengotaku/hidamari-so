import { MIN_PER_SEC } from "./clock";
import type { Rng } from "./random";
import type { GameState, LogKind, Resident, TraitId } from "./types";

/**
 * 1 回の step の作業用コンテキスト。
 * `s` は step が複製した作業コピーで、ここから先の関数は自由に書き換える（公開 API の step だけが純粋）。
 */
export interface Ctx {
  s: GameState;
  rng: Rng;
  /** 留守中の進行など、吹き出しを出さない */
  quiet: boolean;
}

export const LOG_LIMIT = 120;

export const isHome = (r: Resident): boolean => typeof r.at === "number";
export const isAwake = (r: Resident): boolean => r.act !== "sleep" && r.act !== "nap";
export const hasTrait = (r: Resident, t: TraitId): boolean => r.traits.includes(t);

export const getRes = (s: GameState, id: number | null): Resident | undefined =>
  id === null ? undefined : s.res.find((r) => r.id === id);

export function log(c: Ctx, text: string, kind: LogKind = ""): void {
  c.s.log.unshift({ t: c.s.t, text, kind });
  if (c.s.log.length > LOG_LIMIT) c.s.log.length = LOG_LIMIT;
}

/** 吹き出しを出す。表示時間はゲーム内時間で数える（実時間の約 2.4 秒 + 1 文字 0.11 秒） */
export function say(c: Ctx, r: Resident, text: string): void {
  if (!text || c.quiet) return;
  r.bubble = { text, until: c.s.t + (2.4 + text.length * 0.11) * MIN_PER_SEC };
}

export function pickRes(c: Ctx, f: (r: Resident) => boolean): Resident | null {
  const a = c.s.res.filter(f);
  return a.length > 0 ? a[Math.floor(c.rng.next() * a.length)]! : null;
}
