import type { Content, TownLook, TownSlot } from "@/content/schema";
import { DAY_MIN, YEAR_DAYS } from "./clock";
import { pushLog, type Ctx } from "./context";
import { chance } from "./random";
import type { GameState } from "./types";

/** 場所ごとの最初の見た目（変化の定義が無い場所はこのまま） */
const INITIAL: Record<TownSlot, TownLook> = { east: "lot", pole: "pole" };

/** いまの町並み: 場所 → 見た目 */
export function townLooks(
  content: Pick<Content, "town">,
  s: Pick<GameState, "town">
): Record<TownSlot, TownLook> {
  const out: Record<TownSlot, TownLook> = { ...INITIAL };
  for (const def of content.town) {
    const stage = s.town[def.id]?.stage ?? 0;
    const look = def.stages[Math.min(stage, def.stages.length - 1)]?.look;
    if (look) out[def.slot] = look;
  }
  return out;
}

/**
 * 日付が変わったときに呼ぶ。始まっていない変化は、開始年を過ぎていれば確率で始まり、
 * 始まった変化は経過日数に応じて段階を 1 つずつ進める（戻らない）。進むたびに日誌へ 1 行。
 */
export function advanceTown(c: Ctx): void {
  const { s, rng } = c;
  const years = Math.floor((s.t - s.t0) / (YEAR_DAYS * DAY_MIN));
  for (const def of c.content.town) {
    let prog = s.town[def.id];
    if (!prog) {
      if (years < def.startYear || !chance(rng, def.chance)) continue;
      prog = { start: s.t, stage: 0 };
      s.town[def.id] = prog;
    }
    const days = Math.floor((s.t - prog.start) / DAY_MIN);
    while (prog.stage + 1 < def.stages.length) {
      const next = def.stages[prog.stage + 1]!;
      if (days < (next.afterDays ?? 0)) break;
      prog.stage++;
      if (next.log)
        pushLog(c, { t: s.t, kind: "town", changeId: def.id, stage: prog.stage });
    }
  }
}
