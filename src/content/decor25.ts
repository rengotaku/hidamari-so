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

/** 誰も何もしていない（行動による色替えを受けない）ときの行動の集合 */
export const NO_ACTS: ReadonlySet<string> = new Set();

/**
 * 描く箱: orderedBoxes の順で、`recolorDuringAct` の行動中なら from の色の箱を to の色に替える
 * （色は大文字小文字を区別しない）。def は変えず、新しい配列を返す。
 */
export function boxesFor(def: Decor, acts: ReadonlySet<string> = NO_ACTS): DecorBox[] {
  const re = def.recolorDuringAct;
  const boxes = orderedBoxes(def);
  if (!re || !acts.has(re.act)) return boxes;
  const from = re.from.toLowerCase();
  return boxes.map(
    (b): DecorBox =>
      b[6].toLowerCase() === from ? ([...b.slice(0, 6), re.to] as DecorBox) : b
  );
}

/**
 * 全体図用の平面: 箱を正面から見た矩形。床からの高さ z は、上からの y = 高さ - z - 箱の高さ になる。
 * 全体図の装飾の絵は 2.5D の定義からだけ作る（絵を二重に持たない）。
 */
export function flatRects(def: Decor, acts: ReadonlySet<string> = NO_ACTS): FlatRect[] {
  return boxesFor(def, acts).map(([x, , z, w, , h, c]) => [x, def.h - z - h, w, h, c]);
}
