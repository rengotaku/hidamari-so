import type { Place, Point, Resident } from "@/sim";

/**
 * 住人を描く位置。ゲームの中の位置（Resident.x / y）を、1 倍で歩いたときの画面上の速さで追う。
 * 15 倍で進めても住人が横に滑らないようにするための、描画側だけの状態（GameState にも保存にも入れない）。
 */
export interface DrawPos {
  at: Place;
  x: number;
  y: number;
  dir: 1 | -1;
  /** 外の道: 経路の識別（経路が変わったら追い直さず、すぐ合わせる） */
  key: string;
  /** 外の道: 描く位置の、経路の先頭からの弧長 */
  arc: number;
}

export type DrawPositions = ReadonlyMap<number, DrawPos>;

/** 追う速さの上限（ドット/実時間 1 秒）。1 倍の歩きの画面上の速さと同じ */
export const ROOM_SPEED = 8;
export const ROAD_SPEED = 12;
export const ROAD_HURRY_SPEED = 26;

export const createDrawPositions = (): DrawPositions => new Map();

const pathKey = (path: readonly Point[]): string => {
  const a = path[0];
  const b = path[path.length - 1];
  return `${path.length}:${a?.join(",")}:${b?.join(",")}`;
};

const dist = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** 経路の弧長（先頭から終点まで） */
const pathLength = (path: readonly Point[]): number => {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += dist(path[i - 1]!, path[i]!);
  return n;
};

/** ゲームの中の住人が、経路の先頭から何ドット進んだところにいるか */
function gameArc(r: Resident): number {
  const { path, pi } = r;
  if (path.length === 0) return 0;
  if (pi >= path.length) return pathLength(path);
  if (pi <= 0) return 0;
  let n = 0;
  for (let i = 1; i < pi; i++) n += dist(path[i - 1]!, path[i]!);
  return n + dist(path[pi - 1]!, [r.x, r.y]);
}

/** 経路の弧長 arc の位置と、そこでの向き */
function pointAt(
  path: readonly Point[],
  arc: number,
  dir: 1 | -1
): { x: number; y: number; dir: 1 | -1 } {
  let left = arc;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const d = dist(a, b);
    if (left <= d || i === path.length - 1) {
      const k = d === 0 ? 1 : Math.min(1, left / d);
      const dx = b[0] - a[0];
      return {
        x: a[0] + dx * k,
        y: a[1] + (b[1] - a[1]) * k,
        dir: Math.abs(dx) > 0.01 ? (dx < 0 ? -1 : 1) : dir,
      };
    }
    left -= d;
  }
  const p = path[0];
  return { x: p?.[0] ?? 0, y: p?.[1] ?? 0, dir };
}

function snap(r: Resident): DrawPos {
  const walking = r.at === "walking";
  return {
    at: r.at,
    x: r.x,
    y: r.y,
    dir: r.dir,
    key: walking ? pathKey(r.path) : "",
    arc: walking ? gameArc(r) : 0,
  };
}

function follow(prev: DrawPos, r: Resident, dtSec: number): DrawPos {
  if (typeof r.at === "number") {
    const step = ROOM_SPEED * dtSec;
    const gap = r.x - prev.x;
    const x = Math.abs(gap) <= step ? r.x : prev.x + Math.sign(gap) * step;
    return { ...prev, x, y: r.y, dir: r.dir };
  }
  if (r.at === "walking") {
    const goal = gameArc(r);
    const step = (r.hurry ? ROAD_HURRY_SPEED : ROAD_SPEED) * dtSec;
    const arc = goal - prev.arc <= step ? goal : prev.arc + step;
    const p = pointAt(r.path, arc, r.dir);
    return { ...prev, arc, ...p };
  }
  return snap(r);
}

/**
 * dtSec（実時間の秒）ぶん、描く位置をゲームの中の位置へ近づけた新しい値を返す。
 * 初めて見る住人と、居場所（Resident.at）や経路が変わった住人は、ゲームの中の位置へすぐ合わせる。
 */
export function updateDrawPositions(
  prev: DrawPositions,
  res: readonly Resident[],
  dtSec: number
): DrawPositions {
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? dtSec : 0;
  const next = new Map<number, DrawPos>();
  for (const r of res) {
    const p = prev.get(r.id);
    const same =
      p !== undefined &&
      p.at === r.at &&
      (r.at !== "walking" || p.key === pathKey(r.path));
    next.set(r.id, same ? follow(p, r, dt) : snap(r));
  }
  return next;
}

/** 描くときだけ、住人の x / y / 向きを描く位置に差し替えた新しい配列を返す（入力は書き換えない） */
export function applyDrawPositions(
  res: readonly Resident[],
  dp: DrawPositions
): Resident[] {
  return res.map((r) => {
    const p = dp.get(r.id);
    if (!p || p.at !== r.at || r.at === "out") return { ...r };
    return { ...r, x: p.x, y: p.y, dir: p.dir };
  });
}
