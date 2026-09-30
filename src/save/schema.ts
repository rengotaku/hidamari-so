import { z } from "zod";
import { ACTS, JOBS, TRAITS } from "@/sim";
import { ROMANCE_STAGES } from "@/content/schema";

/** 2: 日誌を構造（出来事 id・役割・言い回し）で持つ形にし、関係・予約・出来事の履歴を足した */
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
  outPurpose: z.enum(["work", "konbini", "sento"]).nullable(),
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

const logEntry = z.union([
  z.object({ t: finite, kind: z.literal("day") }),
  z.object({
    t: finite,
    kind: z.enum(["", "move", "noise"]),
    storyletId: z.string().min(1),
    roles: z.object({ a: roleRef.optional(), b: roleRef.optional() }),
    variant: z.object({
      text: nonNegInt,
      slots: z.record(z.string(), z.union([finite, z.string()])),
    }),
  }),
]);

const gameState = z
  .object({
    t: nonNeg,
    t0: nonNeg,
    weather: z.enum(["sunny", "cloudy", "rain"]),
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
  })
  // lastHour は経過時間から決まる値。食い違う保存は、1 時間ごとの処理が延々と回るので拒否する
  .refine((s) => s.lastHour === Math.floor(s.t / 60), "lastHour が t と一致しない");

/** localStorage に入れる 1 件分。schemaVersion が違えば読まずに捨てる */
export const saveEnvelope = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  /** 保存した時刻（epoch ミリ秒）。留守中の進行の基準 */
  savedAt: finite,
  /** 乱数の内部状態。続きから再開できるようにする */
  rngState: finite,
  state: gameState,
});
