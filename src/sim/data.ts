import type { ActId, HobbyId, JobId, MealId, TraitId } from "./types";

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

export const TRAITS: Record<TraitId, { label: string; desc: string }> = {
  nebou: { label: "寝坊常習", desc: "目覚ましを止めた記憶がない" },
  sake: { label: "酒好き", desc: "「今日は一本だけ」が口癖。守られたことはない" },
  mikka: { label: "三日坊主", desc: "部屋のダンベルはもうすぐ物干しになる" },
  mie: { label: "見栄っ張り", desc: "金欠でも半額じゃない弁当を買う" },
  samishi: { label: "寂しがり", desc: "用もないのに隣の部屋をノックする" },
  katazuke: { label: "片付けられない", desc: "万年床のまわりに地層ができている" },
  jisui: { label: "自炊に挑戦中", desc: "換気扇のスイッチの場所をまだ知らない" },
  neko: { label: "猫好き", desc: "野良猫に勝手に名前をつけている" },
  hitorigoto: { label: "独り言が多い", desc: "壁が薄いので全部聞こえている" },
  kinketsu: { label: "金欠", desc: "財布の中身より、ポイントカードの枚数が多い" },
};

export interface ShiftDef {
  /** その日（1 日目 = 1）に勤務があるか */
  d: (day: number) => boolean;
  s: number;
  e: number;
  label: string;
  pay: number | "gamble";
}

export interface JobDef {
  label: string;
  age: [number, number];
  /** 眠る時間帯 [開始時, 終了時) */
  sleep: [number, number];
  eat: MealId;
  start: number;
  allowance?: number;
  old?: boolean;
  shifts: ShiftDef[];
  hobbies: Partial<Record<HobbyId, number>>;
}

export const JOBS: Record<JobId, JobDef> = {
  konbini: {
    label: "コンビニ夜勤",
    age: [24, 38],
    sleep: [8.5, 15.5],
    eat: "bento",
    start: 30000,
    shifts: [{ d: () => true, s: 22, e: 6, label: "コンビニ夜勤", pay: 11000 }],
    hobbies: { phone: 3, tv: 2, game: 2, beer: 2, stare: 1 },
  },
  band: {
    label: "売れないバンドマン",
    age: [26, 36],
    sleep: [3, 11.5],
    eat: "ramen",
    start: 9000,
    allowance: 8000,
    shifts: [
      { d: (d) => d % 3 === 1, s: 18, e: 23.5, label: "ライブ（客は七人）", pay: 3000 },
      { d: (d) => d % 3 === 0, s: 9, e: 17, label: "引越しバイト", pay: 12000 },
    ],
    hobbies: { guitar: 5, beer: 3, phone: 2, nap: 1 },
  },
  ronin: {
    label: "三浪中の浪人生",
    age: [21, 22],
    sleep: [2, 10.5],
    eat: "ramen",
    start: 20000,
    allowance: 45000,
    shifts: [{ d: (d) => d % 4 === 1, s: 13, e: 17, label: "予備校（たまに）", pay: 0 }],
    hobbies: { study: 4, phone: 4, game: 2, nap: 2, stare: 1 },
  },
  oldman: {
    label: "年金暮らし（元国鉄の車掌）",
    age: [71, 82],
    sleep: [21, 5],
    eat: "nimono",
    start: 90000,
    allowance: 62000,
    old: true,
    shifts: [{ d: () => true, s: 5.5, e: 7, label: "朝の散歩", pay: 0 }],
    hobbies: { plants: 3, radio: 3, tv: 3, stare: 1 },
  },
  salaryman: {
    label: "中小企業の営業",
    age: [34, 52],
    sleep: [0.5, 6.5],
    eat: "bento",
    start: 60000,
    shifts: [
      {
        d: (d) => d % 7 !== 6 && d % 7 !== 0,
        s: 7.5,
        e: 22.5,
        label: "会社",
        pay: 15000,
      },
    ],
    hobbies: { beer: 4, tv: 3, phone: 2, nap: 2 },
  },
  mangaka: {
    label: "漫画家志望（持ち込み十七回）",
    age: [25, 34],
    sleep: [5, 13],
    eat: "ramen",
    start: 12000,
    allowance: 15000,
    shifts: [{ d: (d) => d % 3 === 2, s: 10, e: 18, label: "倉庫バイト", pay: 9000 }],
    hobbies: { draw: 6, phone: 2, stare: 2, nap: 1 },
  },
  pachinko: {
    label: "自称・投資家（パチンコ）",
    age: [38, 58],
    sleep: [1.5, 9.5],
    eat: "bento",
    start: 60000,
    shifts: [{ d: (d) => d % 2 === 0, s: 10, e: 21, label: "パチンコ", pay: "gamble" }],
    hobbies: { keiba: 4, beer: 3, tv: 2, phone: 1 },
  },
  student: {
    label: "大学八年生",
    age: [26, 27],
    sleep: [4, 12.5],
    eat: "ramen",
    start: 15000,
    allowance: 40000,
    shifts: [
      { d: (d) => d % 2 === 1, s: 13, e: 16, label: "講義（たぶん）", pay: 0 },
      { d: (d) => d % 3 === 0, s: 18, e: 23, label: "居酒屋バイト", pay: 8000 },
    ],
    hobbies: { phone: 4, game: 4, beer: 2, nap: 3, guitar: 1 },
  },
  youtuber: {
    label: "動画配信者（登録者はほぼ身内）",
    age: [23, 31],
    sleep: [4.5, 12],
    eat: "ramen",
    start: 150000,
    shifts: [{ d: (d) => d % 5 === 3, s: 14, e: 22, label: "倉庫バイト", pay: 9000 }],
    hobbies: { stream: 5, phone: 3, stare: 1 },
  },
};

