import { describe, it, expect, beforeEach } from "vitest";
import { createRng, newGame, step, MIN_PER_SEC } from "@/sim";
import {
  SAVE_KEY,
  SCHEMA_VERSION,
  MAX_CATCHUP_MINUTES,
  saveGame,
  loadGame,
  loadOrNew,
  catchUp,
  createAwayTracker,
} from "@/save";

beforeEach(() => {
  localStorage.clear();
});

function savedSample() {
  const rng = createRng(1);
  const s = step(newGame(rng), 600, rng);
  saveGame(localStorage, s, rng.getState(), 1000);
  return { s, rngState: rng.getState() };
}

describe("A4: 留守中の進行", () => {
  it("経過が負・0 なら状態は変わらない", () => {
    const { s } = savedSample();
    const loaded = loadGame(localStorage)!;
    const rng = createRng(loaded.rngState);
    expect(catchUp(loaded.state, -1000, rng)).toEqual(s);
    expect(catchUp(loaded.state, 0, rng)).toEqual(s);
  });

  it("ゲーム内 10 日相当の実時間はゲーム内 3 日で打ち切られる", () => {
    const { s } = savedSample();
    const loaded = loadGame(localStorage)!;
    const rng = createRng(loaded.rngState);
    const tenDaysMs = ((10 * 1440) / MIN_PER_SEC) * 1000;
    const after = catchUp(loaded.state, tenDaysMs, rng);
    expect(after.t - s.t).toBe(3 * 1440);
    expect(MAX_CATCHUP_MINUTES).toBe(3 * 1440);
  });

  it("追加: 上限未満はそのぶんだけ進む（実時間 30 秒 = ゲーム内 60 分）", () => {
    const { s } = savedSample();
    const rng = createRng(1);
    const after = catchUp(s, 30 * 1000, rng);
    expect(after.t - s.t).toBe(60);
  });

  it("追加: NaN / Infinity は無視する", () => {
    const { s } = savedSample();
    const rng = createRng(1);
    expect(catchUp(s, Number.NaN, rng)).toEqual(s);
    expect(catchUp(s, Number.POSITIVE_INFINITY, rng)).toEqual(s);
  });

  it("追加: 進行が 1 分に満たないときは何もしない", () => {
    const { s } = savedSample();
    expect(catchUp(s, 100, createRng(1))).toEqual(s);
  });
});

describe("A5: 保存と読み込み", () => {
  it("保存 → 読み込みで同じ状態に戻る", () => {
    const { s, rngState } = savedSample();
    const loaded = loadGame(localStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(s);
    expect(loaded!.rngState).toBe(rngState);
    expect(loaded!.savedAt).toBe(1000);
  });

  it("保存内容に schemaVersion が入る", () => {
    savedSample();
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(raw.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("schemaVersion が不明なデータは新しいゲームになり、例外は出ない", () => {
    savedSample();
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    raw.schemaVersion = 999;
    localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
    expect(() => loadOrNew(localStorage, 55)).not.toThrow();
    const r = loadOrNew(localStorage, 55);
    expect(r.savedAt).toBeNull();
    expect(r.state).toEqual(newGame(createRng(55)));
  });

  it("追加: 壊れた JSON・空・形が違うデータでも新しいゲームになる", () => {
    for (const bad of [
      "{oops",
      "",
      "null",
      "[]",
      '{"schemaVersion":1}',
      '{"schemaVersion":1,"savedAt":1,"rngState":1,"state":{"t":1}}',
    ]) {
      localStorage.setItem(SAVE_KEY, bad);
      expect(loadGame(localStorage)).toBeNull();
      const r = loadOrNew(localStorage, 8);
      expect(r.savedAt).toBeNull();
      expect(r.state.res.length).toBeGreaterThan(0);
    }
  });

  it("追加: 保存が無いときも新しいゲームになる", () => {
    const r = loadOrNew(localStorage, 8);
    expect(r.savedAt).toBeNull();
  });

  it("追加: storage が書き込みに失敗しても例外を出さない", () => {
    const full = {
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
    };
    const rng = createRng(1);
    expect(() => saveGame(full, newGame(rng), rng.getState(), 1)).not.toThrow();
  });
});

describe("追加: 保存データの厳密な検証", () => {
  function tamper(
    edit: (raw: {
      state: { res: Record<string, unknown>[] } & Record<string, unknown>;
    }) => void
  ) {
    savedSample();
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    edit(raw);
    localStorage.setItem(SAVE_KEY, JSON.stringify(raw));
  }

  it("住人の必須フィールド欠落・不正値の保存は読み込まれず新規ゲームになる", () => {
    const edits: Array<(r: { state: { res: Record<string, unknown>[] } }) => void> = [
      (r) => delete r.state.res[0]!.bubble,
      (r) => (r.state.res[0]!.job = ""),
      (r) => delete r.state.res[0]!.hunger,
      (r) => (r.state.res[0]!.act = "moonwalk"),
      (r) => (r.state.res[0]!.traits = ["unknown"]),
      (r) => (r.state.res[0]!.hunger = 1e9),
    ];
    for (const edit of edits) {
      tamper(edit);
      expect(loadGame(localStorage)).toBeNull();
      expect(loadOrNew(localStorage, 3).savedAt).toBeNull();
    }
  });

  it("lastHour が t と食い違う・t が負の保存は拒否する", () => {
    tamper((r) => (r.state.lastHour = -1e20));
    expect(loadGame(localStorage)).toBeNull();
    tamper((r) => (r.state.t = -5));
    expect(loadGame(localStorage)).toBeNull();
  });
});

describe("追加: タブが非表示だった時間", () => {
  it("非表示 → 表示で経過ミリ秒を返し、二重には返さない", () => {
    let now = 1000;
    const t = createAwayTracker(() => now);
    expect(t.show()).toBe(0);
    t.hide();
    now = 6000;
    expect(t.show()).toBe(5000);
    expect(t.show()).toBe(0);
  });
});

describe("S7: snowDays を持たない古い保存", () => {
  it("読めて、snowDays は 0 で補われる", () => {
    const { s } = savedSample();
    const env = JSON.parse(localStorage.getItem(SAVE_KEY)!) as {
      state: Record<string, unknown>;
    };
    expect(env.state.snowDays).toBe(s.snowDays);
    delete env.state.snowDays;
    localStorage.setItem(SAVE_KEY, JSON.stringify(env));
    const loaded = loadGame(localStorage);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.snowDays).toBe(0);
  });
});
