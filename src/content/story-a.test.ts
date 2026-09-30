import { describe, it, expect } from "vitest";
import {
  archetypeSchema,
  contentErrors,
  defaultContent,
  storyletSchema,
  townChangeSchema,
} from "@/content";
import { createRng, newGame, step } from "@/sim";

// content/ 配下の JSON を生のまま読む
const files = import.meta.glob<unknown>("../../content/**/*.json", {
  import: "default",
  eager: true,
});
const only = (name: string): unknown =>
  Object.entries(files).find(([p]) => p.endsWith(`/content/${name}`))?.[1];
const asList = (v: unknown): { id: string }[] => (Array.isArray(v) ? v : [v]) as never;

/** このチケットで足した種類 */
const NEW_IDS = [
  "yamikin",
  "rakugo",
  "busybody",
  "taxi",
  "guarantor",
  "konkatsu",
  "sento",
  "uranai",
];

const drawn = Object.values(defaultContent.archetypes).filter(
  (a) => !a.tags.includes("arc-only")
);
const arcsRaw = asList(only("storylets/arcs.json"));
const arcIds = new Set(arcsRaw.map((s) => s.id));
const storyById = new Map(defaultContent.storylets.map((s) => [s.id, s]));

/** 人生の筋の入口: 種類の arc の storylet から、最初の分岐で予約される別々の出来事 */
function entrances(archId: string): string[] {
  const entry = storyById.get(defaultContent.archetypes[archId]!.arc ?? "");
  if (!entry) return [];
  const out = new Set<string>();
  for (const e of entry.effects)
    if (e.type === "book") for (const n of e.next) if (n.id !== entry.id) out.add(n.id);
  return [...out];
}

/** 種類 A1〜A3 で使う、勤務日の指定だけを差し替えた種類 */
const withDays = (every: number, on: number[]) => ({
  ...defaultContent.archetypes.konbini!,
  shifts: [
    {
      days: { every, on },
      start: 22,
      end: 6,
      label: "夜勤",
      pay: 1000,
    },
  ],
});
const withNumbers = (n: [number, number]) => ({
  id: "num-test",
  kind: "daily",
  trigger: "hour",
  roles: { a: {} },
  numbers: { n },
  texts: ["{a}さんが{n}個配った"],
});

describe("A1: dayRule の on は every 未満", () => {
  it("on: [3] を every: 3 で書くと弾かれ、on: [0,2] は通る", () => {
    expect(archetypeSchema.safeParse(withDays(3, [3])).success).toBe(false);
    expect(archetypeSchema.safeParse(withDays(3, [0, 2])).success).toBe(true);
  });
});

describe("A2: numbers の値は 0〜99", () => {
  it("[100, 300] と [-1, 5] は弾かれ、[0, 99] は通る", () => {
    expect(storyletSchema.safeParse(withNumbers([100, 300])).success).toBe(false);
    expect(storyletSchema.safeParse(withNumbers([-1, 5])).success).toBe(false);
    expect(storyletSchema.safeParse(withNumbers([0, 99])).success).toBe(true);
  });
});

describe("A3: town の slot と look の対応", () => {
  const town = (slot: string, look: string) => ({
    id: "t",
    slot,
    startYear: 0,
    chance: 1,
    stages: [{ look: "lot" }, { look, afterDays: 1 }],
  });
  it("pole に mansion は弾かれ、現行の town.json は通る", () => {
    expect(townChangeSchema.safeParse(town("pole", "mansion")).success).toBe(false);
    expect(townChangeSchema.safeParse(town("east", "fence")).success).toBe(true);
    for (const t of asList(only("town.json")))
      expect(townChangeSchema.safeParse(t).error).toBeUndefined();
  });
});

describe("A4: 抽選される種類は 15 以上", () => {
  it("arc-only を除いた種類が 15 以上", () => {
    expect(drawn.length).toBeGreaterThanOrEqual(15);
  });
});

