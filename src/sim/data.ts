import { defaultContent } from "@/content";
import type { ActId } from "./types";

/** 画面に出る文言には算用数字を使わない（数値を見せない方針）。数は漢数字で書く。 */

export const SURNAMES = [
  "田中",
  "佐々木",
  "山口",
  "松本",
  "井上",
  "木村",
  "林",
  "斎藤",
  "清水",
  "森",
  "池田",
  "橋本",
  "石川",
  "前田",
  "藤田",
  "岡田",
  "後藤",
  "長谷川",
  "村上",
  "近藤",
  "小野",
  "坂本",
  "原田",
  "中川",
] as const;
export const GIVEN_NAMES = [
  "健太",
  "翔",
  "大輔",
  "誠",
  "修",
  "勇気",
  "優子",
  "真由美",
  "さくら",
  "陽菜",
  "亮",
  "哲也",
  "聡",
  "美咲",
  "隼人",
  "亜美",
  "蓮",
  "拓也",
  "由香",
  "直樹",
] as const;
export const OLD_GIVEN_NAMES = ["茂", "治", "勇", "清", "和子", "トメ"] as const;

export const HAIR = [
  "#2a211c",
  "#3a2a20",
  "#6b4a2b",
  "#1c1c24",
  "#8a5a2b",
  "#b58a4a",
  "#4a2f3a",
] as const;
export const SKIN = ["#f0c9a0", "#e6b88f", "#d9a57c", "#f3d2b1"] as const;
export const SHIRT = [
  "#c65b4a",
  "#4f7fb0",
  "#6f9a5a",
  "#d9c26a",
  "#8a6fb0",
  "#e0e0d8",
  "#d98a4a",
  "#4a4a55",
  "#3f8f8a",
] as const;
export const PANTS = ["#3b3f5a", "#4a3d33", "#2e2e36", "#6a6a72", "#35506a"] as const;
export const BLANKET = [
  "#c96b6b",
  "#5f86b5",
  "#7fa66a",
  "#d9a24a",
  "#9b7bb8",
  "#d88aa0",
] as const;
export const CURTAIN = [
  "#b85c4a",
  "#6c8fb0",
  "#c9b04a",
  "#7fa07a",
  "#a07ab0",
  "#8a8a8a",
] as const;

/** 職業（種類）と癖の定義は content/ の JSON にある。ここは既定コンテンツの索引 */
export const JOBS = defaultContent.archetypes;
export const TRAITS = defaultContent.traits;

export interface ActDef {
  label: string;
  pose: "lie" | "sit" | "stand";
  prop?: string;
  /** 継続時間（ゲーム内分） [min, max] */
  dur?: [number, number];
  lines?: string[];
  /** 騒音の強さ */
  noise?: number;
  /** [空腹の減り, 所持金の減り] */
  eat?: [number, number];
}

