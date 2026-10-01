import { SCENE_W, dayOf, hourOf, type GameState } from "@/sim";
import { P } from "./palette";
import { nightness } from "./sky";

const W = SCENE_W;

/**
 * ゲーム内の日付と風景の名前から、0 以上 1 未満の値を決定的に返す（描画専用。Math.random を使わない）。
 * 文字列を FNV-1a で混ぜ、日付を足してから murmur3 の仕上げで散らす。
 */
export function dayRoll(day: number, salt: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ day, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 時刻を、その日の 0:00 からの分で返す */
const minuteOf = (s: Pick<GameState, "t">): number => hourOf(s.t) * 60;

/** 飛行機雲: 機影が空を横切るのにかかる分と、線が消えるまでの分 */
const CONTRAIL_CROSS = 20;
const CONTRAIL_FADE = 40;
/** カラスの群れが空を横切る分 */
const CROWS_CROSS = 20;
/** 流れ星 1 回の長さ（分） */
const METEOR_LEN = 2;
/** 虹が出て薄れるまでの分 */
const RAINBOW_LEN = 60;

export interface Contrail {
  dir: 1 | -1;
  y: number;
  /** 機影の x。画面を出たあとは null */
  planeX: number | null;
  /** 線の両端の x（x0 が飛び始めた側、x1 が先端） */
  x0: number;
  x1: number;
  alpha: number;
  thick: number;
}

/** 飛行機雲（晴れの日の半分。10:00〜15:00 のうち、その日で決まる時刻に始まる） */
export function contrailAt(s: GameState): Contrail | null {
  if (s.weather !== "sunny") return null;
  const day = dayOf(s.t);
  if (dayRoll(day, "contrail") >= 0.5) return null;
  // 始まりは 10:00〜13:36。機影が出てから線が消えるまでが 15:00 までに収まる
  const start = 600 + dayRoll(day, "contrail-start") * 216;
  const el = minuteOf(s) - start;
  if (el < 0 || el >= CONTRAIL_CROSS + CONTRAIL_FADE) return null;
  const dir = dayRoll(day, "contrail-dir") < 0.5 ? 1 : -1;
  // 電線（y≈22〜45）より上、太陽（昼は y≈9 以降）より上の空を通る
  const y = 4 + Math.round(dayRoll(day, "contrail-y"));
  const p = Math.min(el / CONTRAIL_CROSS, 1);
  const x0 = dir > 0 ? -10 : W + 10;
  const x1 = x0 + dir * (W + 20) * p;
  const f = Math.max(0, (el - CONTRAIL_CROSS) / CONTRAIL_FADE);
  return {
    dir,
    y,
    planeX: el < CONTRAIL_CROSS ? x1 : null,
    x0,
    x1,
    alpha: 0.95 * (1 - f),
    thick: 1 + Math.round(f * 2),
  };
}

export interface Crows {
  crows: Array<{ x: number; y: number }>;
  dir: 1 | -1;
}

/** 夕焼けのカラス（晴れ・くもりの日の 6 割。16:30〜18:00 に 5〜7 羽が空を横切る） */
export function crowsAt(s: GameState): Crows | null {
  if (s.weather !== "sunny" && s.weather !== "cloudy") return null;
  const day = dayOf(s.t);
  if (dayRoll(day, "crows") >= 0.6) return null;
  const start = 990 + dayRoll(day, "crows-start") * (90 - CROWS_CROSS);
  const el = minuteOf(s) - start;
  if (el < 0 || el >= CROWS_CROSS) return null;
  const dir = dayRoll(day, "crows-dir") < 0.5 ? 1 : -1;
  const n = 5 + Math.floor(dayRoll(day, "crows-n") * 3);
  const y0 = 30 + dayRoll(day, "crows-y") * 25;
  const p = el / CROWS_CROSS;
  const base = dir > 0 ? -60 + (W + 120) * p : W + 60 - (W + 120) * p;
  const crows = Array.from({ length: n }, (_, i) => ({
    x: base - dir * (i * 8 + (i % 2) * 5),
    y: y0 + (i % 3) * 4 + Math.sin(p * 12 + i) * 2,
  }));
  return { crows, dir };
}

export interface Meteor {
  x: number;
  y: number;
  /** 尾の長さ（ドット） */
  tail: number;
  /** 0〜1。出始めと消え際は薄い */
  alpha: number;
}

/** 流れ星（晴れの夜の半分。21:00〜翌 4:00 に 2〜3 回、1 回は 2 分ほど） */
export function meteorAt(s: GameState): Meteor | null {
  if (s.weather !== "sunny") return null;
  const h = hourOf(s.t);
  // 星が出る条件（nightness が 0.3 を超える夜空）のときだけ
  if (nightness(h) <= 0.3) return null;
  // 0:00 を過ぎたぶんは、前の日の夜として扱う
  const night = h < 4 ? dayOf(s.t) - 1 : dayOf(s.t);
  if (dayRoll(night, "meteor") >= 0.5) return null;
  const m = h < 4 ? minuteOf(s) + 1440 : minuteOf(s);
  const from = 21 * 60;
  const span = 7 * 60;
  if (m < from || m >= from + span) return null;
  const count = 2 + Math.floor(dayRoll(night, "meteor-n") * 2);
  const slot = span / count;
  const k = Math.min(count - 1, Math.floor((m - from) / slot));
  // 回ごとの枠の中で、始まりを散らす（枠の終わりまでに 1 回ぶんが収まる）
  const start =
    from + k * slot + dayRoll(night, `meteor-at${k}`) * (slot - METEOR_LEN - 1);
  const el = m - start;
  if (el < 0 || el >= METEOR_LEN) return null;
  const p = el / METEOR_LEN;
  const x0 = 70 + dayRoll(night, `meteor-x${k}`) * 180;
  const y0 = 8 + dayRoll(night, `meteor-y${k}`) * 22;
  return {
    x: x0 + p * 46,
    y: y0 + p * 22,
    tail: 10,
    alpha: Math.sin(Math.PI * p) * 0.6 + 0.4,
  };
}

export interface Rainbow {
  /** 空の明るさ 0〜1（時間帯の端では 0 から立ち上がる） */
  glow: number;
  /** 虹の濃さ 0〜1。出る前と薄れたあとは 0 */
  arc: number;
}

/** 雨上がりの虹（雨の日の 3 割。16:00〜17:30。この間は雨粒を描かない。s.weather は変えない） */
export function rainbowAt(s: GameState): Rainbow | null {
  if (s.weather !== "rain") return null;
  const m = minuteOf(s);
  if (m < 960 || m >= 1050) return null;
  const day = dayOf(s.t);
  if (dayRoll(day, "rainbow") >= 0.3) return null;
  const start = 960 + dayRoll(day, "rainbow-start") * (90 - RAINBOW_LEN);
  const el = m - start;
  const arc = el >= 0 && el < RAINBOW_LEN ? Math.sin((Math.PI * el) / RAINBOW_LEN) : 0;
  return { glow: Math.min(1, (m - 960) / 15, (1050 - m) / 15), arc };
}

const TRAIL = "#fbfcff";
const PLANE = "#eef1f8";
/** 昼の空の上で白い線・機影を読み取らせるための、ごく薄い影 */
const TRAIL_SHADE = "#5f86b0";
const PLANE_EDGE = "#34475f";
const CROW = "#15131a";
const METEOR_HEAD = "#fff6d0";
const METEOR_TAIL = "#ffe9a8";
const RAINBOW = ["#e0524a", "#e8944a", "#ecd45a", "#6fbf6a", "#5a9ad8", "#8a6ac0"];
const SKY_GLOW = "#fff3d6";

function drawContrail(ctx: CanvasRenderingContext2D, c: Contrail): void {
  const a = Math.max(0, Math.min(c.x0, c.x1));
  const b = Math.min(W, Math.max(c.x0, c.x1));
  if (b > a) {
    ctx.globalAlpha = c.alpha;
    P(ctx, a, c.y, b - a, c.thick, TRAIL);
    // 太くなるにつれて、外側をさらに薄くにじませる
    if (c.thick > 1) {
      ctx.globalAlpha = c.alpha * 0.4;
      P(ctx, a, c.y - 1, b - a, 1, TRAIL);
    }
    // 線の下に影を引いて、空の水色から白を浮かせる
    ctx.globalAlpha = c.alpha * 0.5;
    P(ctx, a, c.y + c.thick, b - a, 1, TRAIL_SHADE);
    ctx.globalAlpha = 1;
  }
  if (c.planeX !== null) {
    // 暗い縁取りの上に明るい機体を重ねる
    P(ctx, c.planeX - 3, c.y - 1, 7, 3, PLANE_EDGE);
    P(ctx, c.planeX - c.dir * 2 - 1, c.y - 2, 3, 5, PLANE_EDGE);
    P(ctx, c.planeX - 2, c.y, 5, 1, PLANE);
    P(ctx, c.planeX - c.dir, c.y - 1, 1, 3, PLANE);
    P(ctx, c.planeX - c.dir * 3, c.y - 1, 1, 1, PLANE);
  }
}

function drawCrows(ctx: CanvasRenderingContext2D, f: Crows, now: number): void {
  f.crows.forEach((c, i) => {
    const flap = Math.floor(now / 160 + i) % 2 === 0;
    const y = Math.round(c.y);
    P(ctx, c.x - 1, y, 3, 1, CROW);
    // 翼は、上げたときと下げたときで 2 コマ
    P(ctx, c.x - 3, y + (flap ? -1 : 1), 2, 1, CROW);
    P(ctx, c.x + 2, y + (flap ? -1 : 1), 2, 1, CROW);
  });
}

function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor): void {
  for (let k = m.tail; k >= 1; k--) {
    ctx.globalAlpha = m.alpha * (1 - k / (m.tail + 1)) * 0.7;
    P(ctx, m.x - k * 2, m.y - k, 1, 1, METEOR_TAIL);
  }
  ctx.globalAlpha = m.alpha;
  P(ctx, m.x, m.y, 2, 2, METEOR_HEAD);
  ctx.globalAlpha = 1;
}