describe("A5: 各種類に人生の筋の入口が 2 本以上", () => {
  it("抽選される全種類で、入口が 2 本以上あり、arcs.json に実在する", () => {
    for (const a of drawn) {
      const ids = entrances(a.id);
      expect(ids.length, `${a.id} の入口`).toBeGreaterThanOrEqual(2);
      for (const id of ids) expect(arcIds.has(id), `${a.id}: ${id}`).toBe(true);
    }
  });
});

describe("A6: 新しい種類の参照整合と装飾の容量", () => {
  it("contentErrors が 0 件（新しい種類の分も含む）", () => {
    expect(contentErrors(defaultContent)).toEqual([]);
    for (const id of NEW_IDS) expect(defaultContent.archetypes[id], id).toBeDefined();
  });
});

describe("A7: 新しい種類でシード 1〜10 の新規ゲームを 60 日進める", () => {
  it("例外が出ず、新しい種類が 1 人以上どこかのシードで登場する", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const rng = createRng(seed);
      const s0 = newGame(rng);
      for (const r of s0.res) seen.add(r.job);
      const s = step(s0, 60 * 1440, rng);
      for (const r of s.res) seen.add(r.job);
    }
    expect(NEW_IDS.some((id) => seen.has(id))).toBe(true);
  });
});

describe("追加: 新しい種類の筋と本文", () => {
  it("新しい種類は arc-only でなく、全員が arc をもち、筋は入口から 3 段以上続く", () => {
    for (const id of NEW_IDS) {
      const a = defaultContent.archetypes[id]!;
      expect(a.tags, id).not.toContain("arc-only");
      expect(a.arc, id).toBeDefined();
      for (const branch of entrances(id)) {
        const next = storyById
          .get(branch)!
          .effects.flatMap((e) => (e.type === "book" ? e.next.map((n) => n.id) : []));
        const ends = storyById
          .get(branch)!
          .effects.some((e) => e.type === "moveOut" || e.type === "changeJob");
        // 入口（1 段）→ 分岐先（2 段）→ さらに次の出来事（3 段）
        expect(next.length > 0 || ends, `${id}: ${branch}`).toBe(true);
      }
    }
  });

  it("新しい筋の本文には、言い回しが 2 つ以上あり、数値の増減もお金の額も書かない", () => {
    const fresh = defaultContent.storylets.filter(
      (s) => s.kind === "arc" && NEW_IDS.some((id) => s.roles.a?.archetype?.includes(id))
    );
    expect(fresh.length).toBeGreaterThanOrEqual(NEW_IDS.length * 5);
    for (const s of fresh) {
      expect(s.texts.length, s.id).toBeGreaterThanOrEqual(2);
      for (const t of s.texts) expect(t, s.id).not.toMatch(/[+\-＋－%％0-9０-９円]/);
    }
  });

  it("新しい種類には各 2 つ以上の装飾と 2 つ以上の癖の候補がある", () => {
    for (const id of NEW_IDS) {
      const a = defaultContent.archetypes[id]!;
      expect(a.decor.required.length + a.decor.pool.length, id).toBeGreaterThanOrEqual(5);
      expect(a.traits.length, id).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("追加: town の slot ごとに置ける look（最初の段階も slot に合わせる）", () => {
  const first = { east: "lot", pole: "pole" } as const;
  const town = (slot: "east" | "pole", looks: string[]) => ({
    id: "t",
    slot,
    startYear: 0,
    chance: 1,
    stages: [
      { look: first[slot] },
      ...looks.map((look, i) => ({ look, afterDays: i + 1 })),
    ],
  });
  const ok = (slot: "east" | "pole", looks: string[]) =>
    townChangeSchema.safeParse(town(slot, looks)).success;

  it("pole は pole→underground だけ通り、mansion・fence・lot を含むと弾かれる", () => {
    expect(ok("pole", ["underground"])).toBe(true);
    expect(ok("pole", ["mansion"])).toBe(false);
    expect(ok("pole", ["fence"])).toBe(false);
    expect(ok("pole", ["lot"])).toBe(false);
  });

  it("east は lot→fence→mansion が通り、pole・underground を含むと弾かれる", () => {
    expect(ok("east", ["fence", "mansion"])).toBe(true);
    expect(ok("east", ["pole"])).toBe(false);
    expect(ok("east", ["underground"])).toBe(false);
  });
});
