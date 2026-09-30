import { describe, it, expect, beforeEach } from "vitest";
import { defaultContent, parseContent, storyletSchema, type Content } from "@/content";
import {
  composeEntry,
  createRng,
  dayOf,
  hourOf,
  newGame,
  step,
  type GameState,
  type LogEntry,
  type Variant,
} from "@/sim";
import { loadGame, saveGame } from "@/save";

type StoryletEntry = Extract<LogEntry, { storyletId: string }>;

function fakeContent(over: Record<string, unknown>, id = "fake"): Content {
  const st = storyletSchema.parse({
    id,
    kind: "daily",
    trigger: "hour",
    roles: { a: {} },
    texts: ["{a}さんが何かした"],
    ...over,
  });
  return { ...defaultContent, storylets: [st] };
}

/** 1 時間刻みで days 日進め、fake の出来事が起きた時刻を全部集める */
function collect(content: Content, seed: number, days: number, id = "fake") {
  const rng = createRng(seed);
  let s: GameState = newGame(rng, content);
  const fired: StoryletEntry[] = [];
  for (let i = 0; i < days * 24; i++) {
    const before = s.t;
    s = step(s, 60, rng, { content });
    for (const e of s.log)
      if (e.kind !== "day" && e.kind !== "town" && e.storyletId === id && e.t > before)
        fired.push(e);
  }
  return { fired, state: s };
}

describe("B3: 時間帯の条件", () => {
  it("23 時〜 4 時だけの出来事は、正午〜 18 時には一度も起きない", () => {
    const content = fakeContent({ when: { hours: [23, 4] } });
    const { fired } = collect(content, 101, 30);
    const noon = fired.filter((e) => hourOf(e.t) >= 12 && hourOf(e.t) < 18);
    expect(noon).toEqual([]);
    // 窓の中では起きている（何も起きないだけの空回りではない）
    expect(fired.length).toBeGreaterThan(3);
    for (const e of fired) {
      const h = hourOf(e.t);
      expect(h >= 23 || h < 4).toBe(true);
    }
  });
});

describe("B4: 再発までの間隔", () => {
  it("間隔 5 日の出来事は、起きた日の差がすべて 5 日以上", () => {
    const content = fakeContent({ cooldownDays: 5 });
    const { fired } = collect(content, 202, 20);
    expect(fired.length).toBeGreaterThanOrEqual(3);
    const days = fired.map((e) => dayOf(e.t)).sort((x, y) => x - y);
    for (let i = 1; i < days.length; i++)
      expect(days[i]! - days[i - 1]!).toBeGreaterThanOrEqual(5);
  });
});

describe("B5: 1 回きりの出来事", () => {
  it("条件が常に真でも、30 日で起きるのは 1 回だけ", () => {
    const content = fakeContent({ once: true });
    const { fired } = collect(content, 303, 30);
    expect(fired.length).toBe(1);
  });
});

describe("B6: 日誌エントリの保存・読み込み・表示", () => {
  beforeEach(() => localStorage.clear());

  it("保存 → 読み込みで同じ本文が組み立てられ、storyletId と variant だけでも復元できる", () => {
    const rng = createRng(606);
    const s = step(newGame(rng), 4 * 1440, rng);
    const entries = s.log.filter((e): e is StoryletEntry => e.kind !== "day");
    expect(entries.length).toBeGreaterThan(5);

    saveGame(localStorage, s, rng.getState(), 1);
    const loaded = loadGame(localStorage)!;
    expect(loaded).not.toBeNull();
    const loadedEntries = loaded.state.log.filter(
      (e): e is StoryletEntry => e.kind !== "day"
    );
    expect(loadedEntries.length).toBe(entries.length);

    entries.forEach((e, i) => {
      const before = composeEntry(defaultContent, e);
      expect(before).toBeTruthy();
      expect(composeEntry(defaultContent, loadedEntries[i]!)).toBe(before);
      // 保存されたのは構造（何が・誰に・どの言い回しで）で、組み立て済みの文字列ではない
      expect(Object.keys(e).sort()).toEqual([
        "kind",
        "roles",
        "storyletId",
        "t",
        "variant",
      ]);
      // 住人の状態が無くても（出ていった後でも）復元できる
      const bare = JSON.parse(
        JSON.stringify({
          t: e.t,
          kind: e.kind,
          storyletId: e.storyletId,
          roles: e.roles,
          variant: e.variant,
        })
      ) as StoryletEntry;
      expect(composeEntry(defaultContent, bare)).toBe(before);
    });
  });
});

