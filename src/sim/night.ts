import { hourOf, inWin } from "./clock";
import type { GameState } from "./types";

/** 夜の場面が起きる時間帯（22 時〜翌 2 時） */
export const NIGHT_SCENE_HOURS: readonly [number, number] = [22, 2];

export interface NightScene {
  room: number;
  /** その部屋にいる、付き合っている 2 人の id */
  ids: [number, number];
}

/**
 * 夜の場面が起きている部屋。付き合っている段階以降（付き合う・同棲・結婚）の 2 人が、
 * 22 時〜 2 時に同じ部屋にいるときだけ。描画（部屋を暗くしてハートを浮かべる）のための判定で、
 * 状態は変えず、日誌にも書かない。
 */
export function nightScenes(s: GameState): NightScene[] {
  if (!inWin(hourOf(s.t), NIGHT_SCENE_HOURS[0], NIGHT_SCENE_HOURS[1])) return [];
  const out: NightScene[] = [];
  for (const k of s.bonds) {
    if (k.stage !== "dating" && k.stage !== "cohabiting" && k.stage !== "married")
      continue;
    const a = s.res.find((r) => r.id === k.a);
    const b = s.res.find((r) => r.id === k.b);
    if (!a || !b || typeof a.at !== "number" || a.at !== b.at) continue;
    if (!out.some((o) => o.room === a.at)) out.push({ room: a.at, ids: [a.id, b.id] });
  }
  return out;
}
