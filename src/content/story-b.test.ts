import { describe, it, expect } from "vitest";
import { defaultContent } from "@/content";
import { createRng, newGame, step } from "@/sim";

/** #7-B 着手前の出来事の件数（origin/main の content/storylets/*.json の合計から #24 の新規 8 ファイルを除いた値。#25 の 19 件を含む） */
const BASE_STORYLETS = 182;
/** #24 で足した出来事（新規 8 ファイル）の id */
const newFiles = import.meta.glob<{ id: string }[]>(
  "../../content/storylets/{neighbors,seasonal,love-trouble,work,mishaps,partings,chains-a,chains-b}.json",
  { import: "default", eager: true }
);
const newIds = new Set(Object.values(newFiles).flatMap((l) => l.map((s) => s.id)));
const storyletIds = new Set(defaultContent.storylets.map((s) => s.id));
const drawn = Object.values(defaultContent.archetypes).filter(
  (a) => !a.tags.includes("arc-only")
);

/** 新規ゲームを days 日進め、起きた出来事の id を起きた順に返す（1 日ずつ進めて日誌の取りこぼしを防ぐ） */
function played(seed: number, days: number): string[] {
  const rng = createRng(seed);
  let s = newGame(rng);
  const out: string[] = [];
  for (let d = 0; d < days; d++) {
    const from = s.t;
    s = step(s, 1440, rng);
    const today = s.log
      .filter(
        (e): e is typeof e & { storyletId: string } => "storyletId" in e && e.t >= from
      )
      .reverse()
      .map((e) => e.storyletId);
    out.push(...today);
  }
  return out;
}

describe("E1: 件数", () => {
  it("抽選されるキャラの種類が 15 以上、出来事が着手前より 150 件以上増えている", () => {
    expect(drawn.length).toBeGreaterThanOrEqual(15);
    expect(defaultContent.storylets.length).toBeGreaterThanOrEqual(BASE_STORYLETS + 150);
  });
});

describe("E2: 人生の筋の入口", () => {
  it("抽選される全種類に、入口（arc の最初の分岐先）が 2 本以上ある", () => {
    const byId = new Map(defaultContent.storylets.map((s) => [s.id, s]));
    for (const a of drawn) {
      const entry = byId.get(a.arc ?? "");
      const ids = new Set<string>();
      for (const e of entry?.effects ?? [])
        if (e.type === "book")
          for (const n of e.next) if (n.id !== entry!.id) ids.add(n.id);
      expect(ids.size, a.id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("E3: シード 1〜10 を 60 日進めたときの出来事の種類数", () => {
  it("各シードで 40 種類以上、10 シードの和集合で 120 種類以上", () => {
    const union = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const kinds = new Set(played(seed, 60));
      expect(kinds.size, `seed ${seed}`).toBeGreaterThanOrEqual(40);
      for (const k of kinds) union.add(k);
    }
    expect(union.size).toBeGreaterThanOrEqual(120);
  });
});

describe("E3b(追加): 新規の出来事が実際に起きる", () => {
  it("新規 8 ファイルの出来事のうち、10 シードの 60 日の和集合で 120 種類以上が起きる", () => {
    const union = new Set<string>();
    for (let seed = 1; seed <= 10; seed++)
      for (const id of played(seed, 60)) if (newIds.has(id)) union.add(id);
    expect(union.size).toBeGreaterThanOrEqual(120);
  });
});

describe("E4: 本文に数値の変化を書かない", () => {
  it("全出来事の本文に +数字 -数字 % が無い", () => {
    for (const st of defaultContent.storylets) {
      const all = [...st.texts, ...Object.values(st.choices ?? {}).flat()];
      for (const t of all) expect(t, st.id).not.toMatch(/[+＋\-－][0-9０-９]|[%％]/);
    }
  });
});

describe("E5(追加): 言い回し", () => {
  it("全ての出来事が 2 つ以上の言い回しを持つ", () => {
    for (const st of defaultContent.storylets)
      expect(st.texts.length, st.id).toBeGreaterThanOrEqual(2);
  });
});

describe("E6(追加): シードごとに違う物語になる", () => {
  it("10 シードの各 10 日分の出来事の並びが、どの 2 本を比べても同一にならない", () => {
    const seqs = Array.from({ length: 10 }, (_, i) => played(i + 1, 10).join(","));
    for (const q of seqs) expect(q.length).toBeGreaterThan(0);
    expect(new Set(seqs).size).toBe(10);
    for (const id of seqs.flatMap((q) => q.split(",")))
      expect(storyletIds.has(id), id).toBe(true);
  });
});
