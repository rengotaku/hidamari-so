import { describe, it, expect } from "vitest";
import { createRng, newGame, step, type GameState } from "@/sim";
import { roomLog } from "./roomLog";

function played(seed: number, days: number): { s: GameState } {
  const rng = createRng(seed);
  let s = newGame(rng);
  for (let i = 0; i < days * 24; i++) s = step(s, 60, rng);
  return { s };
}

describe("大写し中の日誌", () => {
  it("G6: その部屋の住人が登場する出来事だけが並ぶ（ほかの部屋の出来事・日付・町の変化は出ない）", () => {
    const { s } = played(31337, 12);
    expect(s.log.length).toBeGreaterThan(30);
    let checked = 0;
    for (let room = 0; room < 6; room++) {
      const ids = new Set(s.res.filter((r) => r.room === room).map((r) => r.id));
      const shown = roomLog(s.log, s, room);
      for (const e of shown) {
        expect(e.kind === "day" || e.kind === "town").toBe(false);
        const roles = "roles" in e ? Object.values(e.roles) : [];
        expect(roles.some((r) => r && ids.has(r.id))).toBe(true);
        checked++;
      }
      // 絞り込みなので全体より少ない
      expect(shown.length).toBeLessThan(s.log.length);
    }
    expect(checked).toBeGreaterThan(0);
    // 全部屋の合計で、全体のうち登場人物のいる出来事だけが含まれる
    const all = new Set<unknown>();
    for (let room = 0; room < 6; room++)
      for (const e of roomLog(s.log, s, room)) all.add(e);
    expect(all.size).toBeLessThan(s.log.length);
  });

  it("追加: 順序（新しい順）を保つ。住人のいない部屋は空になる", () => {
    const { s } = played(31337, 12);
    for (let room = 0; room < 6; room++) {
      const shown = roomLog(s.log, s, room);
      for (let i = 1; i < shown.length; i++)
        expect(shown[i - 1]!.t).toBeGreaterThanOrEqual(shown[i]!.t);
    }
    const empty = structuredClone(s);
    empty.res = empty.res.filter((r) => r.room !== 2);
    expect(roomLog(empty.log, empty, 2)).toEqual([]);
  });
});
