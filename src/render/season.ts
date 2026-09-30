import {
  dayOf,
  hourOf,
  seasonDay,
  type GameState,
  type Look,
  type Resident,
  type Season,
} from "@/sim";
import { P, mix } from "./palette";

/** 決定的な 0〜1 の疑似乱数（描画専用。状態にも乱数列にも触れない） */
const frac = (i: number): number => (Math.imul(i + 1, 2654435761) >>> 0) / 4294967296;

/** 季節と、その季節の中の進み具合 0〜1（朝が 0、最終日の夜が 1） */
export function seasonPhase(s: Pick<GameState, "t">): { season: Season; p: number } {
  const sd = seasonDay(dayOf(s.t));
  return { season: sd.season, p: (sd.index + hourOf(s.t) / 24) / sd.length };
}

const TINT: Record<Season, [string, number]> = {
  spring: ["#f3d5e0", 0.08],
  tsuyu: ["#8f98a0", 0.15],
  summer: ["#6fc0ff", 0.08],
  autumn: ["#e8a060", 0.08],
  winter: ["#c8d8ea", 0.14],
};

/** 空の色に季節の色味を少し足す（窓の外にも映る） */
export function seasonSky(sky: string, season: Season): string {
  const [c, a] = TINT[season];
  return mix(sky, c, a);
}

/** 積雪 0〜1。実際に雪が降った日数 snowDays に応じて増え、春になると消える */
export function snowCover(s: Pick<GameState, "t" | "snowDays">): number {
  const { season } = seasonPhase(s);
  if (season !== "winter" || s.snowDays <= 0) return 0;
  return Math.min(1, 0.2 + 0.3 * s.snowDays);
}

const SEASON_SHIRT: Partial<Record<Season, [string, number]>> = {
  tsuyu: ["#6f86a0", 0.25],
  summer: ["#ffffff", 0.3],
  autumn: ["#9a6a3a", 0.35],
  winter: ["#33384d", 0.65],
};

/** 衣替え: 季節に合わせて上着の色を変えた見た目を返す（元は書き換えない） */
export function seasonLook<L extends Pick<Look, "shirt">>(look: L, season: Season): L {
  const t = SEASON_SHIRT[season];
  return t ? { ...look, shirt: mix(look.shirt, t[0], t[1]) } : look;
}

const PINK = ["#f4b6c8", "#f9d3de", "#eea0b8"];
const LEAF = ["#5f9a4a", "#4f8a3f", "#6fae55"];
const DEEP = ["#3f7a3a", "#4f8a3f", "#356d34"];
const RED = ["#d9893a", "#c2502f", "#e0b040"];
const TRUNK = "#4a3528";

/** 桜の木の葉のかたまり（木の根もと (8, 88) からの相対位置） */
const CROWN: Array<[number, number, number, number]> = [
  [-6, -6, 10, 8],
  [2, -12, 12, 9],
  [10, -6, 11, 8],
  [-2, -14, 9, 7],
  [6, -2, 12, 9],
  [-8, 2, 10, 8],
  [0, 2, 10, 8],
  [12, 2, 9, 8],
  [-4, 8, 8, 6],
  [5, 8, 9, 6],
  [14, -3, 7, 6],
  [-10, -2, 6, 6],
  [3, -18, 8, 6],
  [9, -14, 8, 6],
];

function crownColor(season: Season, p: number, k: number, i: number): string | null {
  switch (season) {
    case "spring": {
      const bloom = p < 0.35 ? p / 0.35 : p < 0.7 ? 1 : 1 - ((p - 0.7) / 0.3) * 0.85;
      const leaf = p < 0.6 ? 0 : (p - 0.6) / 0.4;
      if (k < leaf * 0.9) return LEAF[i % 3]!;
      return k < bloom ? PINK[i % 3]! : null;
    }
    case "tsuyu":
      return LEAF[i % 3]!;
    case "summer":
      return DEEP[i % 3]!;
    case "autumn":
      return k < 1 - p * 0.75 ? RED[i % 3]! : null;
    default:
      return null;
  }
}

