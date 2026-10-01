import { beforeAll, describe, it, expect } from "vitest";
import { defaultContent, type Storylet } from "@/content";
import { createRng, newGame, step, decideBuyout, isBuyoutPending, seasonOf } from "@/sim";

/** 修正前（#44 の着手前の main）の、20 シード × 180 日の実測値 */
const BEFORE = {
  /** hour で実際に起きた出来事の総数 */
  hourTotal: 12415,
  /** 180 日目に同棲のまま残り、proposal の予約も持たない組の数 */
  stuckCohabiting: 0,
  /** love-advice の回数 */
  loveAdvice: 260,
  /** blind-date-fail の回数 */
  blindDateFail: 47,
};
const SEEDS = 20;
const DAYS = 180;

interface Played {
  counts: Record<string, number>;
  hourTotal: number;
  stuckCohabiting: number;
}

/** 20 シードを 180 日進める（築 50 年の記念日は「断る」で続ける）。出来事の回数と、同棲のまま止まった組を数える */
function playAll(): Played {
  const trigger = new Map(defaultContent.storylets.map((s) => [s.id, s.trigger]));
  const counts: Record<string, number> = {};
  let hourTotal = 0;
  let stuckCohabiting = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const rng = createRng(seed);
    let s = newGame(rng);
    for (let d = 0; d < DAYS; d++) {
      const from = s.t;
      s = step(s, 1440, rng);
      if (isBuyoutPending(s)) s = decideBuyout(s, "decline", rng);
      for (const e of s.log) {
        if (!("storyletId" in e) || e.t < from) continue;
        counts[e.storyletId] = (counts[e.storyletId] ?? 0) + 1;
        if (trigger.get(e.storyletId) === "hour") hourTotal++;
      }
    }
    const present = new Set(s.res.map((r) => r.id));
    for (const b of s.bonds) {
      if (b.stage !== "cohabiting" || !present.has(b.a) || !present.has(b.b)) continue;
      const booked = s.booked.some(
        (k) => k.id === "proposal" && (k.roles.a === b.a || k.roles.a === b.b)
      );
      if (!booked) stuckCohabiting++;
    }
  }
  return { counts, hourTotal, stuckCohabiting };
}

describe("22-16: 恋人向けの出来事が、実際に起きる", () => {
  let played: Played;
  beforeAll(() => {
    played = playAll();
  }, 120_000);
  const n = (id: string): number => played.counts[id] ?? 0;

  it("R16-1: quarrel / makeup / silent-day / pillow-talk / kitchen-together がそれぞれ 5 回以上起きる", () => {
    for (const id of [
      "lv-quarrel",
      "lv-makeup",
      "lv-silent-day",
      "lv-pillow-talk",
      "lv-kitchen-together",
    ])
      expect(n(id), id).toBeGreaterThanOrEqual(5);
  });

  it("R16-2: dark-lights と date-rain がそれぞれ 3 回以上起きる", () => {
    for (const id of ["lv-dark-lights", "lv-date-rain"])
      expect(n(id), id).toBeGreaterThanOrEqual(3);
  });

  it("R16-3: proposal が 30 回以上起き、同棲のまま残る組が修正前より増えない", () => {
    expect(n("proposal")).toBeGreaterThanOrEqual(30);
    expect(played.stuckCohabiting).toBeLessThanOrEqual(BEFORE.stuckCohabiting);
  });

  it("R16-4: hour で実際に起きた出来事の総数が、修正前の 0.95 倍以上", () => {
    expect(played.hourTotal).toBeGreaterThanOrEqual(BEFORE.hourTotal * 0.95);
  });

  it("R16-5: love-advice と blind-date-fail の回数が、修正前の 0.8 倍以上", () => {
    expect(n("lv-love-advice")).toBeGreaterThanOrEqual(BEFORE.loveAdvice * 0.8);
    expect(n("lv-blind-date-fail")).toBeGreaterThanOrEqual(BEFORE.blindDateFail * 0.8);
  });
});