describe("B7: 初期住人はシードで変わる", () => {
  it("シード 1〜20 で、種類の組み合わせが 10 通り以上出る", () => {
    const combos = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const s = newGame(createRng(seed));
      expect(s.res.length).toBe(4);
      combos.add(
        s.res
          .map((r) => r.job)
          .sort()
          .join(",")
      );
    }
    expect(combos.size).toBeGreaterThanOrEqual(10);
  });
});

describe("B8: 試作の出来事の文章がコードに残っていない", () => {
  const sources = import.meta.glob<string>(
    ["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx", "!../test/**"],
    { query: "?raw", import: "default", eager: true }
  );
  const json = import.meta.glob<string>("../../content/**/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  // 試作（docs/prototype）の出来事文から抜き出した断片
  const FRAGMENTS = [
    "不在票",
    "燃えないゴミ",
    "回覧板",
    "洗濯物を干して",
    "旅行のお土産",
    "立ち話",
    "深夜のカップ麺",
    "掃除をした",
    "本気出す」宣言",
    "同時視聴者数",
    "参考書の同じページ",
    "焦げた匂い",
    "競馬新聞に赤丸",
    "新曲「",
    "醤油を借りに",
    "愚痴をこぼし",
    "お裾分け",
    "遠回しに苦情",
    "ただ乗り",
    "さんが壁ドン",
    "に寝坊",
    "パチンコで大勝ち",
    "パチンコで大負け",
    "大家になった",
    "バケツを並べ",
  ];

  it("コード（src/、テスト以外）に断片が無い", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    for (const [path, code] of Object.entries(sources))
      for (const f of FRAGMENTS) expect(code, `${path} に「${f}」`).not.toContain(f);
  });

  it("シミュレーション層のコードに「〜さん」の文が無い", () => {
    for (const [path, code] of Object.entries(sources))
      if (path.startsWith("../sim/")) expect(code, path).not.toContain("さん");
  });

  it("断片はすべて content/ の JSON に移っている", () => {
    const all = Object.values(json).join("\n");
    for (const f of FRAGMENTS) expect(all, `JSON に「${f}」が無い`).toContain(f);
  });
});

/** 追加テスト用: 複数の出来事を持つ偽コンテンツ */
function fakeContentOf(list: Record<string, unknown>[]): Content {
  const base = { kind: "daily", trigger: "hour", roles: { a: {} }, texts: ["{a}さん"] };
  return {
    ...defaultContent,
    storylets: list.map((o) => storyletSchema.parse({ ...base, ...o })),
  };
}

function runWith(content: Content, seed: number, days: number): GameState {
  const rng = createRng(seed);
  let s = newGame(rng, content);
  for (let i = 0; i < days * 24; i++) s = step(s, 60, rng, { content });
  return s;
}

const entriesOf = (s: GameState, id: string): StoryletEntry[] =>
  s.log.filter(
    (e): e is StoryletEntry =>
      e.kind !== "day" && e.kind !== "town" && e.storyletId === id
  );