export const JOB_TRAITS: Record<JobId, TraitId[]> = {
  konbini: ["katazuke"],
  band: ["nebou", "sake"],
  ronin: ["samishi", "hitorigoto"],
  oldman: ["neko", "hitorigoto"],
  salaryman: ["sake", "mie"],
  mangaka: ["nebou", "jisui"],
  pachinko: ["kinketsu", "mie"],
  student: ["katazuke", "nebou"],
  youtuber: ["hitorigoto", "jisui"],
};

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

export interface VisitDef {
  a: string;
  b: string;
  when?: (borrowerNoisyRecently: boolean) => boolean;
  /** 訪問者 a・訪問先 b の名字から日誌の文を作る（money 移動などの副作用は behavior 側） */
  text: (a: string, b: string) => string;
  kind: "plain" | "vent" | "loan" | "gift" | "complaint";
}

export const VISITS: VisitDef[] = [
  {
    a: "醤油、貸してもらえます？",
    b: "またですか",
    kind: "plain",
    text: (a, b) => `${a}さんが${b}さんに醤油を借りに行った（今月三回目）`,
  },
  {
    a: "聞いてくださいよ…",
    b: "（この話三回目だ）",
    kind: "vent",
    text: (a, b) => `${a}さんが${b}さんに愚痴をこぼしに行った`,
  },
  {
    a: "小銭だけ…来週返すんで",
    b: "先月の小銭は？",
    kind: "loan",
    text: (a, b) => `${a}さんが${b}さんに小銭を借りに行った`,
  },
  {
    a: "実家から大量に届いて…",
    b: "助かる〜",
    kind: "gift",
    text: (a, b) => `${a}さんが${b}さんにお裾分けを持っていった`,
  },
  {
    a: "昨日の夜、ちょっと音が…",
    b: "え、何のことです？",
    kind: "complaint",
    when: (noisy) => noisy,
    text: (a, b) => `${a}さんが${b}さんに遠回しに苦情を言いに行った。伝わっていない`,
  },
  {
    a: "Wi-Fiのパスワード、教えてもらえたり…",
    b: "…いいですけど",
    kind: "plain",
    text: (a, b) => `${a}さんが${b}さんのWi-Fiにただ乗りを始めた`,
  },
];

export const GIFTS = ["じゃがいも", "みかん", "謎の漬物"] as const;
