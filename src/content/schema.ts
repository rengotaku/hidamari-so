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
/** 場所ごとに取りうる見た目（render/town.ts の描画と対応。ここに無い組は描かれない） */
export const TOWN_SLOT_LOOKS: Record<
  (typeof TOWN_SLOTS)[number],
  readonly (typeof TOWN_LOOKS)[number][]
> = {
  east: ["lot", "fence", "mansion"],
  pole: ["pole", "underground"],
};
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
/** 恋の段階: 関係なし / 片想い / 付き合っている / 同棲 / 結婚 */
export const ROMANCE_STAGES = [
  "none",
  "crush",
  "dating",
  "cohabiting",
  "married",
] as const;
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
  "rent-late", // 家賃が払えなかったとき（a=払えなかった住人）
  "book", // 他の出来事の結果（next）や人生の筋の入口から予約されたときだけ
] as const;
/** 装飾の置き場所: 壁（奥の壁）/ 窓辺 / 床 / 天井 */
export const DECOR_SLOTS = ["wall", "window", "floor", "ceiling"] as const;
/** 置き場所ごとに同時に飾れる数（描画側の置き場の数と同じ。これを超える組は描かれない） */
export const DECOR_CAPACITY: Record<(typeof DECOR_SLOTS)[number], number> = {
  wall: 5,
  window: 3,
  floor: 6,
  ceiling: 2,
};
/** 入居直後の「段ボール」。模様替えが進むにつれて数が減る（decor.json に必ず要る） */
export const MOVING_BOX_ID = "moving-box";
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
/** 漢数字で表示できる範囲（0〜99）の整数範囲。{n} の抽選に使う */
const kanjiRange = intRange.refine(
  ([lo, hi]) => lo >= 0 && hi <= 99,
  "0〜99 の範囲外（漢数字で表示できるのは 0〜99）"
);
const openRange = z
  .strictObject({ min: finite.optional(), max: finite.optional() })
  .refine(
    (r) => r.min !== undefined || r.max !== undefined,
    "min か max のどちらかが要る"
  );

/** 「day % every が on のどれかに一致する日」（every=1, on=[0] なら毎日） */
const dayRule = z
  .strictObject({
    every: posInt,
    on: z.array(z.number().int().min(0)).min(1),
  })
  .refine(
    (d) => d.on.every((x) => x < d.every),
    "on の値は every 未満（day % every は every に届かない）"
  );

const shift = z.strictObject({
  days: dayRule,
  start: hour,
  end: hour,
  label: nonEmpty,
  pay: z.union([nonNeg, z.literal("gamble")]),
});

export type DecorSlot = (typeof DECOR_SLOTS)[number];

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "色は #rrggbb");

/**
 * 装飾の部品。大写しの 2.5D の形を正として、「箱の並び」で持つ（全体図の平面はここから導く: decor25.ts）。
 * 箱は [x, y, z, 幅, 奥行き, 高さ, 色]（x は左から・y は奥の壁から手前へ・z は床から上へ。
 * 部品の枠 w × d × h からはみ出さない）。全体図では置き場所の区画に、正面の左下を合わせて描く。
 */
