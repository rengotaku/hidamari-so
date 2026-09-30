import { beforeEach, describe, expect, it } from "vitest";
import { defaultContent, storyletSchema, type Content } from "@/content";
import { createRng, newGame, step, type GameState } from "@/sim";
import type { Ctx } from "@/sim/context";
import { fireStorylet } from "@/sim/storylets";
import { SAVE_KEY, SCHEMA_VERSION, loadGame, saveGame } from "@/save";

beforeEach(() => localStorage.clear());

const leave = storyletSchema.parse({
  id: "leave",
  kind: "happening",
  trigger: "book",
  roles: { a: {} },
  texts: ["{a}さんが出ていった"],
  effects: [{ type: "moveOut", role: "a" }],
});
const content: Content = {
  ...defaultContent,
  storylets: [...defaultContent.storylets.filter((s) => s.id.startsWith("room-")), leave],
};

/** 退去が起きて、大家が新しい住人を連れて歩いている最中の状態 */
function midEscort(): { s: GameState; rngState: number } {
  const rng = createRng(5);
  let s = newGame(rng, content);
  const c: Ctx = { s: structuredClone(s), rng, quiet: true, content };
  fireStorylet(c, "leave", { a: c.s.res[0]! });
  s = c.s;
  for (let i = 0; i < 6 * 1440 && s.landlord.phase !== "escort"; i++)
    s = step(s, 5, rng, { content });
  expect(s.landlord.phase).toBe("escort");
  return { s, rngState: rng.getState() };
}

describe("追加: 大家・退去後の部屋・装飾の保存", () => {
  it("大家が新しい住人を連れて歩いている最中でも、保存して読み直すと同じ状態に戻る", () => {
    const { s, rngState } = midEscort();
    expect(s.landlord.escort).not.toBeNull();
    expect(saveGame(localStorage, s, rngState, 1000)).toBe(true);
    const loaded = loadGame(localStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(s);
  });

  /** 現行の保存から、足した項目を取り除いた「古い v2」の封筒を作る */
  function oldV2(strip: Array<"decor" | "town" | "speed">) {
    const rng = createRng(8);
    const s = step(newGame(rng), 2 * 1440, rng);
    const state = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete state.vacancies;
    delete state.landlord;
    for (const r of state.res as Record<string, unknown>[]) {
      delete r.decorPlan;
      delete r.settled;
    }
    if (strip.includes("decor")) delete state.decor;
    if (strip.includes("town")) delete state.town;
    const env: Record<string, unknown> = {
      schemaVersion: 2,
      savedAt: 1,
      rngState: rng.getState(),
      speed: 4,
      state,
    };
    if (strip.includes("speed")) delete env.speed;
    return { env, s };
  }
  const put = (env: unknown) => localStorage.setItem(SAVE_KEY, JSON.stringify(env));

  it("版は上げない: 保存される版は 2 のまま", () => {
    expect(SCHEMA_VERSION).toBe(2);
    const { s } = midEscort();
    saveGame(localStorage, s, 1, 1);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).schemaVersion).toBe(2);
  });

  it("装飾・大家が欠けた v2（town なし）は、装飾がそろった状態に補って読める", () => {
    const { env } = oldV2(["decor", "town"]);
    put(env);
    const l = loadGame(localStorage)!.state;
    expect(l.town).toEqual({});
    expect(l.vacancies).toEqual([]);
    expect(l.landlord.phase).toBe("idle");
    for (const r of l.res) {
      const arch = defaultContent.archetypes[r.job]!;
      for (const id of arch.decor.required) expect(r.decorPlan).toContain(id);
      expect(r.settled).toBe(r.decorPlan.length);
      expect([...l.decor[r.room]!.items].sort()).toEqual([...r.decorPlan].sort());
    }
    const empty = l.rooms.findIndex((id) => id === null);
    expect(l.decor[empty]).toEqual({ items: [], boxes: 0 });
    expect(() => step(l, 600, createRng(1))).not.toThrow();
  });

  it("town ありの v2（装飾は欠け）も、town を保ったまま補って読める", () => {
    const { env } = oldV2(["decor"]);
    const state = env.state as Record<string, unknown>;
    state.town = { "east-lot": { start: 100, stage: 1 } };
    put(env);
    const l = loadGame(localStorage)!.state;
    expect(l.town).toEqual({ "east-lot": { start: 100, stage: 1 } });
    expect(l.res.every((r) => r.decorPlan.length > 0)).toBe(true);
  });

  it("補完は決定的: 同じ保存からは同じ状態になる", () => {
    const { env } = oldV2(["decor", "town"]);
    put(env);
    const a = loadGame(localStorage)!.state;
    put(env);
    const b = loadGame(localStorage)!.state;
    expect(b).toEqual(a);
  });

  it("速さの項目は、あってもなくても読める", () => {
    put(oldV2(["decor"]).env);
    expect(loadGame(localStorage)!.speed).toBe(4);
    put(oldV2(["decor", "speed"]).env);
    expect(loadGame(localStorage)!.speed).toBe(1);
  });

  it("装飾などが揃った保存は、補わずそのまま読める", () => {
    const { s, rngState } = midEscort();
    saveGame(localStorage, s, rngState, 5);
    const first = loadGame(localStorage)!.state;
    expect(first).toEqual(s);
    // 揃った保存の装飾を書き換えても、補完で上書きされない
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    raw.state.decor[0].items = ["fan"];
    put(raw);
    expect(loadGame(localStorage)!.state.decor[0]!.items).toEqual(["fan"]);
  });

  it("壊れた decor（配列でない・箇所が足りない・boxes が負）の保存は読まない", () => {
    const { s, rngState } = midEscort();
    saveGame(localStorage, s, rngState, 5);
    const base = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    for (const bad of [
      "x",
      [],
      [{ items: "a", boxes: 0 }],
      s.decor.map((d) => ({ ...d, boxes: -1 })),
    ]) {
      const raw = structuredClone(base);
      raw.state.decor = bad;
      put(raw);
      expect(loadGame(localStorage)).toBeNull();
    }
    const raw = structuredClone(base);
    raw.state.landlord = { phase: "dancing" };
    put(raw);
    expect(loadGame(localStorage)).toBeNull();
  });
});
