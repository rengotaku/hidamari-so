import type { Point } from "./layout";

export type Weather = "sunny" | "cloudy" | "rain";
export type JobId =
  | "konbini"
  | "band"
  | "ronin"
  | "oldman"
  | "salaryman"
  | "mangaka"
  | "pachinko"
  | "student"
  | "youtuber";
export type TraitId =
  | "nebou"
  | "sake"
  | "mikka"
  | "mie"
  | "samishi"
  | "katazuke"
  | "jisui"
  | "neko"
  | "hitorigoto"
  | "kinketsu";
export type HobbyId =
  | "phone"
  | "tv"
  | "game"
  | "beer"
  | "guitar"
  | "study"
  | "draw"
  | "plants"
  | "radio"
  | "workout"
  | "stream"
  | "keiba"
  | "nap"
  | "stare";
export type MealId = "ramen" | "bento" | "cook" | "nimono" | "moyashi";
export type ActId =
  | HobbyId
  | MealId
  | "sleep"
  | "drunk"
  | "clean"
  | "visit"
  | "host"
  | "idle"
  // 部屋の外にいるときの状態（ACTS には定義が無い）
  | "leave"
  | "return"
  | "out";

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

export type LogKind = "" | "day" | "move" | "noise";

export interface LogEntry {
  t: number;
  text: string;
  kind: LogKind;
}

export interface Pending {
  id: number;
  text: string;
  at: number;
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
}
