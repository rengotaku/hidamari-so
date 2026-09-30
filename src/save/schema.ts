import { z } from "zod";
import { ACTS, JOBS, TRAITS } from "@/sim";
import { ROMANCE_STAGES, WEATHER_IDS } from "@/content/schema";

/**
 * 2: 日誌を構造（出来事 id・役割・言い回し）で持つ形にし、関係・予約・出来事の履歴を足した
 * 雪の積もった日数・部屋の装飾・退去後の部屋・大家・町並みの変化・速さ・大家の所持金・出ていった住人の記録・築 50 年の買収提案の状態は、版を上げずに足した（欠けていれば読み込み時に補う）
 */
export const SCHEMA_VERSION = 2;

const finite = z.number().refine(Number.isFinite, "有限値でない");
const nonNeg = finite.refine((n) => n >= 0, "負の値");
const int = z.number().int();
const nonNegInt = int.min(0);
const percent = finite.refine((n) => n >= 0 && n <= 100, "0〜100 の範囲外");
const room = int.min(0).max(5);

const keys = <T extends string>(o: Record<T, unknown>) => Object.keys(o) as [T, ...T[]];
const jobId = z.enum(keys(JOBS));
const traitId = z.enum(keys(TRAITS));
const actId = z.enum([...keys(ACTS), "leave", "return", "out"]);
const point = z.tuple([finite, finite]);

const look = z.object({
  hair: z.string(),
  skin: z.string(),
  shirt: z.string(),
  pants: z.string(),
  blanket: z.string(),
  curtain: z.string(),
  bald: z.boolean(),
  long: z.boolean(),
});

const resident = z.object({
  id: nonNegInt,
  sei: z.string().min(1),
  mei: z.string().min(1),
  age: nonNegInt,
  job: jobId,
  traits: z.array(traitId),
  look,
  money: nonNeg,
  mood: finite,
  hunger: percent,
  sleepy: percent,
  comfort: finite,
  clutter: percent,
  decorPlan: z.array(z.string()),
  settled: nonNegInt,
  room,
  at: z.union([room, z.literal("out"), z.literal("walking")]),
  visiting: z.boolean(),
  x: finite,
  y: finite,
  tx: finite,
  dir: z.union([z.literal(1), z.literal(-1)]),
  act: actId,
  lastAct: actId.nullable(),
  until: finite,
  beers: nonNegInt,
  bathed: z.boolean(),
  gym: nonNegInt,
  quitGym: z.boolean(),
  since: finite,
  path: z.array(point),
  pi: nonNegInt,
  walkMode: z.enum(["leave", "return"]).nullable(),
  outPurpose: z.enum(["work", "konbini", "sento", "hospital"]).nullable(),
  outUntil: finite,
  outDur: finite,
  hurry: z.boolean(),
  shift: z
    .object({ label: z.string(), pay: z.union([finite, z.literal("gamble")]) })
    .nullable(),
  late: z.boolean(),
  lateChecked: z.boolean(),
  noisy: finite.nullable(),
  bubble: z.object({ text: z.string(), until: finite }).nullable(),
});

const roleRef = z.object({ id: nonNegInt, sei: z.string(), room });

const storyletEntry = z.object({
  t: finite,
  kind: z.enum(["", "move", "noise"]),
  storyletId: z.string().min(1),
  roles: z.object({ a: roleRef.optional(), b: roleRef.optional() }),
  variant: z.object({
    text: nonNegInt,
    slots: z.record(z.string(), z.union([finite, z.string()])),
  }),
});

const logEntry = z.union([
  z.object({ t: finite, kind: z.literal("day") }),
  z.object({
    t: finite,
    kind: z.literal("town"),
    changeId: z.string().min(1),
    stage: nonNegInt,
  }),
  storyletEntry,
]);

const landlord = z.object({
  phase: z.enum(["idle", "up", "clearing", "escort", "down"]),
  room: int.min(-1).max(5),
  x: finite,
  y: finite,
  dir: z.union([z.literal(1), z.literal(-1)]),
  path: z.array(point),
  pi: nonNegInt,
  until: finite,
  escort: resident.nullable(),
});

const departed = z.object({
  id: nonNegInt,
  sei: z.string().min(1),
  mei: z.string().min(1),
  age: nonNegInt,
  job: jobId,
  traits: z.array(traitId),
  room,
  since: finite,
  left: finite,
  last: storyletEntry.nullable(),
});

const gameState = z
  .object({
    t: nonNeg,
    t0: nonNeg,
    weather: z.enum(WEATHER_IDS),
    // 足す前の保存（版 2）には無いので、欠けていれば 0
    snowDays: nonNegInt.default(0),
    res: z.array(resident),
    rooms: z.array(nonNegInt.max(1_000_000).nullable()).length(6),
    log: z.array(logEntry),
    nextId: nonNegInt,
    lastHour: int,
    pending: z.array(z.object({ id: nonNegInt, text: z.string(), at: finite })),
    noiseHour: int,
    bonds: z.array(
      z.object({
        a: nonNegInt,
        b: nonNegInt,
        affinity: percent,
        stage: z.enum(ROMANCE_STAGES),
      })
    ),
    booked: z.array(
      z.object({
        id: z.string().min(1),
        at: finite,
        roles: z.object({ a: nonNegInt.optional(), b: nonNegInt.optional() }),
        tries: nonNegInt,
      })
    ),
    story: z.object({
      last: z.record(z.string(), finite),
      done: z.array(z.string()),
    }),
    // 町並みの変化。足す前の保存（版 2）には無いので、欠けていれば「まだ何も変わっていない」とする
    town: z.record(z.string(), z.object({ start: finite, stage: nonNegInt })).default({}),
    decor: z.array(z.object({ items: z.array(z.string()), boxes: nonNegInt })).length(6),
    vacancies: z.array(
      z.object({ room, former: roleRef, cleared: z.boolean(), moveInAt: finite })
    ),
    landlord,
    // 大家の所持金はマイナスにもなる（お金が尽きても終わらない）。足す前の保存（版 2）には無いので欠けていれば既定値
    landlordMoney: finite.default(200000),
    departed: z.array(departed).default([]),
    buyout: z
      .object({
        phase: z.enum(["none", "pending", "declined", "sold"]),
        voice: storyletEntry.nullable(),
      })
      .default({ phase: "none", voice: null }),
  })
  // lastHour は経過時間から決まる値。食い違う保存は、1 時間ごとの処理が延々と回るので拒否する
  .refine((s) => s.lastHour === Math.floor(s.t / 60), "lastHour が t と一致しない");

/** 時間の速さ。0 = 停止 */
export const SPEEDS = [0, 1, 4, 15] as const;
export type Speed = (typeof SPEEDS)[number];
const speed = z.union([z.literal(0), z.literal(1), z.literal(4), z.literal(15)]);

/** localStorage に入れる 1 件分。schemaVersion が違えば読まずに捨てる */
export const saveEnvelope = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** 保存した時刻（epoch ミリ秒）。留守中の進行の基準 */
  savedAt: finite,
  /** 乱数の内部状態。続きから再開できるようにする */
  rngState: finite,
  /** 時間の速さ。無い保存（速さ導入前）は 1 倍で始める。版は上げない */
  speed: speed.optional(),
  state: gameState,
});