/** 建物の左の桜の木。春は咲いて散り、梅雨に葉桜、秋に色づいて落ち、冬は枝だけ */
function drawTree(
  ctx: CanvasRenderingContext2D,
  season: Season,
  p: number,
  snow: number
): void {
  P(ctx, 6, 98, 3, 76, TRUNK);
  P(ctx, 2, 94, 12, 1, TRUNK);
  P(ctx, 10, 86, 1, 9, TRUNK);
  P(ctx, 4, 88, 1, 7, TRUNK);
  P(ctx, 7, 78, 1, 10, TRUNK);
  CROWN.forEach(([dx, dy, w, h], i) => {
    const c = crownColor(season, p, frac(i * 7 + 3), i);
    if (c) P(ctx, 8 + dx, 88 + dy, w, h, c);
  });
  if (snow > 0) {
    const w = Math.round(snow * 3);
    P(ctx, 2, 93, 12, 1, "#f2f6fc");
    P(ctx, 6, 97 - w, 3, w, "#f2f6fc");
  }
}

/** 入道雲（夏の晴れ・くもり） */
function drawThunderhead(ctx: CanvasRenderingContext2D, sky: string, n: number): void {
  const c = mix("#ffffff", sky, 0.25 + n * 0.6);
  const sh = mix(c, "#8a93a6", 0.35);
  P(ctx, 222, 40, 78, 12, c);
  P(ctx, 232, 30, 58, 12, c);
  P(ctx, 246, 20, 34, 12, c);
  P(ctx, 256, 14, 16, 8, c);
  P(ctx, 222, 49, 78, 3, sh);
  P(ctx, 232, 40, 6, 2, sh);
}

/** 建物の後ろ（空の手前・建物の奥）に描く季節のもの */
export function drawSeasonBack(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sky: string,
  n: number
): void {
  const { season, p } = seasonPhase(s);
  if (season === "summer" && (s.weather === "sunny" || s.weather === "cloudy"))
    drawThunderhead(ctx, sky, n);
  drawTree(ctx, season, p, snowCover(s));
}

/** 窓の外に映る季節（花びら・落ち葉・窓枠の雪）。窓の左上 (x+7, y+9) の 18×13 の中 */
export function drawWindowSeason(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  x: number,
  y: number
): void {
  const { season, p } = seasonPhase(s);
  const dots = (colors: string[], n: number) => {
    for (let i = 0; i < n; i++)
      P(
        ctx,
        x + 7 + Math.floor(frac(i * 5 + 1) * 17),
        y + 9 + Math.floor(frac(i * 5 + 2) * 11),
        1,
        1,
        colors[i % colors.length]!
      );
  };
  if (season === "spring" && p > 0.25 && p < 0.95) dots(PINK, 5);
  else if (season === "autumn") dots(RED, 4);
  else if (season === "summer") P(ctx, x + 19, y + 10, 4, 2, "#ffffff");
  const snow = snowCover(s);
  if (snow > 0)
    P(ctx, x + 7, y + 21 - Math.round(snow * 2), 18, Math.round(snow * 2) + 1, "#f4f8ff");
}

/** 雪かきを始める朝の時間帯（時） */
const SHOVEL_FROM = 6.5;
const SHOVEL_TO = 9.5;
/** 雪かきで道をつける範囲（階段の下あたり） */
const PATH_X0 = 230;
const PATH_X1 = 312;

/** 雪かきをする人: 家にいる人（部屋番号の居場所）のうち id が最小の人。いなければ null */
export function pickShoveler(res: readonly Resident[]): Resident | null {
  return res.reduce<Resident | null>(
    (m, r) => (typeof r.at === "number" && (!m || r.id < m.id) ? r : m),
    null
  );
}

