import { describe, it, expect } from "vitest";
import { createRng, newGame, step, hourOf, dayOf, ROOM_COUNT } from "@/sim";
import type { GameState } from "@/sim";

/** A1 の不変条件: 居場所は 4 種類のどれかで、部屋の表と住人の表が食い違わない */
function invariantErrors(s: GameState): string[] {
  const errs: string[] = [];
  for (const r of s.res) {
    const at = r.at;
    if (at === "out" || at === "walking") {
      // 外出中・歩行中
    } else if (
      typeof at === "number" &&
      Number.isInteger(at) &&
      at >= 0 &&
      at < ROOM_COUNT
    ) {
      if (at === r.room && r.visiting) errs.push(`${r.sei}: 自室なのに visiting`);
      if (at !== r.room && !r.visiting)
        errs.push(`${r.sei}: 他の部屋なのに visiting でない`);
    } else {
      errs.push(`${r.sei}: 不正な居場所 ${String(at)}`);
    }
    if (s.rooms[r.room] !== r.id) errs.push(`${r.sei}: 住人→部屋の対応が表と不一致`);
  }
  s.rooms.forEach((id, room) => {
    if (id === null) return;
    const r = s.res.find((x) => x.id === id);
    if (!r) errs.push(`部屋${room}: 存在しない住人 ${id}`);
    else if (r.room !== room) errs.push(`部屋${room}: 住人${r.sei}の room が ${r.room}`);
  });
  return errs;
}

function run(seed: number, days: number, check: boolean): GameState {
  const rng = createRng(seed);
  let s = newGame(rng);
  for (let i = 0; i < days * 1440; i++) {
    s = step(s, 1, rng);
    if (check) {
      const errs = invariantErrors(s);
      if (errs.length > 0) throw new Error(`t=${s.t}: ${errs.join(" / ")}`);
    }
  }
  return s;
}

describe("A1: 1 分刻みで 60 日進めても壊れない", () => {
  it("例外が出ず、居場所と部屋の対応が常に一致する", { timeout: 300_000 }, () => {
    const s = run(20240501, 60, true);
    expect(s.t).toBe(17 * 60 + 60 * 1440);
    expect(s.res.length).toBeGreaterThan(0);
  });
});

describe("A2: 決定性", () => {
  it(
    "同じシード・同じ手順なら最終状態の JSON が完全一致する",
    { timeout: 300_000 },
    () => {
      const a = JSON.stringify(run(777, 60, false));
      const b = JSON.stringify(run(777, 60, false));
      expect(a).toBe(b);
    }
  );

  it("追加: シードが違えば状態も違う", () => {
    const a = JSON.stringify(run(1, 3, false));
    const b = JSON.stringify(run(2, 3, false));
    expect(a).not.toBe(b);
  });
});

describe("A3: 会社員（平日 7:30〜22:30 勤務）", () => {
  it("勤務時間中は外出中で、勤務後に帰宅している", { timeout: 60_000 }, () => {
    const rng = createRng(4242);
    let s = newGame(rng);
    const man = () => s.res.find((r) => r.job === "salaryman")!;
    expect(man()).toBeDefined();

    // 2 日目（平日）の朝 6:00 まで進める
    while (!(dayOf(s.t) === 2 && hourOf(s.t) >= 6)) s = step(s, 1, rng);
    expect(dayOf(s.t) % 7).not.toBe(0);
    expect(dayOf(s.t) % 7).not.toBe(6);

    let outAllDay = true;
    let backHome = false;
    while (dayOf(s.t) === 2) {
      s = step(s, 1, rng);
      const h = hourOf(s.t);
      if (h >= 8.5 && h < 22) {
        if (man().at !== "out") outAllDay = false;
      }
      if (h >= 22.5 && typeof man().at === "number") backHome = true;
    }
    expect(outAllDay).toBe(true);
    expect(backHome).toBe(true);
  });
});

describe("追加: 境界条件", () => {
  it("minutes が 0 / 負 / NaN なら状態は変わらない", () => {
    const rng = createRng(5);
    const s = newGame(rng);
    for (const m of [0, -5, Number.NaN]) {
      expect(step(s, m, rng)).toEqual(s);
    }
  });

  it("minutes が Infinity なら即座に戻り、乱数状態も変わらない", () => {
    const rng = createRng(5);
    const s = newGame(rng);
    const before = rng.getState();
    expect(step(s, Number.POSITIVE_INFINITY, rng)).toBe(s);
    expect(rng.getState()).toBe(before);
  });

  it("step は入力の状態を書き換えない", () => {
    const rng = createRng(9);
    const s = newGame(rng);
    const before = JSON.stringify(s);
    step(s, 600, rng);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("一度に大きく進めても 1 分刻みと同じ時刻になる", () => {
    const rng = createRng(11);
    const s = step(newGame(rng), 3 * 1440, rng);
    expect(s.t).toBe(17 * 60 + 3 * 1440);
    expect(invariantErrors(s)).toEqual([]);
  });

  it("日誌は上限を超えない", () => {
    const rng = createRng(3);
    const s = step(newGame(rng), 30 * 1440, rng);
    expect(s.log.length).toBeLessThanOrEqual(120);
    expect(s.log.length).toBeGreaterThan(0);
  });
});