describe("追加: 結果の適用", () => {
  it("book で予約した続きの出来事が、予約した日数のあとに同じ人へ起きる", () => {
    const content = fakeContentOf([
      {
        id: "first",
        once: true,
        effects: [
          { type: "book", next: [{ id: "second" }], afterMinutes: [1440, 1440] },
          { type: "adjust", role: "a", stat: "mood", delta: 10 },
        ],
      },
      { id: "second", trigger: "book", once: true },
    ]);
    const s = runWith(content, 11, 6);
    const [first] = entriesOf(s, "first");
    const [second] = entriesOf(s, "second");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second!.t - first!.t).toBeGreaterThanOrEqual(1440);
    expect(second!.roles.a!.id).toBe(first!.roles.a!.id);
  });

  it("bond と romance は a・b のペアに記録され、affinity / romance の条件で引ける", () => {
    const pair = { a: {}, b: {} };
    const content = fakeContentOf([
      {
        id: "spark",
        once: true,
        roles: pair,
        texts: ["{a}さんと{b}さん"],
        effects: [
          { type: "bond", delta: 40 },
          { type: "romance", stage: "dating" },
        ],
      },
      {
        id: "date",
        roles: { a: {}, b: { romance: ["dating"], affinity: { min: 60 } } },
        texts: ["{a}さんと{b}さん"],
      },
    ]);
    const s = runWith(content, 12, 8);
    const [spark] = entriesOf(s, "spark");
    const dates = entriesOf(s, "date");
    expect(spark).toBeDefined();
    expect(dates.length).toBeGreaterThan(0);
    // 恋の段階が dating になる前には起きない
    for (const d of dates) expect(d.t).toBeGreaterThanOrEqual(spark!.t);
    expect(s.bonds.some((k) => k.stage === "dating" && k.affinity >= 70)).toBe(true);
  });

  it("moveOut で住人が出ていき、部屋の表と住人の表が食い違わない", () => {
    const content = fakeContentOf([
      { id: "leave", once: true, effects: [{ type: "moveOut", role: "a" }] },
    ]);
    const s = runWith(content, 13, 5);
    expect(s.res.length).toBe(3);
    expect(s.rooms.filter((id) => id !== null).length).toBe(3);
    for (const r of s.res) expect(s.rooms[r.room]).toBe(r.id);
    // 出ていった後も日誌は本文を組み立てられる（名前を構造の中に持っている）
    const [e] = entriesOf(s, "leave");
    expect(composeEntry(content, e!)).toBe(`${e!.roles.a!.sei}さん`);
  });

  it("changeJob で種類が変わり、存在しない種類には変わらない", () => {
    const content = fakeContentOf([
      {
        id: "quit",
        once: true,
        effects: [{ type: "changeJob", role: "a", archetype: "youtuber" }],
      },
    ]);
    const s = runWith(content, 14, 3);
    const [e] = entriesOf(s, "quit");
    const r = s.res.find((x) => x.id === e!.roles.a!.id)!;
    expect(r.job).toBe("youtuber");
  });

  it("新規ゲームで、人生の筋をもつ種類の住人には入口が予約される", () => {
    const s = newGame(createRng(21));
    const withArc = s.res.filter((r) => defaultContent.archetypes[r.job]!.arc);
    expect(s.booked.length).toBe(withArc.length);
    for (const k of s.booked) expect(k.at).toBeGreaterThan(s.t);
  });
});

describe("追加: 本文の言い回し", () => {
  it("numbers は漢数字で、choices は候補の中から、text は複数の言い回しから選ばれる", () => {
    const content = fakeContentOf([
      {
        id: "many",
        cooldownDays: 0,
        numbers: { n: [3, 9] },
        choices: { thing: ["みかん", "りんご"] },
        texts: ["{a}さんが{n}個の{thing}を配った", "{a}さん、{thing}が{n}個"],
      },
    ]);
    const { fired } = collect(content, 15, 20, "many");
    const texts = fired.map((e) => composeEntry(content, e)!);
    expect(texts.length).toBeGreaterThan(10);
    for (const t of texts) {
      expect(t).not.toMatch(/[0-9{}]/);
      expect(t).toMatch(/[三四五六七八九]/);
      expect(t).toMatch(/みかん|りんご/);
    }
    expect(new Set(fired.map((e) => e.variant.text)).size).toBe(2);
    expect(new Set(texts).size).toBeGreaterThan(4);
  });
});

