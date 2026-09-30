import type { Look } from "@/sim";
import { P, shade } from "./palette";

export type PersonLook = Pick<
  Look,
  "hair" | "skin" | "shirt" | "pants" | "bald" | "long"
>;
export type Pose = "sit" | "stand" | "walk";

const EYE = "#2a1f1a";
const SHOE = "#2a2522";

/** 大写しで見せる表情（空文字は全体図の素の顔） */
export type Face = "" | "sleepy" | "worried" | "drunk" | "grin";

export interface FigureOptions {
  /** 拡大率（全体図は 1、大写しは約 2.5） */
  scale?: number;
  face?: Face;
  /** 頭だけ描く（布団で寝ている人） */
  headOnly?: boolean;
}

export function drawPerson(
  ctx: CanvasRenderingContext2D,
  L: PersonLook,
  cxIn: number,
  fyIn: number,
  pose: Pose,
  frame: number,
  flip: boolean,
  prop: string | null | undefined
): void {
  drawFigure(ctx, L, cxIn, fyIn, pose, frame, flip, prop);
}

/**
 * 人物 1 人。全体図（scale 1）も大写し（scale 約 2.5・表情つき）も同じ絵から描く。
 * 座標はすべて「足元の中心 (cx, fy) からのドット」で、scale 倍して塗る。
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  L: PersonLook,
  cxIn: number,
  fyIn: number,
  pose: Pose,
  frame: number,
  flip: boolean,
  prop: string | null | undefined,
  opts: FigureOptions = {}
): void {
  const s = opts.scale ?? 1;
  const face = opts.face ?? "";
  const cx = Math.round(cxIn);
  const fy = Math.round(fyIn);
  const sit = pose === "sit";
  const top = fy - (sit ? 11 : 14) * s;
  const R = (x: number, y: number, w: number, h: number, c: string): void => {
    if (s === 1) P(ctx, cx + x, top + y, w, h, c);
    else
      P(
        ctx,
        cx + x * s,
        top + y * s,
        Math.max(1, Math.round(w * s)),
        Math.max(1, Math.round(h * s)),
        c
      );
  };
  R(-2, 1, 5, 5, L.skin);
  if (L.bald) {
    R(-3, 2, 1, 2, L.hair);
    R(3, 2, 1, 2, L.hair);
  } else {
    R(-2, 0, 5, 1, L.hair);
    R(-3, 1, 7, 1, L.hair);
    R(-3, 2, 1, L.long ? 4 : 2, L.hair);
    R(3, 2, 1, L.long ? 4 : 2, L.hair);
  }
  const ex = flip ? -1 : 0;
  if (face === "sleepy") {
    R(-1.5, 3.3, 1.5, 0.35, EYE);
    R(0.5, 3.3, 1.5, 0.35, EYE);
  } else if (face === "drunk" || face === "grin") {
    R(-1.5, 3, 1, 0.4, EYE);
    R(-1, 2.7, 0.5, 0.4, EYE);
    R(0.5, 3, 1, 0.4, EYE);
    R(1, 2.7, 0.5, 0.4, EYE);
  } else {
    R(-1 + ex, 3, 1, 1, EYE);
    R(1 + ex, 3, 1, 1, EYE);
  }
  if (face === "worried") {
    R(-1.5, 2.2, 1, 0.35, EYE);
    R(1, 2.2, 1, 0.35, EYE);
    R(-0.5, 4.8, 2, 0.35, EYE);
  }
  if (face === "grin") R(-0.5, 4.6, 2, 0.4, EYE);
  if (face === "drunk") {
    R(-2, 4, 1, 0.7, "#e88a8a");
    R(2, 4, 1, 0.7, "#e88a8a");
    R(0, 4.6, 1, 0.5, "#8a3a3a");
  }
  if (opts.headOnly) return;
  const bh = sit ? 3 : 4;
  R(-2, 6, 5, bh, L.shirt);
  R(-3, 6, 1, bh - 1, L.shirt);
  R(3, 6, 1, bh - 1, L.shirt);
  R(-3, 5 + bh, 1, 1, L.skin);
  R(3, 5 + bh, 1, 1, L.skin);
  if (sit) {
    const lx = flip ? -4 : -2;
    R(lx, 9, 7, 2, L.pants);
    R(flip ? lx - 1 : lx + 7, 10, 1, 1, SHOE);
  } else {
    const y = 10;
    if (pose === "walk" && frame) {
      R(-3, y, 2, 3, L.pants);
      R(2, y, 2, 3, L.pants);
      R(-3, y + 3, 2, 1, SHOE);
      R(2, y + 3, 2, 1, SHOE);
    } else {
      R(-2, y, 2, 3, L.pants);
      R(1, y, 2, 3, L.pants);
      R(-2, y + 3, 2, 1, SHOE);
      R(1, y + 3, 2, 1, SHOE);
    }
  }
  const hx = flip ? -4 : 3;
  const hy = 5 + bh;
  if (prop === "phone") {
    R(hx, hy - 3, 2, 3, "#1d1d22");
    R(hx, hy - 3, 2, 2, "#9fe8ff");
  } else if (prop === "can") {
    R(hx, hy - 3, 2, 3, "#d8c24a");
    R(hx, hy - 3, 2, 1, "#dddddd");
  } else if (prop === "guitar") {
    const gx = flip ? -4 : -1;
    R(gx, 7, 6, 4, "#a8642e");
    R(gx + 2, 8, 2, 2, "#3a2412");
    R(flip ? gx - 6 : gx + 6, 6, 6, 1, "#5a3a1a");
  } else if (prop === "dumbbell") {
    const yy = frame ? -2 : 5;
    R(-4, yy, 9, 1, "#8a8a8a");
    R(-5, yy - 1, 2, 3, "#444444");
    R(4, yy - 1, 2, 3, "#444444");
  } else if (prop === "can_water") {
    R(hx, hy - 2, 3, 2, "#5f8f4a");
    R(flip ? hx - 2 : hx + 3, hy - 3, 2, 1, "#5f8f4a");
  } else if (prop === "pad") {
    R(-2, hy - 1, 5, 2, "#2c2c34");
  } else if (prop === "basin") {
    R(hx - 1, hy - 1, 4, 2, "#f0cf3a");
  } else if (prop === "bag") {
    R(hx, hy, 3, 3, "#f2f2ec");
  } else if (prop === "shovel") {
    const sx = flip ? -6 : 4;
    R(sx, hy - 6, 1, 9, "#8a6a45");
    R(flip ? sx - 2 : sx, hy + 3, 3, 2, "#9aa4ad");
  }
}

export function drawLying(
  ctx: CanvasRenderingContext2D,
  L: Look,
  rx: number,
  ry: number
): void {
  P(ctx, rx + 4, ry + 32, 4, 4, L.skin);
  if (!L.bald) {
    P(ctx, rx + 3, ry + 31, 5, 1, L.hair);
    P(ctx, rx + 3, ry + 32, 1, 4, L.hair);
  }
  P(ctx, rx + 5, ry + 34, 2, 1, EYE);
  P(ctx, rx + 8, ry + 33, 19, 5, L.blanket);
  P(ctx, rx + 8, ry + 37, 19, 1, shade(L.blanket, -25));
  P(ctx, rx + 8, ry + 33, 19, 1, shade(L.blanket, 15));
}

/** 猫。dir = 1 で右、-1 で左を向く（頭が進む方向に来る） */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  xIn: number,
  yIn: number,
  frame: number,
  dir: 1 | -1 = 1
): void {
  const x = Math.round(xIn);
  const y = Math.round(yIn);
  const c = "#e39a45";
  const d = "#b86e2a";
  // 右向きの形を x を軸に左右反転して描く。[x+a, x+a+w) は [x-a-w, x-a) に写る
  const R = (a: number, yy: number, w: number, h: number, col: string) =>
    P(ctx, dir === 1 ? x + a : x - a - w, yy, w, h, col);
  R(-3, y - 3, 6, 3, c);
  R(-1, y - 3, 1, 3, d);
  R(1, y - 3, 1, 3, d);
  R(2, y - 5, 3, 3, c);
  R(2, y - 6, 1, 1, c);
  R(4, y - 6, 1, 1, c);
  R(3, y - 4, 1, 1, EYE);
  R(-4, frame ? y - 6 : y - 5, 1, 3, c);
  R(-2, y, 1, 1, d);
  R(2, y, 1, 1, d);
}