/** 建物の右上にかかる大きな弧。左半分は建物の奥に隠れる */
function drawRainbow(ctx: CanvasRenderingContext2D, r: Rainbow): void {
  const cx = 215;
  const cy = 125;
  ctx.globalAlpha = r.arc * 0.55;
  RAINBOW.forEach((color, k) => {
    const rad = 108 - k * 2;
    for (let x = cx - rad; x < W; x++) {
      const dx = x + 0.5 - cx;
      const y = cy - Math.sqrt(rad * rad - dx * dx);
      P(ctx, x, y, 1, 2, color);
    }
  });
  ctx.globalAlpha = 1;
}

/** 空の風景（雲より後・電線より前に描く） */
export function drawSkySights(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  now: number
): void {
  const rainbow = rainbowAt(s);
  if (rainbow) {
    ctx.globalAlpha = 0.12 * rainbow.glow;
    P(ctx, 0, 0, W, 110, SKY_GLOW);
    ctx.globalAlpha = 1;
    if (rainbow.arc > 0) drawRainbow(ctx, rainbow);
  }
  const contrail = contrailAt(s);
  if (contrail) drawContrail(ctx, contrail);
  const crows = crowsAt(s);
  if (crows) drawCrows(ctx, crows, now);
  const meteor = meteorAt(s);
  if (meteor) drawMeteor(ctx, meteor);
}