describe("追加: スキーマの拒否", () => {
  const ok = {
    id: "x",
    kind: "daily",
    trigger: "hour",
    roles: { a: {} },
    texts: ["{a}さん"],
  };
  it("正しい最小の出来事は通る", () => {
    expect(storyletSchema.safeParse(ok).success).toBe(true);
  });
  it.each([
    ["本文に算用数字", { texts: ["{a}さんが3回"] }],
    ["未宣言の役割を使う結果", { effects: [{ type: "say", role: "b", text: "やあ" }] }],
    ["act-end なのに act が無い", { trigger: "act-end" }],
    ["visit なのに b が無い", { trigger: "visit" }],
    ["a に affinity を書く", { roles: { a: { affinity: { min: 1 } } } }],
    ["範囲外の chance", { chance: 2 }],
    ["未知の種類", { kind: "weird" }],
    ["未知の結果", { effects: [{ type: "explode", role: "a" }] }],
    ["未知の条件", { roles: { a: { color: "red" } } }],
  ])("%s は拒否される", (_name, patch) => {
    expect(storyletSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
});

describe("追加: レビュー指摘の反映", () => {
  it("chance 0 の予約出来事は、予約が来ても起きない（chance 1 なら起きる）", () => {
    const mk = (chance: number) =>
      fakeContentOf([
        {
          id: "first",
          once: true,
          effects: [{ type: "book", next: [{ id: "second" }], afterMinutes: [60, 60] }],
        },
        { id: "second", trigger: "book", chance },
      ]);
    expect(entriesOf(runWith(mk(0), 31, 3), "second").length).toBe(0);
    expect(entriesOf(runWith(mk(1), 31, 3), "second").length).toBe(1);
  });

  it("book の重みは 0 以上で、合計が正でなければ拒否する", () => {
    const base = {
      id: "x",
      kind: "daily",
      trigger: "hour",
      roles: { a: {} },
      texts: ["{a}さん"],
    };
    const book = (weights: number[]) => ({
      ...base,
      effects: [
        {
          type: "book",
          afterMinutes: [1, 2],
          next: weights.map((weight) => ({ id: "y", weight })),
        },
      ],
    });
    expect(storyletSchema.safeParse(book([1, 2])).success).toBe(true);
    expect(storyletSchema.safeParse(book([-1, 2])).success).toBe(false);
    expect(storyletSchema.safeParse(book([0, 0])).success).toBe(false);
    expect(storyletSchema.safeParse(book([Number.POSITIVE_INFINITY])).success).toBe(
      false
    );
    expect(storyletSchema.safeParse(book([Number.NaN])).success).toBe(false);
  });

  it("constructor などの継承名は、種類・癖・差し込みの参照として存在しない扱いになる", () => {
    const raw = (over: object) => ({
      archetypes: Object.values(defaultContent.archetypes),
      traits: Object.values(defaultContent.traits),
      storylets: [
        {
          id: "x",
          kind: "daily",
          trigger: "hour",
          roles: { a: {} },
          texts: ["{a}さん"],
          ...over,
        },
      ],
    });
    expect(() =>
      parseContent(raw({ roles: { a: { archetype: ["constructor"] } } }))
    ).toThrow();
    expect(() =>
      parseContent(
        raw({ effects: [{ type: "changeJob", role: "a", archetype: "constructor" }] })
      )
    ).toThrow();
    expect(
      storyletSchema.safeParse({
        ...raw({}).storylets[0],
        texts: ["{a}さんの{constructor}"],
      }).success
    ).toBe(false);
  });

  it("実行時も、継承名の種類への changeJob は無視される", () => {
    const content = fakeContentOf([
      {
        id: "bad",
        once: true,
        effects: [{ type: "changeJob", role: "a", archetype: "constructor" }],
      },
    ]);
    const s = runWith(content, 32, 3);
    for (const r of s.res)
      expect(Object.hasOwn(defaultContent.archetypes, r.job)).toBe(true);
  });

  it("moveOut のあとの bond は、出ていった住人との関係を作り直さない", () => {
    const content = fakeContentOf([
      {
        id: "goodbye",
        once: true,
        roles: { a: {}, b: {} },
        texts: ["{a}さんと{b}さん"],
        effects: [
          { type: "moveOut", role: "a" },
          { type: "bond", delta: 10 },
          { type: "romance", stage: "dating" },
          { type: "adjust", role: "a", stat: "mood", delta: 5 },
        ],
      },
    ]);
    const s = runWith(content, 33, 4);
    const [e] = entriesOf(s, "goodbye");
    expect(e).toBeDefined();
    expect(s.res.some((r) => r.id === e!.roles.a!.id)).toBe(false);
    expect(s.bonds).toEqual([]);
  });

  it("variant に無い差し込みがあっても、undefined や NaN の出ない本文になる", () => {
    const content = fakeContentOf([
      {
        id: "grown",
        numbers: { n: [3, 9] },
        choices: { thing: ["みかん", "りんご"] },
        texts: ["{a}さんが{n}個の{thing}を配った"],
      },
    ]);
    const st = content.storylets[0]!;
    const base = {
      t: 1,
      kind: "" as const,
      storyletId: st.id,
      roles: { a: { id: 1, sei: "田中", room: 0 } },
    };
    const variants: Variant[] = [
      { text: 0, slots: {} },
      { text: 99, slots: { n: "x", thing: 99 } },
      { text: 0, slots: { n: Number.NaN, thing: -1 } },
    ];
    for (const variant of variants) {
      const text = composeEntry(content, { ...base, variant })!;
      expect(text).toBe("田中さんが三個のみかんを配った");
    }
  });
});
