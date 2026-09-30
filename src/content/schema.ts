import { z } from "zod";

/**
 * content/ の JSON を検証するスキーマ。
 * 未知のフィールドはすべてエラー（strictObject）。書き間違いを CI で落とすため、実行時の警告にはしない。
 */

export const WEATHER_IDS = ["sunny", "cloudy", "rain", "snow"] as const;
/** 春 → 梅雨 → 夏 → 秋 → 冬。ゲーム内 18 日（1 年）で一巡する */
export const SEASON_IDS = ["spring", "tsuyu", "summer", "autumn", "winter"] as const;
/** 町並みの変化が起きる場所（絵を描く位置） */
export const TOWN_SLOTS = ["east", "pole"] as const;
/** 町並みの見た目の種類。新しい種類は render/town.ts に描画を足す */
export const TOWN_LOOKS = ["lot", "fence", "mansion", "pole", "underground"] as const;
export const HOBBY_IDS = [
  "phone",
  "tv",
  "game",
  "beer",
  "guitar",
  "study",
  "draw",
  "plants",
  "radio",
  "workout",
  "stream",
  "keiba",
  "nap",
  "stare",
] as const;
export const MEAL_IDS = ["ramen", "bento", "cook", "nimono", "moyashi"] as const;
export const ACT_IDS = [
  ...HOBBY_IDS,
  ...MEAL_IDS,
  "sleep",
  "drunk",
  "clean",
  "visit",
  "host",
  "idle",
  // 部屋の外にいるときの状態
  "leave",
  "return",
  "out",
] as const;
export const ROMANCE_STAGES = ["none", "crush", "dating", "married"] as const;
export const STORYLET_KINDS = [
  "daily",
  "happening",
  "relation",
  "romance",
  "arc",
] as const;
export const TRIGGERS = [
  "hour", // 1 時間ごとの抽選
  "day-start", // 日付が変わった直後
  "visit", // 住人が隣の部屋を訪ねたとき（a=訪問者, b=訪問先）
  "noise", // 物音で隣が壁を叩いたとき（a=音の主, b=隣）
  "act-end", // 行動 `act` が終わったとき（a=本人）
  "quit-gym", // 筋トレを三日で諦めたとき（a=本人）
  "late", // 寝坊して出勤したとき（a=本人）
  "gamble-win", // ギャンブルで大きく勝って帰ったとき（a=本人）
  "gamble-loss", // ギャンブルで大きく負けて帰ったとき（a=本人）
  "season-start", // 季節の最初の日（日付が変わった直後）
  "opening", // 新規ゲームの最初の 1 件
  "book", // 他の出来事の結果（next）や人生の筋の入口から予約されたときだけ
] as const;
export const EFFECT_STATS = [
  "mood",
  "money",
  "hunger",
  "sleepy",
  "comfort",
  "clutter",
] as const;

export type HobbyId = (typeof HOBBY_IDS)[number];
export type MealId = (typeof MEAL_IDS)[number];
export type ActId = (typeof ACT_IDS)[number];
export type Weather = (typeof WEATHER_IDS)[number];
export type SeasonId = (typeof SEASON_IDS)[number];
export type TownSlot = (typeof TOWN_SLOTS)[number];
export type TownLook = (typeof TOWN_LOOKS)[number];
export type RomanceStage = (typeof ROMANCE_STAGES)[number];
export type Trigger = (typeof TRIGGERS)[number];
export type Role = "a" | "b";

const finite = z.number().refine(Number.isFinite, "有限値でない");
const nonNeg = finite.refine((n) => n >= 0, "負の値");
const posInt = z.number().int().min(1);
const nonEmpty = z.string().min(1);
const id = z.string().regex(/^[a-z][a-z0-9-]*$/, "id は小文字・数字・ハイフンだけ");
const hour = finite.refine((n) => n >= 0 && n <= 24, "0〜24 の範囲外");
const hourWindow = z.tuple([hour, hour]);
const intRange = z
  .tuple([z.number().int(), z.number().int()])
  .refine(([lo, hi]) => lo <= hi, "最小が最大より大きい");
