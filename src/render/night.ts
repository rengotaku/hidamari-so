import { roomRect, type NightScene } from "@/sim";
import { P } from "./palette";

/** 7 x 6 ドットのハート */
const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
const COLORS = ["#e86a8a", "#ff9bb0", "#f4527a"];

function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  unit: number
): void {
  HEART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++)
      if (row[i] === "X") P(ctx, x + i * unit, y + j * unit, unit, unit, color);
  });
}

/**
 * 暗転とハート 1 か所ぶん。全体図では部屋の矩形、大写しでは画面全体に同じ演出を描く。
 * unit はハートの 1 ドットの大きさ（全体図は 1）。矩形は部屋（74 x 48）の比率で拡大して扱う。
 */
export function drawNightRect(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  now: number,
  unit = 1
): void {
  const fx = rect.w / 74;
  const fy = rect.h / 48;
  ctx.globalAlpha = 0.88;
  P(ctx, rect.x, rect.y, rect.w, rect.h, "#090914");
  for (let k = 0; k < 3; k++) {
    const phase = ((now / 70 + k * 17) % 50) / 50;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.95;
    drawHeart(
      ctx,
      rect.x + (14 + k * 20) * fx + Math.round(Math.sin(now / 500 + k * 2) * 2 * fx),
      rect.y + (38 - phase * 32) * fy,
      COLORS[k % COLORS.length]!,
      unit
    );
  }
  ctx.globalAlpha = 1;
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
  for (const sc of scenes) drawNightRect(ctx, roomRect(sc.room), now);
}