export const decorSchema = z
  .strictObject({
    id,
    name: nonEmpty,
    slot: z.enum(DECOR_SLOTS),
    /** 幅・奥行き・高さ（全体図のドット数と同じ単位） */
    w: posInt,
    d: posInt,
    h: posInt,
    boxes: z
      .array(
        z.tuple([
          z.number().int().min(0),
          z.number().int().min(0),
          z.number().int().min(0),
          posInt,
          posInt,
          posInt,
          color,
        ])
      )
      .min(1),
    /** この行動をしている間は描かない（弾いているギターなど） */
    hideDuringAct: z.enum(ACT_IDS).optional(),
    /** この行動をしている間は、from の色の箱を to の色にする（配信中に点くライトなど。1 部品に 1 組） */
    recolorDuringAct: z
      .strictObject({ act: z.enum(ACT_IDS), from: color, to: color })
      .optional(),
    /** 同じ部品を並べて描くときの 1 つごとのずれ（段ボール用） */
    step: z.tuple([z.number().int(), z.number().int()]).optional(),
  })
  .superRefine((p, ctx) => {
    // はみ出し検査は最初の 1 件で return するので、from の検査をその前に置く（同時の誤りも報告する）
    const from = p.recolorDuringAct?.from.toLowerCase();
    if (from !== undefined && !p.boxes.some((b) => b[6].toLowerCase() === from))
      ctx.addIssue({
        code: "custom",
        message: `recolorDuringAct.from ${p.recolorDuringAct?.from} の色の箱が無い`,
      });
    for (const [x, y, z0, w, d, h] of p.boxes)
      if (x + w > p.w || y + d > p.d || z0 + h > p.h) {
        ctx.addIssue({
          code: "custom",
          message: `箱が ${p.w}x${p.d}x${p.h} の枠を出ている`,
        });
        return;
      }
  });

/** 種類がもつ装飾のセット: 必ず置くもの + 候補から抽選するもの */
const decorSet = z
  .strictObject({
    required: z.array(id),
    pool: z.array(id),
    /** pool から何点抽選するか（[最小, 最大]） */
    pick: intRange.refine(([lo]) => lo >= 0, "負の数"),
  })
  .refine(
    (d) => new Set([...d.required, ...d.pool]).size === d.required.length + d.pool.length,
    "required と pool で id が重複している"
  )
  .refine((d) => d.pick[1] <= d.pool.length, "pick が pool より多い");

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
  /** 部屋の装飾のセット（decor.json の id）。同じ種類でも住人ごとに pool から抽選して違う部屋になる */
  decor: decorSet.default({ required: [], pool: [], pick: [0, 0] }),
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
  /** 年齢 */
  age: openRange.optional(),
  /** 気分（内部値 0〜100） */
  mood: openRange.optional(),
  /** 恋の相手が他にいない（関係が「なし」以外の相手がいない）か */
  single: z.boolean().optional(),
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
  /** 大家の所持金を増減する（マイナスになってもゲームは終わらない） */
  z.strictObject({ type: z.literal("purse"), delta: finite }),
  /** role の住人が入院などで部屋を空ける（minutes 分のあと帰ってくる） */
  z.strictObject({ type: z.literal("away"), role, minutes: intRange }),
  /** role の住人が、もう一方の部屋へ移って一緒に住む（元の部屋は空室になる） */
  z.strictObject({ type: z.literal("cohabit"), role }),
  /** a の部屋に住人が集まって宴会になる。仲の良さ・気分を全員ぶん増減する */
  z.strictObject({ type: z.literal("party"), bond: finite, mood: finite }),
  z.strictObject({ type: z.literal("changeJob"), role, archetype: id }),
  /** role の部屋に装飾を足す / 外す（decor.json の id） */
  z.strictObject({ type: z.literal("decorAdd"), role, decor: id }),
  z.strictObject({ type: z.literal("decorRemove"), role, decor: id }),
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
  "rent-late",
];