const openRange = z
  .strictObject({ min: finite.optional(), max: finite.optional() })
  .refine(
    (r) => r.min !== undefined || r.max !== undefined,
    "min か max のどちらかが要る"
  );

/** 「day % every が on のどれかに一致する日」（every=1, on=[0] なら毎日） */
const dayRule = z.strictObject({
  every: posInt,
  on: z.array(z.number().int().min(0)).min(1),
});

const shift = z.strictObject({
  days: dayRule,
  start: hour,
  end: hour,
  label: nonEmpty,
  pay: z.union([nonNeg, z.literal("gamble")]),
});

export const archetypeSchema = z.strictObject({
  id,
  label: nonEmpty,
  age: intRange,
  /** 眠る時間帯 [開始時, 終了時) */
  sleep: hourWindow,
  eat: z.enum(MEAL_IDS),
  startMoney: nonNeg,
  /** 仕送り・年金（3 日ごと） */
  allowance: nonNeg.optional(),
  tags: z.array(nonEmpty).default([]),
  shifts: z.array(shift),
  hobbies: z.partialRecord(
    z.enum(HOBBY_IDS),
    finite.refine((n) => n > 0, "重みは正の数")
  ),
  /** この種類がもつ癖の候補（trait の id） */
  traits: z.array(id).min(1),
  /** 人生の筋の入口になる storylet の id */
  arc: id.optional(),
});

export const traitSchema = z.strictObject({ id, label: nonEmpty, desc: nonEmpty });

const roleCond = z.strictObject({
  archetype: z.array(id).min(1).optional(),
  notArchetype: z.array(id).min(1).optional(),
  tag: z.array(nonEmpty).min(1).optional(),
  notTag: z.array(nonEmpty).min(1).optional(),
  /** いずれかの癖をもつ */
  trait: z.array(id).min(1).optional(),
  notTrait: z.array(id).min(1).optional(),
  floor: z.union([z.literal(1), z.literal(2)]).optional(),
  /** 自室にいるか */
  inRoom: z.boolean().optional(),
  awake: z.boolean().optional(),
  /** 外出中か */
  out: z.boolean().optional(),
  /** この 1 日以内に騒いだか */
  noisy: z.boolean().optional(),
  /** 在住日数 */
  stayDays: openRange.optional(),
  money: openRange.optional(),
  /** a との仲の良さ（0〜100、初期値 30）。b にだけ書ける */
  affinity: openRange.optional(),
  /** a との恋の段階のどれか。b にだけ書ける */
  romance: z.array(z.enum(ROMANCE_STAGES)).min(1).optional(),
});

const role = z.enum(["a", "b"]);
const chance = finite.refine((n) => n >= 0 && n <= 1, "0〜1 の範囲外");

const effect = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("adjust"),
    role,
    stat: z.enum(EFFECT_STATS),
    delta: finite,
  }),
  z.strictObject({ type: z.literal("bond"), delta: finite }),
  z.strictObject({ type: z.literal("romance"), stage: z.enum(ROMANCE_STAGES) }),
  z.strictObject({
    type: z.literal("say"),
    role,
    text: nonEmpty,
    afterMinutes: nonNeg.optional(),
  }),
  z.strictObject({
    type: z.literal("book"),
    next: z
      .array(
        z.strictObject({
          id,
          weight: finite.refine((n) => n >= 0, "重みは 0 以上").optional(),
        })
      )
      .min(1)
      .refine(
        (l) => l.reduce((sum, n) => sum + (n.weight ?? 1), 0) > 0,
        "重みの合計が 0"
      ),
    afterMinutes: intRange,
  }),
  z.strictObject({ type: z.literal("moveOut"), role }),
  z.strictObject({ type: z.literal("changeJob"), role, archetype: id }),
]);

