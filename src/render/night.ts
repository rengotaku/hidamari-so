import { roomRect, type NightScene } from "@/sim";
import { P } from "./palette";

/** 7 x 6 ドットのハート */
const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
const COLORS = ["#e86a8a", "#ff9bb0", "#f4527a"];

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string
): void {
  HEART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === "X") P(ctx, x + i, y + j, 1, 1, color);
  });
}

/**
 * 夜の場面: 部屋を暗くして、ハートがゆっくり浮かぶ。描くのはこれだけ（人の姿も本文も出さない）。
 * now は演出用の時計（ミリ秒）。
 */
export function drawNightScenes(
  ctx: CanvasRenderingContext2D,
  scenes: readonly NightScene[],
  now: number
): void {
  for (const sc of scenes) {
    const rr = roomRect(sc.room);
    ctx.globalAlpha = 0.88;
    P(ctx, rr.x, rr.y, rr.w, rr.h, "#090914");
    for (let k = 0; k < 3; k++) {
      const phase = ((now / 70 + k * 17) % 50) / 50;
      ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.95;
      drawHeart(
        ctx,
        rr.x + 14 + k * 20 + Math.round(Math.sin(now / 500 + k * 2) * 2),
        rr.y + 38 - phase * 32,
        COLORS[k % COLORS.length]!
      );
    }
    ctx.globalAlpha = 1;
  }
}
