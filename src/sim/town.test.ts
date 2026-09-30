import { describe, it, expect } from "vitest";
import {
  agingOf,
  buildingAge,
  composeEntry,
  createRng,
  newGame,
  START_AGE,
  step,
  townLooks,
} from "@/sim";
import { defaultContent } from "@/content";
import type { GameState } from "@/sim";

const stagesOf = (s: GameState): Record<string, number> =>
  Object.fromEntries(Object.entries(s.town).map(([k, v]) => [k, v.stage]));

/** 6 時間刻みで days 日進める。日誌は上限で古い行が消えるので、町の行は進めながら集める */
function runTown(seed: number, days: number) {
  const rng = createRng(seed);
  let s = newGame(rng);
  const stages: Array<Record<string, number>> = [];
  const lines = new Set<string>();
  for (let i = 0; i < days * 4; i++) {
    s = step(s, 360, rng);
    stages.push(stagesOf(s));
    for (const e of s.log) if (e.kind === "town") lines.add(`${e.changeId}:${e.stage}`);
  }
  return { s, stages, lines };
}

describe("H4: 3 年（ゲーム内 54 日）で町並みが変わる", () => {
  it("変化が 1 件以上起き、変化した建物は元に戻らない", { timeout: 120_000 }, () => {
    const { s, stages } = runTown(20261001, 54);
    const seen: Record<string, number> = {};
    for (const snap of stages)
      for (const [id, stage] of Object.entries(snap)) {
        // 一度進んだ段階より前には戻らない
        expect(stage).toBeGreaterThanOrEqual(seen[id] ?? 0);
        seen[id] = stage;
      }
    expect(Object.values(seen).filter((st) => st >= 1).length).toBeGreaterThanOrEqual(1);
    // 見た目も、最初の姿のままではない
    const looks = townLooks(defaultContent, s);
    expect(looks.east !== "lot" || looks.pole !== "pole").toBe(true);
  });

  it("追加: 変化が起きるのは startYear を過ぎてから（1 年目は何も変わらない）", () => {
    const { s } = runTown(5, 17);
    expect(Object.keys(s.town)).toHaveLength(0);
  });

  it(
    "追加: 段階ごとに日誌が 1 行ずつ出る（飛ばさない・重ねない）",
    { timeout: 120_000 },
    () => {
      const { s, lines } = runTown(20261001, 54);
      const expected = new Set<string>();
      for (const [id, v] of Object.entries(s.town)) {
        const def = defaultContent.town.find((t) => t.id === id)!;
        def.stages.forEach((st, i) => {
          if (i >= 1 && i <= v.stage && st.log) expected.add(`${id}:${i}`);
        });
      }
      expect(lines).toEqual(expected);
      expect(lines.size).toBeGreaterThanOrEqual(1);
    }
  );

  it("追加: 日誌の行は content の log から組み立てられる", () => {
    const e = { t: 0, kind: "town" as const, changeId: "east-lot", stage: 2 };
    expect(composeEntry(defaultContent, e)).toBe(defaultContent.town[0]!.stages[2]!.log);
    expect(composeEntry(defaultContent, { ...e, changeId: "no-such" })).toBeNull();
  });
});

describe("H5: ひだまり荘の経年", () => {
  it("築 50 年は築 47 年よりサビ・ツタが多い", () => {
    const a47 = agingOf(47);
    const a50 = agingOf(50);
    expect(a50.rust).toBeGreaterThan(a47.rust);
    expect(a50.ivy).toBeGreaterThan(a47.ivy);
  });

  it("追加: 看板のかすれも増え、値は 0〜1 に収まり、年とともに単調に増える", () => {
    expect(agingOf(50).sign).toBeGreaterThan(agingOf(47).sign);
    let prev = agingOf(0);
    for (let age = 1; age <= 120; age++) {
      const a = agingOf(age);
      for (const k of ["rust", "ivy", "sign"] as const) {
        expect(a[k]).toBeGreaterThanOrEqual(prev[k]);
        expect(a[k]).toBeGreaterThanOrEqual(0);
        expect(a[k]).toBeLessThanOrEqual(1);
      }
      prev = a;
    }
    expect(agingOf(Number.NaN).rust).toBe(0);
  });

  it("追加: 開始時の築年数は 47 で、18 日ごとに 1 年進む", () => {
    expect(buildingAge(0, 0)).toBe(START_AGE);
    expect(buildingAge(18 * 1440, 0)).toBe(START_AGE + 1);
  });
});