type Chain = Pick<Storylet, "id" | "trigger" | "cooldownDays" | "effects">;

/** 出来事 id から予約される先（id と afterMinutes の組）を全部返す */
function bookings(st: Chain): { id: string; after: [number, number] }[] {
  return st.effects.flatMap((e) =>
    e.type === "book" ? e.next.map((n) => ({ id: n.id, after: e.afterMinutes })) : []
  );
}

/** id から先へ予約をたどったときの、最長の経路の分数（afterMinutes の上限の合計）。循環は 1 周で打ち切る */
function longestPath(
  byId: Map<string, Chain>,
  id: string,
  seen: ReadonlySet<string>
): number {
  const st = byId.get(id);
  if (!st || seen.has(id)) return 0;
  const next = new Set([...seen, id]);
  return Math.max(
    0,
    ...bookings(st).map((b) => b.after[1] + longestPath(byId, b.id, next))
  );
}

/**
 * 恋の段階を進める先頭。同じ組には段階の条件で二度起きないので、cooldown で重なりを防ぐ対象にしない
 * （cooldown を最長経路の 59 日にすると、proposal が 38 → 28 回に減って R16-3 が赤になる。#44 で合意）
 */
const STAGE_GATED_HEADS: ReadonlySet<string> = new Set(["lv-cooked-for", "crush-start"]);

/** 連鎖の先頭（book で呼ばれず、自分は予約を出す出来事）のうち、cooldown が最長経路に満たないものの id */
function shortCooldownHeads(list: readonly Chain[]): string[] {
  const byId = new Map(list.map((s) => [s.id, s]));
  return list
    .filter((s) => s.trigger !== "book" && bookings(s).length > 0)
    .filter((s) => !STAGE_GATED_HEADS.has(s.id))
    .filter((s) => (s.cooldownDays ?? 0) * 1440 < longestPath(byId, s.id, new Set()))
    .map((s) => s.id);
}

describe("22-17: 連鎖の先頭の cooldown は、予約の最長経路以上", () => {
  it("22-17-1: 連鎖の先頭すべてで、cooldown が最長経路以上", () => {
    expect(shortCooldownHeads(defaultContent.storylets)).toEqual([]);
  });

  it("22-17-2(negative control): cooldown 1 日で [2880, 2880] の予約を持つ先頭は検出される", () => {
    const fake: Chain[] = [
      {
        id: "fake-head",
        trigger: "hour",
        cooldownDays: 1,
        effects: [
          {
            type: "book",
            next: [{ id: "fake-tail", weight: 1 }],
            afterMinutes: [2880, 2880],
          },
        ],
      },
      { id: "fake-tail", trigger: "book", effects: [] },
    ];
    expect(shortCooldownHeads(fake)).toEqual(["fake-head"]);
  });

  it("22-17-3: 夏のいちばん早い時刻にすくってから結末までの最短時刻が 18 日以上（年が明けた、と矛盾しない）", () => {
    const byId = new Map(defaultContent.storylets.map((s) => [s.id, s]));
    const catchSt = byId.get("gf-catch")!;
    const firstSummerDay = Array.from({ length: 18 }, (_, i) => i + 1).find(
      (d) => seasonOf(d) === "summer"
    )!;
    const earliest = (firstSummerDay - 1) * 1440 + catchSt.when!.hours![0] * 60;
    /** gf-survive までの最短の経路（afterMinutes の下限の合計） */
    const shortest = (id: string, seen: ReadonlySet<string>): number => {
      if (id === "gf-survive") return 0;
      const st = byId.get(id);
      if (!st || seen.has(id)) return Infinity;
      const next = new Set([...seen, id]);
      return Math.min(
        Infinity,
        ...bookings(st).map((b) => b.after[0] + shortest(b.id, next))
      );
    };
    expect(earliest + shortest("gf-catch", new Set())).toBeGreaterThanOrEqual(18 * 1440);
  });
});
