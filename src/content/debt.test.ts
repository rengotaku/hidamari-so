import { describe, it, expect } from "vitest";
import {
  COLLECTOR_PREFIX,
  defaultContent,
  storyletSchema,
  type Storylet,
} from "@/content";
import { createRng, newGame, step, composeEntry } from "@/sim";
import type { GameState, StoryletEntry } from "@/sim";

/** 闇金・取り立て・来訪者の出来事（#25）。出来事の id は collector- か debt- で始める */
const debtStories = defaultContent.storylets.filter((s) =>
  /^(collector|debt)-/.test(s.id)
);
const storyById = new Map(defaultContent.storylets.map((s) => [s.id, s]));

/** 本文に加えて、吹き出しの台詞も「本文」として走査する */
function allTexts(s: Storylet): string[] {
  return [...s.texts, ...s.effects.flatMap((e) => (e.type === "say" ? [e.text] : []))];
}

/** 暴力表現の語の一覧（Y2）。暴言（怒鳴る・嫌味）は可なので含めない */
const VIOLENT_WORDS = [
  "殴",
  "蹴",
  "殴打",
  "暴行",
  "暴力",
  "血",
  "刃物",
  "刺す",
  "刺さ",
  "刺し",
  "ぶっ飛ば",
  "壊す",
  "壊して",
  "壊した",
  "叩き壊",
  "蹴り上げ",
  "ぶん殴",
  "ぶちのめ",
  "突き飛ばし",
  "突き飛ばす",
  "首を絞",
  "絞め",
  "ナイフ",
  "拳",
  "骨を折",
  "痛めつけ",
  "しばき",
  "ボコ",
  "割る",
  "割った",
  "割れ",
  "破る",
  "破った",
  "投げつけ",
  "引きずり",
  "さらわれ",
  "拉致",
];

/** 日誌 1 行の本文を composeEntry で組み立てる */
const textOf = (e: StoryletEntry): string => composeEntry(defaultContent, e) ?? "";

/** 闇金に借りている人が 1 人いて、他の住人もいる状態。chain を起動する予約つき */
function withYamikin(seed: number): { s: GameState; id: number } {
  const rng = createRng(seed);
  const s = newGame(rng);
  const r = s.res[0]!;
  r.job = "yamikin";
  r.money = 0;
  r.mood = 20;
  r.since = s.t - 20 * 1440;
  // debt-swell は確率で起きるので、毎日 1 回ずつ予約して（起きたら cooldown で後続は捨てられる）確実に筋を起動する
  for (let k = 0; k < 15; k++)
    s.booked.push({ id: "debt-swell", at: s.t + k * 1440, roles: { a: r.id }, tries: 0 });
  return { s, id: r.id };
}

/** 1 日ずつ進めて、起きた出来事をすべて集める（日誌は長くなると古い行を捨てるため、最後の状態だけでは足りない） */
function run(
  start: GameState,
  days: number,
  seed: number
): { end: GameState; entries: StoryletEntry[] } {
  const rng = createRng(seed);
  const entries: StoryletEntry[] = [];
  let s = start;
  for (let d = 0; d < days; d++) {
    const from = s.t;
    s = step(s, 1440, rng);
    for (const e of s.log)
      if ("storyletId" in e && e.t >= from) entries.push(e as StoryletEntry);
  }
  return { end: s, entries };
}

describe("Y1: 取り立て・借金の出来事は 15 件以上", () => {
  it("collector- / debt- の出来事が 15 件以上ある", () => {
    expect(debtStories.length).toBeGreaterThanOrEqual(15);
  });
  it("言い回しはどれも 2 つ以上ある", () => {
    for (const s of debtStories) expect(s.texts.length, s.id).toBeGreaterThanOrEqual(2);
  });
  it("取り立て屋が来る出来事（collector-）が 5 件以上ある", () => {
    expect(
      debtStories.filter((s) => s.id.startsWith("collector-")).length
    ).toBeGreaterThanOrEqual(5);
  });
});

/** 「壊された・壊した・壊し」など。取り壊し・取り壊された（建物の話）は除く */
const VIOLENT_PATTERNS = [/(?<!取り)壊[しされ]/];