export const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** 宣言されていない差し込み名（B2）。{a} {b} は roles に宣言がある役割だけ使える */
export function undeclaredPlaceholders(st: {
  trigger: Trigger;
  texts: string[];
  roles?: { a?: unknown; b?: unknown };
  numbers?: Record<string, unknown>;
  choices?: Record<string, unknown>;
}): string[] {
  const bad = new Set<string>();
  for (const text of st.texts)
    for (const m of text.matchAll(PLACEHOLDER)) {
      const name = m[1]!;
      if (name === "a" || name === "b") {
        if (!st.roles?.[name]) bad.add(name);
      } else if (name === "room") {
        if (!st.roles?.a) bad.add(name);
      } else if (name === "act") {
        if (st.trigger !== "noise") bad.add(name);
      } else if (name === "shift") {
        if (st.trigger !== "late") bad.add(name);
      } else if (
        !Object.hasOwn(st.numbers ?? {}, name) &&
        !Object.hasOwn(st.choices ?? {}, name)
      ) {
        bad.add(name);
      }
    }
  return [...bad];
}

const NEEDS_A: Trigger[] = [
  "act-end",
  "quit-gym",
  "late",
  "gamble-win",
  "gamble-loss",
  "visit",
  "noise",
];

export const storyletSchema = z
  .strictObject({
    id,
    kind: z.enum(STORYLET_KINDS),
    trigger: z.enum(TRIGGERS),
    /** trigger が act-end のときの行動 */
    act: z.enum(ACT_IDS).optional(),
    /** 選ばれたあと実際に起きる確率（既定 1） */
    chance: chance.default(1),
    /** 候補が複数あるときの重み（既定 1） */
    weight: finite.refine((n) => n > 0, "重みは正の数").default(1),
    when: z
      .strictObject({
        /** [開始時, 終了時) 日をまたぐ指定も可 */
        hours: hourWindow.optional(),
        weather: z.array(z.enum(WEATHER_IDS)).min(1).optional(),
        season: z.array(z.enum(SEASON_IDS)).min(1).optional(),
      })
      .default({}),
    roles: z.strictObject({ a: roleCond.optional(), b: roleCond.optional() }).default({}),
    /** 再発までの最短間隔（日） */
    cooldownDays: nonNeg.optional(),
    once: z.boolean().optional(),
    /** 本文の言い回し。{a} {b} {room} などを差し込める */
    texts: z.array(nonEmpty).min(1),
    /** {名前} に入る漢数字。[最小, 最大] から抽選する */
    numbers: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), intRange).optional(),
    /** {名前} に入る言い回しの候補 */
    choices: z
      .record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), z.array(nonEmpty).min(1))
      .optional(),
    /** 日誌の行の見た目（noise は騒がしい話） */
    logKind: z.enum(["move", "noise"]).optional(),
    effects: z.array(effect).default([]),
  })
  .superRefine((st, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message });
    const bad = undeclaredPlaceholders(st);
    if (bad.length > 0) add(`宣言のない差し込み: ${bad.map((b) => `{${b}}`).join(" ")}`);
    const texts = [...st.texts, ...Object.values(st.choices ?? {}).flat()];
    if (texts.some((t) => /[0-9０-９]/.test(t)))
      add("本文に数字を書かない（数は漢数字か numbers で）");
    if (st.trigger === "act-end" && !st.act) add("act-end には act が要る");
    if (st.trigger !== "act-end" && st.act) add("act は act-end のときだけ");
    if (NEEDS_A.includes(st.trigger) && !st.roles.a)
      add(`${st.trigger} には roles.a が要る`);
    if ((st.trigger === "visit" || st.trigger === "noise") && !st.roles.b)
      add(`${st.trigger} には roles.b が要る`);
    if (st.roles.a?.affinity || st.roles.a?.romance)
      add("affinity / romance は b にだけ書ける（a との関係なので）");
    if ((st.roles.b?.affinity || st.roles.b?.romance) && !st.roles.a)
      add("b の affinity / romance には a が要る");
    for (const e of st.effects) {
      if ("role" in e && !st.roles[e.role])
        add(`effect が未宣言の役割 ${e.role} を使っている`);
      if ((e.type === "bond" || e.type === "romance") && !(st.roles.a && st.roles.b))
        add(`${e.type} には roles.a と roles.b が要る`);
    }
  });

