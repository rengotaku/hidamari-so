import { describe, it, expect, beforeEach } from "vitest";
import { defaultContent } from "@/content";
import { createRng, newGame, step, type GameState, type LogEntry } from "@/sim";
import { SAVE_KEY, SCHEMA_VERSION, loadGame, saveGame } from "@/save";

type StoryletEntry = Extract<LogEntry, { storyletId: string }>;
const DAY = 1440;
const ids = (s: GameState): string[] =>
  s.log.filter((e): e is StoryletEntry => "storyletId" in e).map((e) => e.storyletId);

describe("入居の一本化: 大家が新入居者を連れて来る", () => {
  it("退去の数日後に大家が新入居者を連れて来て、入居の日誌は住人ごとに重複せず、歓迎会が開かれる", () => {
    let newcomerLeft = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const rng = createRng(seed);
      let s = newGame(rng);
      const target = s.res[0]!;
      const targetRoom = target.room;
      s.booked = [
        { id: "moveout-good", at: s.t + 60, roles: { a: target.id }, tries: 0 },
      ];
      const moveIns: StoryletEntry[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < 14 * 24; i++) {
        const before = s.t;
        s = step(s, 60, rng);
        for (const e of s.log)
          if ("storyletId" in e && e.t > before) {
            seen.add(e.storyletId);
            if (e.storyletId === "room-move-in") moveIns.push(e);
          }
      }
      expect(s.res.some((r) => r.id === target.id)).toBe(false);
      // 新入居者が期間内に退去して次の入居が起きるシードもあるので、件数ではなく重複の有無を見る
      expect(moveIns.length).toBeGreaterThanOrEqual(1);
      const moved = moveIns.map((e) => e.roles.a!.id);
      expect(new Set(moved).size).toBe(moved.length);
      expect(moveIns[0]!.roles.a!.room).toBe(targetRoom);
      expect(seen.has("welcome-party")).toBe(true);
      const newcomerId = moved[0]!;
      const newcomer =
        s.res.find((r) => r.id === newcomerId) ??
        s.departed.find((r) => r.id === newcomerId);
      expect(newcomer).toBeDefined();
      expect(defaultContent.archetypes[newcomer!.job]!.tags).not.toContain("arc-only");
      if (s.departed.some((r) => r.id === newcomerId)) newcomerLeft++;
    }
    // 新入居者が期間内に退去するシードを含む（件数で見ていた頃に赤になる形を塞ぐ）
    expect(newcomerLeft).toBeGreaterThanOrEqual(1);
  });

  it("同棲で空いた部屋にも、大家が片付けてから新入居者を連れて来る", () => {
    const rng = createRng(3);
    const s0 = newGame(rng);
    const [x, y] = [s0.res[0]!, s0.res[1]!];
    x.age = 30;
    y.age = 30;
    const [lo, hi] = x.id < y.id ? [x.id, y.id] : [y.id, x.id];
    s0.bonds = [{ a: lo, b: hi, affinity: 100, stage: "dating" }];
    s0.booked = [
      { id: "moving-in", at: s0.t + 60, roles: { a: x.id, b: y.id }, tries: 0 },
    ];
    const oldRoom = x.room;
    let s = s0;
    let opened = false;
    for (let i = 0; i < 12 * 24; i++) {
      s = step(s, 60, rng);
      if (s.vacancies.some((v) => v.room === oldRoom)) opened = true;
    }
    expect(s.res.find((r) => r.id === x.id)!.room).toBe(y.room);
    expect(opened).toBe(true);
  });
});

describe("自動の大家: 家賃と滞納", () => {
  it("家賃が払えない住人がいると、滞納の言い訳が日誌に出る。大家の所持金は増減する", () => {
    const rng = createRng(21);
    const s0 = newGame(rng);
    let s = s0;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      s = step(s, DAY, rng);
      // 日誌は新しい 120 件までなので、1 日ごとの差分で集める
      for (const id of ids(s)) seen.add(id);
    }
    expect(seen.has("rent-late-excuse")).toBe(true);
    expect(s.landlordMoney).not.toBe(s0.landlordMoney);
    expect(Number.isFinite(s.landlordMoney)).toBe(true);
  });

  it("設備が年月とともに増え、日誌に出る（大家の所持金がマイナスでも増える）", () => {
    const rng = createRng(31);
    const s0 = newGame(rng);
    s0.landlordMoney = -5_000_000;
    let s = s0;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      s = step(s, DAY, rng);
      for (const id of ids(s)) if (id.startsWith("facility-")) seen.add(id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe("人生の筋: 入院と退院", () => {
  it("入院すると部屋から姿を消し、退院の日誌が出て部屋に戻る", () => {
    const rng = createRng(41);
    let s = newGame(rng);
    const r = s.res[0]!;
    r.job = "oldman";
    r.at = r.room;
    r.visiting = false;
    r.act = "idle";
    // 入居時に予約された人生の筋は外し、この 1 件だけを検証する
    s.booked = [];
    s.booked.push({ id: "oldman-fall-ill", at: s.t + 60, roles: { a: r.id }, tries: 0 });
    let away = false;
    const mine = new Set<string>();
    for (let i = 0; i < 12 * 24; i++) {
      const before = s.t;
      s = step(s, 60, rng);
      const now = s.res.find((x) => x.id === r.id)!;
      if (typeof now.at !== "number") away = true;
      // 日誌は新しい 120 件までなので、毎時の差分で集める
      for (const e of s.log)
        if ("storyletId" in e && e.t > before && e.roles.a?.id === r.id)
          mine.add(e.storyletId);
    }
    expect(mine.has("oldman-fall-ill")).toBe(true);
    expect(mine.has("oldman-discharge")).toBe(true);
    expect(away).toBe(true);
    expect(s.res.some((x) => x.id === r.id)).toBe(true);
  });
});

describe("保存: 版 2 のまま項目を足した", () => {
  beforeEach(() => localStorage.clear());

  it("大家の所持金（マイナスも）・出ていった住人・買収提案の状態が保存と読み込みで保たれる", () => {
    const rng = createRng(51);
    let s = newGame(rng);
    s.booked.push({
      id: "farewell-party",
      at: s.t + 60,
      roles: { a: s.res[0]!.id },
      tries: 0,
    });
    s = step(s, 54 * DAY, rng);
    s.landlordMoney = -123456;
    expect(s.departed.length).toBeGreaterThan(0);
    expect(s.buyout.phase).toBe("pending");
    saveGame(localStorage, s, rng.getState(), 1);
    const loaded = loadGame(localStorage)!;
    expect(loaded.state.landlordMoney).toBe(-123456);
    expect(loaded.state.departed).toEqual(s.departed);
    expect(loaded.state.buyout).toEqual(s.buyout);
  });

  it("版 2 の保存は、新しい項目を既定値で埋めて読める", () => {
    const rng = createRng(52);
    const s = step(newGame(rng), 3 * DAY, rng);
    saveGame(localStorage, s, rng.getState(), 1);
    const env = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    const { landlordMoney, departed, buyout, ...old } = env.state;
    expect([landlordMoney, departed, buyout].every((v) => v !== undefined)).toBe(true);
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...env, schemaVersion: 2, state: old })
    );
    const loaded = loadGame(localStorage)!;
    expect(loaded).not.toBeNull();
    expect(loaded.state.buyout).toEqual({ phase: "none", voice: null });
    expect(loaded.state.departed).toEqual([]);
    expect(loaded.state.landlordMoney).toBe(200000);
    expect(SCHEMA_VERSION).toBe(2);
  });
});
