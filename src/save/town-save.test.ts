import { describe, it, expect, beforeEach } from "vitest";
import { createRng, newGame, step } from "@/sim";
import { SAVE_KEY, SCHEMA_VERSION, loadGame, saveGame } from "@/save";

beforeEach(() => {
  localStorage.clear();
});

describe("追加: 季節・町並みの保存", () => {
  it("雪の日・町の変化・町の日誌を含む状態が保存と読み込みで一致する", () => {
    const rng = createRng(3);
    const s = {
      ...newGame(rng),
      weather: "snow" as const,
      town: { "east-lot": { start: 1000, stage: 1 } },
    };
    s.log.unshift({ t: 1440, kind: "town", changeId: "east-lot", stage: 1 });
    expect(saveGame(localStorage, s, rng.getState(), 5)).toBe(true);
    expect(loadGame(localStorage)!.state).toEqual(s);
  });

  it("town を持たない保存（この機能の前の保存）も読めて、町は何も変わっていない扱いになる", () => {
    const rng = createRng(4);
    const s = step(newGame(rng), 300, rng);
    saveGame(localStorage, s, rng.getState(), 5);
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    delete raw.state.town;
    localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
    const loaded = loadGame(localStorage);
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.town).toEqual({});
  });

  it("壊れた town（段階が負）の保存は読まない", () => {
    const rng = createRng(4);
    const s = newGame(rng);
    saveGame(localStorage, s, rng.getState(), 5);
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    raw.state.town = { x: { start: 0, stage: -1 } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
    expect(loadGame(localStorage)).toBeNull();
  });
});
