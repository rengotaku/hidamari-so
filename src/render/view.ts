import { SCENE_H, SCENE_W, roomRect, type GameState } from "@/sim";
import type { Ambient } from "./ambient";
import { drawCloseup } from "./closeup";
import { drawScene } from "./scene";

/**
 * 画面の見せ方の 1 コマ。全体図から部屋へ寄り（zoom）、寄った絵から大写しへ溶け（fade）、大写しになる。
 * k は 0〜1 の進み具合。
 */
export type ViewFrame =
  | { kind: "overview" }
  | { kind: "zoom"; room: number; k: number }
  | { kind: "fade"; room: number; k: number }
  | { kind: "closeup"; room: number };

/** 全体図を下絵として描いておく Canvas（寄り・フェードの間だけ使う） */
export interface Scratch {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** 下絵の全体図のうち、部屋 room へ k（0 = 全体、1 = その部屋だけ）だけ寄った範囲を画面いっぱいに */
function drawCrop(
  ctx: CanvasRenderingContext2D,
  scratch: Scratch,
  room: number,
  k: number
): void {
  const r = roomRect(room);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    scratch.canvas,
    lerp(0, r.x, k),
    lerp(0, r.y, k),
    lerp(SCENE_W, r.w, k),
    lerp(SCENE_H, r.h, k),
    0,
    0,
    SCENE_W,
    SCENE_H
  );
}

/**
 * 1 フレームを描く。時間は止めず、どの段階でも状態（住人・昼夜・夜の場面）はそのまま映す。
 * 下絵 (scratch) が作れない環境では、寄り・フェードを飛ばして全体図か大写しを直接描く。
 */
export function drawStage(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  ambient: Ambient,
  now: number,
  selectedId: number | null,
  frame: ViewFrame,
  scratch: Scratch | null
): void {
  if (frame.kind === "closeup") {
    drawCloseup(ctx, s, frame.room, now);
    return;
  }
  if (frame.kind === "overview" || !scratch) {
    if (frame.kind === "fade") drawCloseup(ctx, s, frame.room, now);
    else drawScene(ctx, s, ambient, now, selectedId);
    return;
  }
  drawScene(scratch.ctx, s, ambient, now, selectedId);
  if (frame.kind === "zoom") {
    drawCrop(ctx, scratch, frame.room, frame.k);
    return;
  }
  drawCloseup(ctx, s, frame.room, now);
  ctx.globalAlpha = 1 - frame.k;
  drawCrop(ctx, scratch, frame.room, 1);
  ctx.globalAlpha = 1;
}
