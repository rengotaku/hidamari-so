import { beforeEach, describe, expect, it } from "vitest";
import { defaultContent } from "@/content";
import { composeEntry, createRng, newGame, step } from "@/sim";
import { SAVE_KEY, SCHEMA_VERSION, loadGame, loadOrNew } from "@/save";
import { MIGRATIONS, migrateSave } from "./migrate";

beforeEach(() => localStorage.clear());

/** #2 の保存形式（schemaVersion 1: 日誌は組み立て済みの文字列、関係・予約・履歴は無い）を作る */
function v1Envelope(mutate: (state: Record<string, unknown>) => void = () => undefined) {
  const rng = createRng(4);
  const s = step(newGame(rng), 3 * 1440, rng);
  const state = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  delete state.bonds;
  delete state.booked;
  delete state.story;
  state.log = [
    { t: 100, text: "── 1日目 ──", kind: "day" },
    { t: 200, text: "田中さんが掃除をした。ゴミ袋五個", kind: "" },
  ];
  mutate(state);
  return { s, env: { schemaVersion: 1, savedAt: 1000, rngState: rng.getState(), state } };
}

describe("追加: 保存形式の移行", () => {
  it("v1 の保存を読むと、住人・時刻・部屋・乱数が保たれ、新規ゲームで上書きされない", () => {
    const { s, env } = v1Envelope();
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    const loaded = loadGame(localStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.t).toBe(s.t);
    expect(loaded!.state.rooms).toEqual(s.rooms);
    expect(loaded!.state.res).toEqual(s.res);
    expect(loaded!.rngState).toBe(env.rngState);
    expect(loaded!.savedAt).toBe(1000);
    const opened = loadOrNew(localStorage, 999);
    expect(opened.savedAt).toBe(1000);
    expect(opened.state.res.map((r) => r.sei)).toEqual(s.res.map((r) => r.sei));
  });

  it("古い日誌の文字列は捨て、ノートを替えた旨の出来事が 1 件だけ入る", () => {
    const { env } = v1Envelope();
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    const { log } = loadGame(localStorage)!.state;
    expect(log.length).toBe(1);
    const text = composeEntry(defaultContent, log[0]!);
    expect(text).toContain("ノート");
  });

  it("移行後の状態はそのまま進められ、保存し直すと最新の版になる", () => {
    const { env } = v1Envelope();
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    const opened = loadOrNew(localStorage, 1);
    const after = step(opened.state, 600, opened.rng);
    expect(after.t).toBe(opened.state.t + 600);
    expect(JSON.parse(JSON.stringify(after)).bonds).toBeDefined();
    expect(migrateSave({ ...env, schemaVersion: 2 }, SCHEMA_VERSION)!.schemaVersion).toBe(
      2
    );
  });

  it("知らない種類・癖の id が入った v1 の住人は、知っている値に寄せて読める", () => {
    const { env } = v1Envelope((state) => {
      const res = state.res as Record<string, unknown>[];
      res[0]!.job = "no-such-job";
      res[0]!.traits = ["nebou", "no-such-trait"];
      res[1]!.job = "constructor";
    });
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    const loaded = loadGame(localStorage)!;
    for (const r of loaded.state.res) {
      expect(Object.hasOwn(defaultContent.archetypes, r.job)).toBe(true);
      for (const t of r.traits)
        expect(Object.hasOwn(defaultContent.traits, t)).toBe(true);
    }
    expect(loaded.state.res[0]!.traits).toEqual(["nebou"]);
  });

  it("未来の版・版が無い・整数でない・壊れた v1 は null（新規ゲーム）", () => {
    const { env } = v1Envelope();
    for (const bad of [
      { ...env, schemaVersion: SCHEMA_VERSION + 1 },
      { ...env, schemaVersion: 0 },
      { ...env, schemaVersion: 1.5 },
      { ...env, schemaVersion: "1" },
      { savedAt: 1, rngState: 1, state: env.state },
      { ...env, state: null },
      { ...env, state: { t: 1 } },
    ]) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
      expect(loadGame(localStorage)).toBeNull();
    }
    expect(loadOrNew(localStorage, 2).savedAt).toBeNull();
  });

  it("登録表は 1 から最新の手前まで途切れなく並んでいる", () => {
    for (let v = 1; v < SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf("function");
    expect(migrateSave({ schemaVersion: 1 }, 3)).toBeNull();
  });
});
