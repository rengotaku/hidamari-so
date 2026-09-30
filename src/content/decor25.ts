import type { Decor } from "./schema";

/** 装飾の箱 1 つ: [x, y, z, 幅, 奥行き, 高さ, 色] */
export type DecorBox = Decor["boxes"][number];
/** 全体図用の平面の矩形: [x, y, 幅, 高さ, 色]（部品の左上が原点） */
export type FlatRect = [number, number, number, number, string];

/**
 * 奥にある箱から先に並べる（手前の箱が上に重なる）。同じ奥行きなら定義の順。
 * 大写しも全体図も、この順で描く。
 */
export function orderedBoxes(def: Decor): DecorBox[] {
  return def.boxes
    .map((b, i) => ({ b, i }))
    .sort((p, q) => p.b[1] + p.b[4] - (q.b[1] + q.b[4]) || p.i - q.i)
    .map((p) => p.b);
}

/**
 * 全体図用の平面: 箱を正面から見た矩形。床からの高さ z は、上からの y = 高さ - z - 箱の高さ になる。
 * 全体図の装飾の絵は 2.5D の定義からだけ作る（絵を二重に持たない）。
 */
export function flatRects(def: Decor): FlatRect[] {
  return orderedBoxes(def).map(([x, , z, w, , h, c]) => [x, def.h - z - h, w, h, c]);
}
