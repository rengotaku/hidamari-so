import { describe, it, expect, afterEach, vi } from "vitest";
import { createRng, newGame, step, MIN_PER_SEC } from "@/sim";
import { saveGame } from "@/save";
import { GameEngine, defaultStorage } from "@/ui/engine";
import { statusText } from "@/ui/text";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("追加: GameEngine", () => {
  it("保存が無ければ seed から新しく始まる", () => {
    const e = GameEngine.open(localStorage, 5, 1000);
    expect(e.state).toEqual(newGame(createRng(5)));
  });

  it("tick でゲーム内時間が進み、save → open で続きから再開する", () => {
    const e = GameEngine.open(localStorage, 5, 1000);
    const t0 = e.state.t;
    e.tick(30);
    expect(e.state.t).toBe(t0 + 30);
    e.save(localStorage, 2000);
    const e2 = GameEngine.open(localStorage, 999, 2000);
    expect(e2.state).toEqual(e.state);
  });

  it("開くときに、留守にしていた時間ぶん進む", () => {
    const rng = createRng(1);
    const s = step(newGame(rng), 60, rng);
    saveGame(localStorage, s, rng.getState(), 10_000);
    const e = GameEngine.open(localStorage, 1, 10_000 + 30 * 1000);
    expect(e.state.t - s.t).toBe(30 * MIN_PER_SEC);
  });
});

describe("追加: defaultStorage", () => {
  it("localStorage が使えないときはメモリ上の代替で動く", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    const s = defaultStorage();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    s.removeItem("k");
    expect(s.getItem("k")).toBeNull();
  });
});

describe("追加: statusText", () => {
  it("外出・歩行・訪問・部屋の中を言葉にする", () => {
    const rng = createRng(1);
    const s = newGame(rng);
    const [a, b] = s.res;
    const base = { ...a! };
    expect(
      statusText(s, {
        ...base,
        at: "out",
        outPurpose: "work",
        shift: { label: "会社", pay: 1 },
      })
    ).toBe("外出中（会社）");
    expect(
      statusText(s, { ...base, at: "out", outPurpose: "konbini", shift: null })
    ).toBe("外出中（コンビニ）");
    expect(statusText(s, { ...base, at: "out", outPurpose: "sento", shift: null })).toBe(
      "外出中（銭湯）"
    );
    expect(statusText(s, { ...base, at: "out", outPurpose: null, shift: null })).toBe(
      "外出中"
    );
    expect(statusText(s, { ...base, at: "walking", walkMode: "leave" })).toBe(
      "出かけるところ"
    );
    expect(statusText(s, { ...base, at: "walking", walkMode: "return" })).toBe("帰り道");
    expect(statusText(s, { ...base, at: b!.room, visiting: true })).toBe(
      `${b!.sei}さんの部屋にいる`
    );
    expect(statusText(s, { ...base, at: base.room, visiting: false, act: "sleep" })).toBe(
      "寝ている"
    );
  });
});
