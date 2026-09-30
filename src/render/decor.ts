import {
  defaultContent,
  flatRects,
  MOVING_BOX_ID,
  type Decor,
  type DecorSlot,
} from "@/content";
import type { GameState } from "@/sim";
import { P } from "./palette";

/**
 * 全体図の装飾の描画。何を飾るかは content/decor.json（2.5D の箱の並び）が決め、
 * ここは箱を平面に落とした矩形（flatRects）を「置き場所の区画に順に並べる」だけを担う。
 * 部品ごとの描き分けはコードに置かない。大写しの描画は closeup.ts（同じ定義から箱を立てる）。
 * 区画は [左端 x, 底の y]（部屋の左上が原点）。底の y に部品の左下を合わせる。
 * 区画の数は content の DECOR_CAPACITY と同じ（超えた部品は描かない）。
 */
export const CELLS: Record<DecorSlot, Array<[number, number]>> = {
  wall: [
    [29, 22],
    [35, 24],
    [41, 21],
    [47, 23],
    [53, 22],
  ],
  window: [
    [7, 22],
    [13, 22],
    [19, 22],
  ],
  floor: [
    [30, 46],
    [36, 46],
    [42, 46],
    [48, 46],
    [54, 46],
    [60, 46],
  ],
  ceiling: [
    [8, 9],
    [44, 9],
  ],
};

/** 段ボールを並べ始める位置（左端 x, 底の y） */
export const BOX_BASE: [number, number] = [50, 46];

function drawPart(
  ctx: CanvasRenderingContext2D,
  def: Decor,
  left: number,
  base: number,
  index = 0
): void {
  const ox = left + (def.step?.[0] ?? 0) * index;
  const oy = base - def.h + (def.step?.[1] ?? 0) * index;
  for (const [x, y, w, h, c] of flatRects(def)) P(ctx, ox + x, oy + y, w, h, c);
}

/** 置き場所ごとに、飾られている順で区画を割り当てる */
export function placed(
  s: GameState,
  room: number,
  slots: readonly DecorSlot[],
  acts: ReadonlySet<string>
): Array<{ def: Decor; cell: [number, number] }> {
  const used: Partial<Record<DecorSlot, number>> = {};
  const out: Array<{ def: Decor; cell: [number, number] }> = [];
  for (const id of s.decor[room]?.items ?? []) {
    const def = Object.hasOwn(defaultContent.decor, id)
      ? defaultContent.decor[id]
      : undefined;
    if (!def) continue;
    const k = used[def.slot] ?? 0;
    const cell = CELLS[def.slot][k];
    if (!cell) continue;
    used[def.slot] = k + 1;
    if (slots.includes(def.slot) && !(def.hideDuringAct && acts.has(def.hideDuringAct)))
      out.push({ def, cell });
  }
  return out;
}

/** 壁・窓辺・天井の装飾（家具より奥） */
export function drawBackDecor(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  x: number,
  y: number,
  acts: ReadonlySet<string>
): void {
  for (const { def, cell } of placed(s, room, ["wall", "window", "ceiling"], acts))
    drawPart(ctx, def, x + cell[0], y + cell[1], 0);
}

/** 窓辺の装飾だけを描き直す（夜に明かりのついた部屋は、窓を塗り直すので） */
export function drawWindowDecor(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  x: number,
  y: number
): void {
  for (const { def, cell } of placed(s, room, ["window"], new Set()))
    drawPart(ctx, def, x + cell[0], y + cell[1], 0);
}

/** 床の装飾と入居直後の段ボール（家具の手前・人の奥） */
export function drawFloorDecor(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  room: number,
  x: number,
  y: number,
  acts: ReadonlySet<string>
): void {
  for (const { def, cell } of placed(s, room, ["floor"], acts))
    drawPart(ctx, def, x + cell[0], y + cell[1], 0);
  const box = defaultContent.decor[MOVING_BOX_ID];
  const n = s.decor[room]?.boxes ?? 0;
  if (box)
    for (let k = 0; k < n; k++) drawPart(ctx, box, x + BOX_BASE[0], y + BOX_BASE[1], k);
}
