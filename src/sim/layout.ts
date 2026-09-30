/** 建物断面の幾何。シミュレーション（歩く経路・座標）と描画が同じ値を見る。 */
export const SCENE_W = 320;
export const SCENE_H = 200;
export const ROOM_COUNT = 6;
/** 名簿・走査の順（2 階 → 1 階） */
export const ROOM_ORDER = [3, 4, 5, 0, 1, 2] as const;

export interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
  floor: 1 | 2;
  col: number;
}

export function roomRect(i: number): RoomRect {
  const col = i % 3;
  const floor = i < 3 ? 1 : 2;
  return { x: 28 + col * 77, y: floor === 2 ? 70 : 122, w: 74, h: 48, floor, col };
}

/** 部屋番号（101〜103 / 201〜203） */
export const roomNo = (i: number): number => (i < 3 ? 101 + i : 201 + (i - 3));

/** 壁が薄くて音が届く隣（左右と上下） */
export function neighbors(i: number): number[] {
  const out: number[] = [];
  const c = i % 3;
  if (c > 0) out.push(i - 1);
  if (c < 2) out.push(i + 1);
  out.push(i < 3 ? i + 3 : i - 3);
  return out;
}

export type Point = [number, number];

/** 部屋から通りへ出る経路（階段を下りる） */
export function exitPath(i: number): Point[] {
  return i >= 3
    ? [
        [266, 117],
        [279, 117],
        [302, 171],
        [302, 179],
        [-12, 179],
      ]
    : [
        [262, 179],
        [-12, 179],
      ];
}
