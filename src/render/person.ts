import type { Look } from "@/sim";
import { P, shade } from "./palette";

export type PersonLook = Pick<
  Look,
  "hair" | "skin" | "shirt" | "pants" | "bald" | "long"
>;
export type Pose = "sit" | "stand" | "walk";

const EYE = "#2a1f1a";
const SHOE = "#2a2522";

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
  const cx = Math.round(cxIn);
  const fy = Math.round(fyIn);
  const sit = pose === "sit";
  const top = fy - (sit ? 11 : 14);
  P(ctx, cx - 2, top + 1, 5, 5, L.skin);
  if (L.bald) {
    P(ctx, cx - 3, top + 2, 1, 2, L.hair);
    P(ctx, cx + 3, top + 2, 1, 2, L.hair);
  } else {
    P(ctx, cx - 2, top, 5, 1, L.hair);
    P(ctx, cx - 3, top + 1, 7, 1, L.hair);
    P(ctx, cx - 3, top + 2, 1, L.long ? 4 : 2, L.hair);
    P(ctx, cx + 3, top + 2, 1, L.long ? 4 : 2, L.hair);
  }
  const ex = flip ? -1 : 0;
  P(ctx, cx - 1 + ex, top + 3, 1, 1, EYE);
  P(ctx, cx + 1 + ex, top + 3, 1, 1, EYE);
  const bh = sit ? 3 : 4;
  P(ctx, cx - 2, top + 6, 5, bh, L.shirt);
  P(ctx, cx - 3, top + 6, 1, bh - 1, L.shirt);
  P(ctx, cx + 3, top + 6, 1, bh - 1, L.shirt);
  P(ctx, cx - 3, top + 5 + bh, 1, 1, L.skin);
  P(ctx, cx + 3, top + 5 + bh, 1, 1, L.skin);
  if (sit) {
    const lx = flip ? cx - 4 : cx - 2;
    P(ctx, lx, top + 9, 7, 2, L.pants);
    P(ctx, flip ? lx - 1 : lx + 7, top + 10, 1, 1, SHOE);
  } else {
    const y = top + 10;
    if (pose === "walk" && frame) {
      P(ctx, cx - 3, y, 2, 3, L.pants);
      P(ctx, cx + 2, y, 2, 3, L.pants);
      P(ctx, cx - 3, y + 3, 2, 1, SHOE);
      P(ctx, cx + 2, y + 3, 2, 1, SHOE);
    } else {
      P(ctx, cx - 2, y, 2, 3, L.pants);
      P(ctx, cx + 1, y, 2, 3, L.pants);
      P(ctx, cx - 2, y + 3, 2, 1, SHOE);
      P(ctx, cx + 1, y + 3, 2, 1, SHOE);
    }
  }
  const hx = flip ? cx - 4 : cx + 3;
  const hy = top + 5 + bh;
  if (prop === "phone") {
    P(ctx, hx, hy - 3, 2, 3, "#1d1d22");
    P(ctx, hx, hy - 3, 2, 2, "#9fe8ff");
  } else if (prop === "can") {
    P(ctx, hx, hy - 3, 2, 3, "#d8c24a");
    P(ctx, hx, hy - 3, 2, 1, "#dddddd");
  } else if (prop === "guitar") {
    const gx = flip ? cx - 4 : cx - 1;
    P(ctx, gx, top + 7, 6, 4, "#a8642e");
    P(ctx, gx + 2, top + 8, 2, 2, "#3a2412");
    P(ctx, flip ? gx - 6 : gx + 6, top + 6, 6, 1, "#5a3a1a");
  } else if (prop === "dumbbell") {
    const yy = frame ? top - 2 : top + 5;
    P(ctx, cx - 4, yy, 9, 1, "#8a8a8a");
    P(ctx, cx - 5, yy - 1, 2, 3, "#444444");
    P(ctx, cx + 4, yy - 1, 2, 3, "#444444");
  } else if (prop === "can_water") {
    P(ctx, hx, hy - 2, 3, 2, "#5f8f4a");
    P(ctx, flip ? hx - 2 : hx + 3, hy - 3, 2, 1, "#5f8f4a");
  } else if (prop === "pad") {
    P(ctx, cx - 2, hy - 1, 5, 2, "#2c2c34");
  } else if (prop === "basin") {
    P(ctx, hx - 1, hy - 1, 4, 2, "#f0cf3a");
  } else if (prop === "bag") {
    P(ctx, hx, hy, 3, 3, "#f2f2ec");
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

export function drawCat(
  ctx: CanvasRenderingContext2D,
  xIn: number,
  yIn: number,
  frame: number
): void {
  const x = Math.round(xIn);
  const y = Math.round(yIn);
  const c = "#e39a45";
  const d = "#b86e2a";
  P(ctx, x - 3, y - 3, 6, 3, c);
  P(ctx, x - 1, y - 3, 1, 3, d);
  P(ctx, x + 1, y - 3, 1, 3, d);
  P(ctx, x + 2, y - 5, 3, 3, c);
  P(ctx, x + 2, y - 6, 1, 1, c);
  P(ctx, x + 4, y - 6, 1, 1, c);
  P(ctx, x + 3, y - 4, 1, 1, EYE);
  P(ctx, x - 4, frame ? y - 6 : y - 5, 1, 3, c);
  P(ctx, x - 2, y, 1, 1, d);
  P(ctx, x + 2, y, 1, 1, d);
}
