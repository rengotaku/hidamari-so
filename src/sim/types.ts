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

export type OutPurpose = "work" | "konbini" | "sento" | "hospital";

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
  /** 部屋の装飾のセット（decor.json の id。入居のときに抽選する） */
  decorPlan: string[];
  /** decorPlan のうち、もう部屋に置いた数（入居から少しずつ増える） */
  settled: number;
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

export type LogKind = "" | "day" | "move" | "noise" | "town";

/**
 * 日誌の 1 行。組み立て済みの文字列は持たず、どの出来事が誰にいつ起きたかを構造のまま残す。
 * 本文は表示時に composeEntry(content, entry) で組み立てる。
 */
export type LogEntry =
  | { t: number; kind: "day" }
  | { t: number; kind: "town"; changeId: string; stage: number }
  | {
      t: number;
      kind: "" | "move" | "noise";
      storyletId: string;
      roles: Partial<Record<"a" | "b", RoleRef>>;
      variant: Variant;
    };

/** 出来事（storylet）の日誌の 1 行 */
export type StoryletEntry = Extract<LogEntry, { storyletId: string }>;

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

/** 町並みの変化 1 件の進み具合。stage は進む一方で戻らない（0 は最初の姿） */
export interface TownProgress {
  /** 変化が始まった時刻（ゲーム内分） */
  start: number;
  stage: number;
}

/** 部屋ごとの装飾: いま飾られている部品と、入居直後の段ボールの数 */
export interface RoomDecor {
  items: string[];
  boxes: number;
}

/** 退去のあとの部屋。大家が片付け、次の入居の日に新しい住人を連れてくる */
export interface Vacancy {
  room: number;
  /** 前の住人（日誌の本文に使う。もう住人の表にはいない） */
  former: RoleRef;
  /** 大家の片付けが終わったか（終わると窓に募集の貼り紙が出る） */
  cleared: boolean;
  /** 次の入居の日（1 日目 0:00 からの経過分） */
  moveInAt: number;
}

/**
 * 大家（画面の登場人物。プレイヤーは操作しない）。
 * idle: 姿が見えない / up: 部屋へ向かう / clearing: 部屋で片付け中 /
 * escort: 新しい住人を連れて部屋へ向かう / down: 用が済んで帰る
 */
export type LandlordPhase = "idle" | "up" | "clearing" | "escort" | "down";

export interface Landlord {
  phase: LandlordPhase;
  /** 向かっている（片付けている）部屋。idle のときは -1 */
  room: number;
  x: number;
  y: number;
  dir: 1 | -1;
  path: Point[];
  pi: number;
  /** clearing のとき、片付けが終わる時刻 */
  until: number;
  /** escort のとき、連れてきている新しい住人（部屋に着くまで住人の表には入らない） */
  escort: Resident | null;
}

/** 出ていった住人の記録。日誌の名前を押すと、この内容が見られる */
export interface Departed {
  id: number;
  sei: string;
  mei: string;
  age: number;
  job: JobId;
  traits: TraitId[];
  /** 住んでいた部屋 */
  room: number;
  /** 入居した時刻 */
  since: number;
  /** 出ていった時刻 */
  left: number;
  /** その人が最後に登場した出来事（日誌の 1 行と同じ構造） */
  last: StoryletEntry | null;
}

/** 築 50 年の買収提案。none → pending（記念日のダイアログ）→ sold（結末）/ declined（続行。二度と立たない） */
export interface Buyout {
  phase: "none" | "pending" | "declined" | "sold";
  /** ダイアログに出す住人の一言（日誌に載せたのと同じ構造）。住人がいなければ null */
  voice: StoryletEntry | null;
}

export interface GameState {
  /** 1 日目 0:00 からの経過分 */
  t: number;
  /** ゲーム開始時刻（築年数の基準） */
  t0: number;
  weather: Weather;
  /** 冬のあいだに実際に雪が降った日の数（冬でなければ 0。積雪の元） */
  snowDays: number;
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
  /** 町並みの変化の進み具合（content/town.json の id → 進み具合。始まっていないものは無い） */
  town: Record<string, TownProgress>;
  /** 部屋（0〜5）ごとの装飾 */
  decor: RoomDecor[];
  vacancies: Vacancy[];
  landlord: Landlord;
  /** 大家の所持金（内部だけ。マイナスになってもゲームは終わらない） */
  landlordMoney: number;
  /** 出ていった住人（古いものから捨てる） */
  departed: Departed[];
  buyout: Buyout;
}