describe("Y2: 暴力表現が 0 件", () => {
  it("content 全件の本文・台詞に暴力表現の語が無い", () => {
    const hits: string[] = [];
    for (const s of defaultContent.storylets)
      for (const t of allTexts(s))
        for (const w of VIOLENT_WORDS) if (t.includes(w)) hits.push(`${s.id}: ${w}`);
    for (const s of defaultContent.storylets)
      for (const t of allTexts(s))
        for (const re of VIOLENT_PATTERNS) if (re.test(t)) hits.push(`${s.id}: ${re}`);
    expect(hits).toEqual([]);
  });
});

describe("Y3: 借金の筋を最後まで進めると、連れて行かれて退去する", () => {
  it("退去の場面の本文は、車・連れ去りが画面外の結果形で書かれている", () => {
    const taken = storyById.get("debt-taken")!;
    expect(taken.effects.some((e) => e.type === "moveOut")).toBe(true);
    for (const t of taken.texts) {
      expect(t).toMatch(/車/);
      expect(t).toMatch(/乗せられて/);
      expect(t).toMatch(/(いった|行った)/);
    }
  });
  it("借金の筋（debt-swell）を起点に、実際に退去まで至る", () => {
    for (const seed of [1, 2, 3]) {
      const { s, id } = withYamikin(seed);
      const { end, entries } = run(s, 60, seed + 100);
      const entry = entries.find((e) => e.storyletId === "debt-taken");
      expect(entry, `seed ${seed}`).toBeDefined();
      expect(textOf(entry!)).toMatch(/乗せられ/);
      expect(end.res.some((r) => r.id === id)).toBe(false);
    }
  });
});

describe("Y4: 出ていった住人の記録の最後の出来事", () => {
  it("連れて行かれた出来事になっている", () => {
    for (const seed of [1, 2, 3]) {
      const { s, id } = withYamikin(seed);
      const { end } = run(s, 60, seed + 100);
      const rec = end.departed.find((d) => d.id === id);
      expect(rec, `seed ${seed}`).toBeDefined();
      expect(rec!.last?.storyletId).toBe("debt-taken");
    }
  });
});

describe("Y5: 連れて行かれたあとの後日談", () => {
  it("60 日後までに、荷物を取りに来る／戻ってくるが起きうる（シード 1〜10 の和集合で両方）", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      const { s, id } = withYamikin(seed);
      const { end, entries } = run(s, 60, seed + 100);
      // 連れて行かれたあとにだけ起きる（前には起きない）
      const takenAt = end.departed.find((d) => d.id === id)?.left;
      expect(takenAt, `seed ${seed}`).toBeDefined();
      for (const e of entries) {
        if (
          e.storyletId === "debt-after-luggage" ||
          e.storyletId === "debt-after-return"
        ) {
          expect(e.t, `seed ${seed}`).toBeGreaterThanOrEqual(takenAt!);
          seen.add(e.storyletId);
        }
      }
    }
    expect([...seen].sort()).toEqual(["debt-after-luggage", "debt-after-return"]);
  });
});

describe("Y7: 数値の変化表記が 0 件", () => {
  it("content 全件の本文・台詞に +数字 -数字 % が無い", () => {
    const hits: string[] = [];
    for (const s of defaultContent.storylets)
      for (const t of allTexts(s)) {
        if (/[+＋\-－−]\s*[0-9０-９]/.test(t) || /[%％]/.test(t))
          hits.push(`${s.id}: ${t}`);
      }
    expect(hits).toEqual([]);
  });
  it("借金の出来事の本文に円・金額の増減を書かない", () => {
    for (const s of debtStories)
      for (const t of allTexts(s)) expect(t, s.id).not.toMatch(/[0-9０-９]|円|割増/);
  });
});