/** 部屋の中で取る行動（leave / return / out は含まない） */
export const ACTS: Record<Exclude<ActId, "leave" | "return" | "out">, ActDef> = {
  sleep: {
    label: "寝ている",
    pose: "lie",
    lines: ["Zzz…", "むにゃ…", "（いびき）", "あと五分…"],
  },
  nap: {
    label: "ゴロ寝",
    pose: "lie",
    dur: [40, 110],
    lines: ["ゴロゴロ…", "何もしたくない", "天井のシミが増えた気がする"],
  },
  phone: {
    label: "スマホ",
    pose: "sit",
    prop: "phone",
    dur: [30, 120],
    lines: ["あと五分だけ…", "この猫動画いいな", "既読つかない", "誰からも連絡ない"],
  },
  tv: {
    label: "テレビ",
    pose: "sit",
    dur: [40, 120],
    lines: ["（笑い声）", "このCM何回目だ", "リモコンどこ"],
  },
  game: {
    label: "ゲーム",
    pose: "sit",
    prop: "pad",
    dur: [60, 180],
    lines: ["あと一戦だけ", "なんで今の当たらないんだよ", "セーブし忘れた…"],
    noise: 0.5,
  },
  beer: {
    label: "晩酌",
    pose: "sit",
    prop: "can",
    dur: [30, 80],
    lines: ["プシュッ", "今日は一本だけ", "…もう一本だけ", "くぅ〜っ"],
  },
  drunk: {
    label: "酔っぱらい",
    pose: "stand",
    prop: "can",
    dur: [30, 70],
    lines: ["♪〜（音程迷子）", "俺はまだ本気出してない", "月がきれいだなあ！"],
    noise: 2,
  },
  guitar: {
    label: "ギター",
    pose: "sit",
    prop: "guitar",
    dur: [40, 120],
    lines: ["ジャーン…", "Fコードが押さえられない", "新曲できた（前の曲と同じ）"],
    noise: 1,
  },
  study: {
    label: "勉強（のつもり）",
    pose: "sit",
    dur: [40, 150],
    lines: [
      "今年こそ…",
      "ページが進まない",
      "五分休憩（一時間）",
      "机の片付けから始めよう",
    ],
  },
  draw: {
    label: "原稿",
    pose: "sit",
    dur: [60, 200],
    lines: ["この線じゃない", "締め切りって何だっけ", "主人公の顔が毎回ちがう"],
  },
  plants: {
    label: "鉢植えの世話",
    pose: "stand",
    prop: "can_water",
    dur: [20, 50],
    lines: ["今日も元気か", "お前だけだよ、話を聞いてくれるのは"],
  },
  radio: {
    label: "ラジオ",
    pose: "sit",
    dur: [40, 120],
    lines: ["（ラジオ体操第一）", "昔はな…", "（演歌）"],
  },
  workout: {
    label: "筋トレ",
    pose: "stand",
    prop: "dumbbell",
    dur: [10, 20],
    lines: ["今日から本気出す", "…三回で限界", "明日から本気出す"],
  },
  stream: {
    label: "配信",
    pose: "sit",
    dur: [60, 150],
    lines: [
      "どうもー！（視聴者ゼロ）",
      "チャンネル登録お願いします…",
      "今日の企画は…えーと",
    ],
    noise: 1,
  },
  keiba: {
    label: "競馬新聞",
    pose: "sit",
    dur: [40, 100],
    lines: ["次こそ来る", "（赤ペンで丸）", "この馬は俺を裏切らない"],
  },
  clean: {
    label: "掃除",
    pose: "stand",
    dur: [30, 60],
    lines: ["…やるか", "ゴミ袋が足りない", "なんでこんな所に靴下が"],
  },
  stare: {
    label: "ぼーっとしている",
    pose: "stand",
    dur: [10, 40],
    lines: ["…", "何しに立ったんだっけ", "天井のシミが顔に見える"],
  },
  ramen: {
    label: "カップ麺",
    pose: "sit",
    dur: [15, 25],
    lines: ["三分も待てない", "今日もカップ麺", "スープまで飲むか…"],
    eat: [60, 220],
  },
  bento: {
    label: "コンビニ弁当",
    pose: "sit",
    dur: [15, 25],
    lines: ["半額シール最高", "温めてもらえばよかった"],
    eat: [70, 520],
  },
  cook: {
    label: "自炊（失敗）",
    pose: "stand",
    dur: [25, 45],
    lines: ["焦げた…", "レシピ通りにやったのに", "換気扇どこだっけ"],
    eat: [40, 300],
  },
  nimono: {
    label: "煮物をつくる",
    pose: "stand",
    dur: [30, 50],
    lines: ["今日は筑前煮", "味が薄い…年だな"],
    eat: [70, 250],
  },
  moyashi: {
    label: "もやし炒め",
    pose: "sit",
    dur: [15, 20],
    lines: ["もやしは裏切らない", "給料日まであと…数えるのやめた"],
    eat: [40, 40],
  },
  visit: { label: "お隣へ", pose: "stand" },
  host: { label: "来客中", pose: "sit" },
  idle: { label: "ぼんやり", pose: "sit", dur: [5, 15] },
};

export const LEAVE_LINES = [
  "行ってきまーす",
  "はぁ…行くか",
  "（無言で出発）",
  "鍵かけたっけ…",
];
export const RETURN_LINES = [
  "ただいま…（誰もいない）",
  "疲れた…",
  "今日も怒られた",
  "（無言）",
  "腹へった",
];