/** 雪かきの担い手の位置（雪かき中のときだけ）。描くのは scene 側 */
export function shovelerAt(s: Pick<GameState, "t" | "snowDays">): { x: number } | null {
  const h = hourOf(s.t);
  if (snowCover(s) <= 0 || h < SHOVEL_FROM || h >= SHOVEL_TO) return null;
  const q = (h - SHOVEL_FROM) / (SHOVEL_TO - SHOVEL_FROM);
  return { x: PATH_X0 + q * (PATH_X1 - PATH_X0) };
}

/** いま雪かきで屋外に出ている住人（部屋では描かない）。雪かき中でなければ null */
export function shovelingResident(s: GameState): Resident | null {
  return shovelerAt(s) ? pickShoveler(s.res) : null;
}

/** 建物の手前に描く季節のもの: 屋根と歩道の雪、雪かきの道、落ち葉・花びら、蝉、降るもの */
export function drawSeasonFront(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number,
  n: number
): void {
  const { season, p } = seasonPhase(s);
  const h = hourOf(s.t);
  const snow = snowCover(s);
  if (snow > 0) {
    const white = mix("#f4f8ff", "#9aa6c0", n * 0.5);
    const rows = Math.max(1, Math.round(snow * 5));
    for (let r = 0; r < rows; r++) P(ctx, 28 - r, 56 + r, 228 + 2 * r, 1, white);
    P(ctx, 14, 68, 256, 1, white);
    P(ctx, 22, 169, 240, 1, white);
    P(ctx, 0, 174, 320, 8, white);
    // 雪かき: 朝のうちに道がついて、そのあと一日ついたまま。両脇に雪が寄る
    const pathEnd = h >= SHOVEL_TO ? PATH_X1 : (shovelerAt(s)?.x ?? PATH_X0);
    if (pathEnd > PATH_X0) {
      P(ctx, PATH_X0, 174, pathEnd - PATH_X0, 8, "#8f8a82");
      P(ctx, PATH_X0 - 3, 172, 3, 3, white);
      P(ctx, PATH_X0 - 2, 170, 2, 2, white);
    }
  }
  if (season === "autumn" || (season === "spring" && p > 0.7)) {
    const colors = season === "autumn" ? RED : PINK;
    const count =
      season === "autumn" ? Math.round(6 + p * 26) : Math.round((p - 0.7) * 50);
    for (let i = 0; i < count; i++)
      P(
        ctx,
        Math.floor(frac(i * 3 + 9) * 318),
        175 + Math.floor(frac(i * 3 + 10) * 6),
        2,
        1,
        colors[i % 3]!
      );
  }
  if (season === "summer" && n < 0.4) {
    P(ctx, 26, 100, 2, 1, "#2b2118");
    P(ctx, 25, 99, 1, 1, "#b9c6b0");
    P(ctx, 103, 92, 2, 1, "#2b2118");
    P(ctx, 105, 91, 1, 1, "#b9c6b0");
  }
  // 降るもの: 花びら・落ち葉・雪
  const drift = (count: number, colors: string[], speed: number, sway: number) => {
    for (let k = 0; k < count; k++) {
      const x0 = frac(k * 11 + 4) * 60 - 6 + Math.sin(now / 900 + k) * sway;
      const y = ((frac(k * 13 + 5) * 170 + now * speed) % 176) + 2;
      P(ctx, x0 + (k % 2 ? 0 : 16), y, 1, 1, colors[k % colors.length]!);
    }
  };
  if (season === "spring" && p > 0.3 && p < 0.95) drift(9, PINK, 0.012, 5);
  if (season === "autumn") drift(7, RED, 0.01, 6);
  if (s.weather === "snow") {
    for (let k = 0; k < 70; k++) {
      const fx = ((k * 41 + now * 0.015 + Math.sin(now / 700 + k) * 6) % 336) - 8;
      const fy = ((k * 59 + now * 0.05) % 210) - 10;
      P(ctx, fx, fy, 1, 1, "#ffffff");
    }
  }
}