describe("追加: 取り立ての筋の整合", () => {
  it("collector- の出来事は、どれも闇金に借りている人が a で、昼間（9〜19 時）に限る", () => {
    for (const s of debtStories.filter((x) => x.id.startsWith("collector-"))) {
      expect(s.roles.a?.archetype, s.id).toEqual(["yamikin"]);
      expect(s.when.hours, s.id).toBeDefined();
      const [from, to] = s.when.hours!;
      expect(from, s.id).toBeGreaterThanOrEqual(9);
      expect(to, s.id).toBeLessThanOrEqual(19);
    }
  });
  it("後日談は、連れて行かれる前に予約される（本人が出ていってからは予約できないため）", () => {
    const ask = storyById.get("debt-ask-neighbor")!;
    const ids = ask.effects.flatMap((e) =>
      e.type === "book" ? e.next.map((n) => n.id) : []
    );
    expect(ids.sort()).toEqual(["debt-after-luggage", "debt-after-return"]);
    const swell = storyById.get("debt-swell")!;
    const minAfter = Math.min(
      ...ask.effects.flatMap((e) => (e.type === "book" ? [e.afterMinutes[0]] : []))
    );
    const takenMax = Math.max(
      ...swell.effects.flatMap((e) =>
        e.type === "book" && e.next.some((n) => n.id === "debt-taken")
          ? [e.afterMinutes[1]]
          : []
      )
    );
    const askMax = Math.max(
      ...swell.effects.flatMap((e) =>
        e.type === "book" && e.next.some((n) => n.id === "debt-ask-neighbor")
          ? [e.afterMinutes[1]]
          : []
      )
    );
    // 後日談は、どの順で予約が実行されても連れて行かれたあとに起きる
    expect(askMax + minAfter).toBeGreaterThan(takenMax);
  });
});

/** 闇金に借りている人が初期住人にいて、人生の筋（yamikin-notice）だけを予約したゲーム */
function withYamikinArc(seed: number): GameState {
  const rng = createRng(seed);
  const s = newGame(rng);
  const r = s.res[0]!;
  r.job = "yamikin";
  s.booked.push({ id: "yamikin-notice", at: s.t + 2880, roles: { a: r.id }, tries: 0 });
  return s;
}

describe("追加: 片付く筋と連れて行かれる筋が両立する", () => {
  it("seed 1〜10 で 60 日進めると、yamikin-clear と debt-taken の両方が起きる。後日談は debt-taken のあとだけ", () => {
    let cleared = 0;
    let taken = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { entries } = run(withYamikinArc(seed), 60, seed);
      const ids = new Set(entries.map((e) => e.storyletId));
      if (ids.has("yamikin-clear")) cleared++;
      if (ids.has("debt-taken")) taken++;
      // 連れて行かれていないゲーム（片付いた・別の筋で出ていった）で、後日談は起きない
      if (!ids.has("debt-taken")) {
        expect(ids.has("debt-after-luggage"), `seed ${seed}`).toBe(false);
        expect(ids.has("debt-after-return"), `seed ${seed}`).toBe(false);
      }
    }
    expect(cleared).toBeGreaterThan(0);
    expect(taken).toBeGreaterThan(0);
  });
  it("yamikin-consult で片付いたゲームでは、debt-taken も後日談も起きない（片付いた直後まで）", () => {
    let checked = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { entries } = run(withYamikinArc(seed), 16, seed);
      const ids = new Set(entries.map((e) => e.storyletId));
      if (!ids.has("yamikin-clear")) continue;
      checked++;
      for (const id of [
        "debt-swell",
        "debt-taken",
        "debt-after-luggage",
        "debt-after-return",
      ])
        expect(ids.has(id), `seed ${seed} ${id}`).toBe(false);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("C8: 取り立て屋が去る言い回し（visitorGone）", () => {
  const base = {
    id: "collector-x",
    kind: "happening",
    trigger: "hour",
    roles: { a: {} },
    texts: ["{a}さんのところに来た", "{a}さんのところから去った"],
  };
  it("7. visitorGone に範囲外の番号を書くと、検証が落ちる", () => {
    expect(storyletSchema.safeParse({ ...base, visitorGone: [1] }).success).toBe(true);
    expect(storyletSchema.safeParse({ ...base, visitorGone: [2] }).success).toBe(false);
    expect(storyletSchema.safeParse({ ...base, visitorGone: [-1] }).success).toBe(false);
  });
  it("8. collector- 以外の出来事に visitorGone を書くと、検証が落ちる", () => {
    expect(
      storyletSchema.safeParse({ ...base, id: "debt-x", visitorGone: [0] }).success
    ).toBe(false);
  });
  it("9. 回帰: 去ったことを語る言い回しは、すべて visitorGone に入っている", () => {
    const GONE = /下りていった|帰っていった|立ち去|置いていった|挟まっていた/;
    for (const st of defaultContent.storylets.filter((s) =>
      s.id.startsWith(COLLECTOR_PREFIX)
    )) {
      st.texts.forEach((text, i) => {
        if (GONE.test(text)) expect(st.visitorGone ?? [], `${st.id}[${i}]`).toContain(i);
      });
    }
  });
});