/**
 * 町並みの変化 1 件。stages[0] は最初の姿で、afterDays は持たない。
 * 変化が始まってから afterDays 日目に次の段階へ進む（afterDays は 0 以上で、段階ごとに必ず増える。
 * 段階を逆戻りさせたり、同じ日に 2 段階進めたりできない）。
 */
const townStage = z.strictObject({
  look: z.enum(TOWN_LOOKS),
  afterDays: nonNeg.optional(),
  /** この段階に入った日の日誌の 1 行（省略可）。数字は書かない */
  log: nonEmpty.optional(),
});

export const townChangeSchema = z
  .strictObject({
    id,
    slot: z.enum(TOWN_SLOTS),
    /** ゲーム開始から何年たったら始まりうるか（0 なら最初から） */
    startYear: z.number().int().min(0),
    /** 始まりうる日ごとの、実際に始まる確率 */
    chance,
    stages: z.array(townStage).min(2),
  })
  .superRefine((t, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message });
    if (t.stages[0]!.afterDays !== undefined || t.stages[0]!.log !== undefined)
      add("最初の段階には afterDays も log も書かない");
    let prev = -1;
    t.stages.slice(1).forEach((st, i) => {
      if (st.afterDays === undefined) add(`段階 ${i + 1} に afterDays が要る`);
      else {
        if (st.afterDays <= prev)
          add(`段階 ${i + 1} の afterDays が前の段階以下（逆転）`);
        prev = st.afterDays;
      }
      if (st.log && /[0-9０-９]/.test(st.log)) add("log に数字を書かない");
    });
    for (let i = 1; i < t.stages.length; i++)
      if (t.stages[i]!.look === t.stages[i - 1]!.look)
        add(`段階 ${i} の look が前の段階と同じ`);
  });

export type TownChange = z.infer<typeof townChangeSchema>;

export type Archetype = z.infer<typeof archetypeSchema>;
export type ShiftDef = Archetype["shifts"][number];
export type Trait = z.infer<typeof traitSchema>;
export type Storylet = z.infer<typeof storyletSchema>;
export type RoleCond = z.infer<typeof roleCond>;
export type Effect = z.infer<typeof effect>;

export interface Content {
  archetypes: Record<string, Archetype>;
  traits: Record<string, Trait>;
  storylets: Storylet[];
  /** 町並みの変化（content/town.json） */
  town: TownChange[];
}

/** id の重複と、存在しない id への参照を集める */
export function contentErrors(c: Content): string[] {
  const errs: string[] = [];
  const story = new Set(c.storylets.map((s) => s.id));
  const arch = (where: string, ids: string[] | undefined) => {
    for (const x of ids ?? [])
      if (!Object.hasOwn(c.archetypes, x)) errs.push(`${where}: 未知の archetype ${x}`);
  };
  const trait = (where: string, ids: string[] | undefined) => {
    for (const x of ids ?? [])
      if (!Object.hasOwn(c.traits, x)) errs.push(`${where}: 未知の trait ${x}`);
  };
  for (const a of Object.values(c.archetypes)) {
    trait(`archetype ${a.id}`, a.traits);
    if (a.arc && !story.has(a.arc))
      errs.push(`archetype ${a.id}: 未知の storylet ${a.arc}`);
  }
  for (const s of c.storylets) {
    for (const r of ["a", "b"] as const) {
      const cond = s.roles[r];
      if (!cond) continue;
      arch(`storylet ${s.id}`, cond.archetype);
      arch(`storylet ${s.id}`, cond.notArchetype);
      trait(`storylet ${s.id}`, cond.trait);
      trait(`storylet ${s.id}`, cond.notTrait);
    }
    for (const e of s.effects) {
      if (e.type === "book")
        for (const n of e.next)
          if (!story.has(n.id)) errs.push(`storylet ${s.id}: 未知の storylet ${n.id}`);
      if (e.type === "changeJob") arch(`storylet ${s.id}`, [e.archetype]);
    }
  }
  return errs;
}
