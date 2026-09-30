import type { Point } from "./layout";
import type {
  ActId as ContentActId,
  HobbyId as ContentHobbyId,
  MealId as ContentMealId,
  RomanceStage as ContentRomanceStage,
  Weather as ContentWeather,
} from "@/content/schema";

export type Weather = ContentWeather;
/** 種類（archetype）の id。content/archetypes.json で決まる */
export type JobId = string;
/** 癖（trait）の id。content/traits.json で決まる */
export type TraitId = string;
export type HobbyId = ContentHobbyId;
export type MealId = ContentMealId;
export type ActId = ContentActId;
export type RomanceStage = ContentRomanceStage;

/** 居場所: 部屋番号（0〜5）/ 外出中 / 歩行中（階段・通り） */
export type Place = number | "out" | "walking";

export interface Look {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  blanket: string;
  curtain: string;
  bald: boolean;
  long: boolean;
}

export interface Shift {
  label: string;
  pay: number | "gamble";
}

export type OutPurpose = "work" | "konbini" | "sento";

export interface Resident {
  id: number;
  sei: string;
  mei: string;
  age: number;
  job: JobId;
  traits: TraitId[];
  look: Look;
  // 内部パラメーター（画面には出さない）
  money: number;
  mood: number;
  hunger: number;
  sleepy: number;
  comfort: number;
  clutter: number;
  // 居場所
  room: number;
  at: Place;
  visiting: boolean;
  x: number;
  y: number;
  tx: number;
  dir: 1 | -1;
  // 行動
  act: ActId;
  lastAct: ActId | null;
  until: number;
  beers: number;
  bathed: boolean;
  gym: number;
  quitGym: boolean;
  since: number;
  // 歩行・外出
  path: Point[];
  pi: number;
  walkMode: "leave" | "return" | null;
  outPurpose: OutPurpose | null;
  outUntil: number;
  outDur: number;
  hurry: boolean;
  shift: Shift | null;
  // 寝坊・音・吹き出し
  late: boolean;
  lateChecked: boolean;
  noisy: number | null;
  bubble: { text: string; until: number } | null;
}

/** 日誌に載る出来事の登場人物。出ていった後でも本文を組み立てられるよう、その時点の名前と部屋を持つ */
export interface RoleRef {
  id: number;
  sei: string;
  room: number;
}

/** 本文の言い回し: texts の何番目か + 差し込みの値（漢数字にする数・choices の何番目か・行動名など） */
export interface Variant {
  text: number;
  slots: Record<string, number | string>;
}

export type LogKind = "" | "day" | "move" | "noise";

/**
 * 日誌の 1 行。組み立て済みの文字列は持たず、どの出来事が誰にいつ起きたかを構造のまま残す。
 * 本文は表示時に composeEntry(content, entry) で組み立てる。
 */
export type LogEntry =
  | { t: number; kind: "day" }
  | {
      t: number;
      kind: "" | "move" | "noise";
      storyletId: string;
      roles: Partial<Record<"a" | "b", RoleRef>>;
      variant: Variant;
    };

export interface Pending {
  id: number;
  text: string;
  at: number;
}

/** 2 人の関係（id の小さい方を a にして 1 組 1 件） */
export interface Bond {
  a: number;
  b: number;
  /** 仲の良さ 0〜100（内部だけ。画面に出さない） */
  affinity: number;
  stage: RomanceStage;
}

/** 予約された出来事（人生の筋・出来事の続き） */
export interface Booked {
  id: string;
  at: number;
  roles: Partial<Record<"a" | "b", number>>;
  /** 条件が合わず先送りした回数 */
  tries: number;
}

/** どの出来事がいつ起きたか（再発の間隔と 1 回きりの判定に使う） */
export interface StoryLedger {
  last: Record<string, number>;
  done: string[];
}

export interface GameState {
  /** 1 日目 0:00 からの経過分 */
  t: number;
  /** ゲーム開始時刻（築年数の基準） */
  t0: number;
  weather: Weather;
  res: Resident[];
  /** 部屋 → 入居者 id（空室は null） */
  rooms: (number | null)[];
  /** 新しい順 */
  log: LogEntry[];
  nextId: number;
  lastHour: number;
  pending: Pending[];
  noiseHour: number;
  bonds: Bond[];
  booked: Booked[];
  story: StoryLedger;
}
