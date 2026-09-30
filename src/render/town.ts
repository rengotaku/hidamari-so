import type { TownLook, TownSlot } from "@/content/schema";
import type { Aging } from "@/sim";
import { P, mix, shade } from "./palette";

type Looks = Record<TownSlot, TownLook>;

const EAST_X = 288;

function drawLot(ctx: CanvasRenderingContext2D): void {
  P(ctx, EAST_X - 2, 166, 34, 8, "#7d6f55");
  for (const x of [291, 298, 306, 313]) {
    P(ctx, x, 164, 1, 3, "#5f8f4a");
    P(ctx, x + 1, 165, 1, 2, "#6fa055");
  }
  // 売地の看板
  P(ctx, 301, 160, 1, 10, "#6d5646");
  P(ctx, 297, 153, 10, 7, "#e8e4d8");
  P(ctx, 298, 155, 8, 1, "#c44a3a");
}

function drawFence(ctx: CanvasRenderingContext2D): void {
  // 囲いの奥に見える鉄骨とクレーン
  for (const x of [292, 302, 312]) P(ctx, x, 128, 2, 14, "#8f9198");
  P(ctx, 290, 128, 28, 2, "#8f9198");
  P(ctx, 308, 92, 2, 36, "#d9a13a");
  P(ctx, 290, 92, 28, 2, "#d9a13a");
  P(ctx, 292, 94, 1, 10, "#555555");
  // 白い囲い
  P(ctx, EAST_X - 2, 140, 34, 34, "#e9e7df");
  for (let x = EAST_X; x < 320; x += 6) P(ctx, x, 140, 1, 34, shade("#e9e7df", -14));
  P(ctx, EAST_X - 2, 140, 34, 1, "#c9c7bf");
  for (let x = EAST_X - 2; x < 320; x += 6) P(ctx, x, 168, 3, 6, "#d9b43a");
  P(ctx, 298, 150, 10, 6, "#f0c030");
}

function drawMansion(ctx: CanvasRenderingContext2D, n: number): void {
  const body = "#d8d2c6";
  P(ctx, EAST_X, 100, 32, 74, body);
  P(ctx, EAST_X, 100, 32, 3, shade(body, -25));
  P(ctx, EAST_X, 100, 1, 74, shade(body, -18));
  for (let row = 0; row < 4; row++) {
    const y = 108 + row * 14;
    P(ctx, EAST_X, y + 10, 32, 1, shade(body, -16));
    for (let col = 0; col < 3; col++) {
      const x = EAST_X + 3 + col * 10;
      const lit = n > 0.4 && (row * 3 + col) % 3 !== 1;
      P(ctx, x, y, 6, 8, "#5a5a62");
      P(ctx, x + 1, y + 1, 4, 6, lit ? "#e9c877" : mix("#6f8aa6", "#2a3550", n * 0.6));
    }
  }
  P(ctx, EAST_X + 12, 162, 8, 12, "#4a4a52");
  P(ctx, EAST_X + 13, 163, 6, 11, "#9fc4d8");
}

/** 隣の空き地（右端）。変化の段階に応じて 空き地 → 工事の囲い → マンション */
function drawEast(ctx: CanvasRenderingContext2D, look: TownLook, n: number): void {
  if (look === "mansion") drawMansion(ctx, n);
  else if (look === "fence") drawFence(ctx);
  else drawLot(ctx);
}

/** 電柱（地中化されると消える）。電線は空の描画側が look を見て引く */
function drawPole(ctx: CanvasRenderingContext2D, look: TownLook): void {
  if (look === "pole") {
    P(ctx, 314, 20, 2, 154, "#4b4038");
    P(ctx, 309, 23, 12, 1, "#4b4038");
    P(ctx, 311, 27, 8, 1, "#4b4038");
  } else {
    // 地中化のあと、道に残るマンホール
    P(ctx, 60, 195, 7, 2, "#2e2e33");
    P(ctx, 61, 194, 5, 1, "#3a3a40");
  }
}

/** 町並み（建物の奥に描く） */
export function drawTown(ctx: CanvasRenderingContext2D, looks: Looks, n: number): void {
  drawEast(ctx, looks.east, n);
  drawPole(ctx, looks.pole);
}

/** 屋根のサビの位置（x, y, 幅, 高さ）。経年の量だけ先頭から描く */
const RUST: Array<[number, number, number, number]> = [
  [42, 59, 6, 3],
  [118, 61, 5, 2],
  [180, 58, 6, 3],
  [76, 64, 4, 3],
  [150, 66, 6, 2],
  [228, 60, 5, 3],
  [96, 58, 3, 2],
  [200, 65, 5, 2],
  [56, 67, 5, 2],
  [134, 59, 4, 2],
  [168, 63, 3, 4],
  [238, 66, 4, 2],
];

/** ツタが這う柱（外壁の縦の継ぎ目）の x */
const IVY_POSTS = [24, 102, 179, 256];

/** ひだまり荘の経年: 屋根のサビ・外壁のツタ（建物の手前に重ねる） */
export function drawAging(ctx: CanvasRenderingContext2D, aging: Aging): void {
  const rust = Math.round(aging.rust * RUST.length);
  for (let i = 0; i < rust; i++) {
    const [x, y, w, h] = RUST[i]!;
    P(ctx, x, y, w, h, i % 2 ? "#9c5a32" : "#7a4426");
    P(ctx, x + 1, y + h, 1, 2, "#7a4426");
  }
  const len = Math.round(aging.ivy * 92);
  IVY_POSTS.forEach((px, k) => {
    const top = 170 - Math.round(len * (0.75 + (0.25 * ((k * 7) % 4)) / 3));
    for (let y = 169; y > top; y -= 2) {
      const off = (y >> 1) % 3 === 0 ? 0 : 1;
      P(ctx, px + off, y, 2, 2, "#3f7a3a");
      if ((y >> 1) % 4 === 0) P(ctx, px - 1 + off * 2, y, 3, 2, "#5f9a4a");
    }
  });
}

/** 看板の板の色。かすれるほど壁の色に近づく */
export const signBoard = (aging: Aging): string =>
  mix("#dccfae", "#8a785c", aging.sign * 0.55);