/** 取り立て屋（来訪者）の出来事の id の接頭辞。render/collector.ts が人影を出す条件に使う（content が render に依存しない向き） */
export const COLLECTOR_PREFIX = "collector-";

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
        /** ゲーム開始からの日数の範囲（設備が年月とともに増える出来事に使う） */
        days: openRange.optional(),
      })
      .default({}),
    roles: z.strictObject({ a: roleCond.optional(), b: roleCond.optional() }).default({}),
    /** 再発までの最短間隔（日） */
    cooldownDays: nonNeg.optional(),
    once: z.boolean().optional(),
    /** 本文の言い回し。{a} {b} {room} などを差し込める */
    texts: z.array(nonEmpty).min(1),
    /** {名前} に入る漢数字。[最小, 最大] から抽選する */
    numbers: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), kanjiRange).optional(),
    /** {名前} に入る言い回しの候補 */
    choices: z
      .record(z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/), z.array(nonEmpty).min(1))
      .optional(),
    /** 日誌の行の見た目（noise は騒がしい話） */
    logKind: z.enum(["move", "noise"]).optional(),
    /** 取り立て屋がもう去っている言い回しの番号（texts の添字）。collector- の出来事だけ。その間、ドアの前の人影は出ない */
    visitorGone: z.array(z.number().int().min(0)).optional(),
    effects: z.array(effect).default([]),
  })
  .superRefine((st, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message });
    const bad = undeclaredPlaceholders(st);
    if (bad.length > 0) add(`宣言のない差し込み: ${bad.map((b) => `{${b}}`).join(" ")}`);
    const texts = [...st.texts, ...Object.values(st.choices ?? {}).flat()];
    if (texts.some((t) => /[0-9０-９]/.test(t)))
      add("本文に数字を書かない（数は漢数字か numbers で）");
    if (st.visitorGone) {
      if (!st.id.startsWith(COLLECTOR_PREFIX))
        add(`visitorGone は ${COLLECTOR_PREFIX} で始まる出来事だけ`);
      if (st.visitorGone.some((i) => i >= st.texts.length))
        add("visitorGone の番号が texts の範囲外");
    }
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
      if (
        (e.type === "bond" || e.type === "romance" || e.type === "cohabit") &&
        !(st.roles.a && st.roles.b)
      )
        add(`${e.type} には roles.a と roles.b が要る`);
      if (e.type === "party" && !st.roles.a)
        add("party には roles.a（宴会を開く部屋の主）が要る");
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
    t.stages.forEach((st, i) => {
      if (!TOWN_SLOT_LOOKS[t.slot].includes(st.look))
        add(`段階 ${i} の look ${st.look} は slot ${t.slot} に置けない`);
    });
    for (let i = 1; i < t.stages.length; i++)
      if (t.stages[i]!.look === t.stages[i - 1]!.look)
        add(`段階 ${i} の look が前の段階と同じ`);
  });

export type TownChange = z.infer<typeof townChangeSchema>;

export type Archetype = z.infer<typeof archetypeSchema>;
export type ShiftDef = Archetype["shifts"][number];
export type Trait = z.infer<typeof traitSchema>;
export type Decor = z.infer<typeof decorSchema>;
export type Storylet = z.infer<typeof storyletSchema>;
export type RoleCond = z.infer<typeof roleCond>;
export type Effect = z.infer<typeof effect>;

export interface Content {
  archetypes: Record<string, Archetype>;
  traits: Record<string, Trait>;
  decor: Record<string, Decor>;
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
  const decorIds = (where: string, ids: string[]) => {
    for (const x of ids)
      if (!Object.hasOwn(c.decor, x)) errs.push(`${where}: 未知の decor ${x}`);
  };
  if (!Object.hasOwn(c.decor, MOVING_BOX_ID))
    errs.push(`decor: 段ボール ${MOVING_BOX_ID} が要る`);
  for (const a of Object.values(c.archetypes)) {
    trait(`archetype ${a.id}`, a.traits);
    const where = `archetype ${a.id}`;
    decorIds(where, [...a.decor.required, ...a.decor.pool]);
    // 最悪の抽選でも、置き場所の数に収まること（収まらないと描かれない装飾が出る）
    const slotOf = (x: string) => c.decor[x]?.slot;
    for (const slot of DECOR_SLOTS) {
      const fixed = a.decor.required.filter((x) => slotOf(x) === slot).length;
      const cand = a.decor.pool.filter((x) => slotOf(x) === slot).length;
      const worst = fixed + Math.min(cand, a.decor.pick[1]);
      if (worst > DECOR_CAPACITY[slot])
        errs.push(
          `${where}: decor の ${slot} が最大 ${worst} 点で置き場所（${DECOR_CAPACITY[slot]}）を超える`
        );
    }
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
      if (e.type === "decorAdd" || e.type === "decorRemove")
        decorIds(`storylet ${s.id}`, [e.decor]);
    }
  }
  return errs;
}
